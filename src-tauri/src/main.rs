#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(unix)]
use std::os::unix::process::CommandExt;
#[cfg(windows)]
use std::os::windows::{
    io::{AsRawHandle, FromRawHandle, OwnedHandle},
    process::CommandExt,
};
use std::{
    fs::{self, File},
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{mpsc, Mutex},
    time::Duration,
};
use tauri::{webview::PageLoadEvent, Manager, WebviewUrl, WebviewWindowBuilder};
#[cfg(windows)]
use windows_sys::Win32::{
    System::{
        JobObjects::{
            AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
            SetInformationJobObject, TerminateJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
            JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        },
        Threading::CREATE_NO_WINDOW,
    },
    UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL},
};

const TITLE: &str = "录阶 LuJie CareerKit · 桌面预览版";
const ORIGIN: &str = "http://127.0.0.1:43187";

#[derive(Default)]
struct StartupError(Mutex<Option<String>>);

#[cfg(windows)]
fn wide(value: &str) -> Vec<u16> {
    value.encode_utf16().chain(Some(0)).collect()
}

struct Backend {
    child: Mutex<Option<Child>>,
    #[cfg(windows)]
    _job: OwnedHandle,
}
impl Backend {
    fn stop(&self) {
        if let Ok(mut owned) = self.child.lock() {
            if let Some(mut child) = owned.take() {
                child.stdin.take();
                #[cfg(windows)]
                unsafe {
                    TerminateJobObject(self._job.as_raw_handle(), 0);
                }
                // Only this child's dedicated process group; take() prevents signaling a reused PID.
                #[cfg(unix)]
                unsafe {
                    libc::kill(-(child.id() as i32), libc::SIGKILL);
                }
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}
impl Drop for Backend {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(windows)]
fn attach_job(child: &Child) -> std::io::Result<OwnedHandle> {
    unsafe {
        let raw = CreateJobObjectW(std::ptr::null(), std::ptr::null());
        if raw.is_null() {
            return Err(std::io::Error::last_os_error());
        }
        let job = OwnedHandle::from_raw_handle(raw);
        let mut limits: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
        limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
        if SetInformationJobObject(
            raw,
            JobObjectExtendedLimitInformation,
            &limits as *const _ as _,
            std::mem::size_of_val(&limits) as u32,
        ) == 0
            || AssignProcessToJobObject(raw, child.as_raw_handle()) == 0
        {
            return Err(std::io::Error::last_os_error());
        }
        Ok(job)
    }
}

fn open_external(url: &tauri::Url) {
    if matches!(url.scheme(), "http" | "https" | "mailto") {
        #[cfg(windows)]
        unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                wide("open").as_ptr(),
                wide(url.as_str()).as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            );
        }
        #[cfg(unix)]
        {
            let url = url.to_string();
            std::thread::spawn(move || {
                let opener = if cfg!(target_os = "macos") {
                    "open"
                } else {
                    "xdg-open"
                };
                let _ = Command::new(opener).arg(url).status();
            });
        }
    }
}

fn show_error(app: &tauri::AppHandle, message: String) {
    *app.state::<StartupError>().0.lock().unwrap() = Some(message);
    if let Some(window) = app.get_webview_window("main") {
        render_startup_error(&window);
    }
}

fn render_startup_error(window: &tauri::WebviewWindow) {
    let message = window.state::<StartupError>().0.lock().unwrap().clone();
    if let Some(message) = message {
        let _ = window.eval(&format!("if(document.getElementById('status')){{document.getElementById('title').textContent='启动失败 / Startup failed';document.getElementById('status').textContent={};}}", serde_json::to_string(&message).unwrap()));
    }
}

fn start_backend(app: &tauri::AppHandle, data: PathBuf) -> Result<(), Box<dyn std::error::Error>> {
    #[cfg(windows)]
    fs::create_dir_all(&data)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::DirBuilderExt;
        fs::DirBuilder::new()
            .recursive(true)
            .mode(0o700)
            .create(&data)?;
    }
    let log_path = data.join("desktop.log");
    let log = File::create(&log_path)?;
    // Tauri canonicalizes to \\?\ paths on Windows; Node's entry-point loader needs normal DOS paths.
    let resources = app.path().resource_dir()?;
    let backend_dir = dunce::simplified(&resources).join("backend");
    let mut command =
        Command::new(backend_dir.join(if cfg!(windows) { "node.exe" } else { "node" }));
    command
        .arg(backend_dir.join("desktop-runtime.mjs"))
        .current_dir(&backend_dir)
        .env("LUJIE_DESKTOP_DATA_DIR", &data)
        .env("PORT", "43187")
        .env_remove("NODE_OPTIONS")
        .env_remove("NODE_PATH")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(log.try_clone()?);
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
    #[cfg(unix)]
    command.process_group(0);
    let mut child = command.spawn()?;
    #[cfg(windows)]
    let job = match attach_job(&child) {
        Ok(job) => job,
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error.into());
        }
    };
    let stdout = child.stdout.take().ok_or("Missing backend output pipe")?;
    child
        .stdin
        .as_mut()
        .ok_or("Missing backend input pipe")?
        .write_all(b"start\n")?;
    app.manage(Backend {
        child: Mutex::new(Some(child)),
        #[cfg(windows)]
        _job: job,
    });
    let (sender, receiver) = mpsc::channel();
    let monitor_app = app.clone();
    std::thread::spawn(move || {
        let mut log = log;
        let mut ready = false;
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Some(url) = line.strip_prefix("LUJIE_READY ") {
                ready = true;
                let _ = sender.send(url.to_owned());
            } else {
                let _ = writeln!(log, "{line}");
            }
        }
        if ready {
            if let Some(window) = monitor_app.get_webview_window("main") {
                let _ = window.eval("document.body.textContent='本地服务已停止，请关闭并重新打开录阶。Local service stopped; please restart LuJie.'");
            }
        }
    });
    let app = app.clone();
    std::thread::spawn(
        move || match receiver.recv_timeout(Duration::from_secs(90)) {
            Ok(url) => {
                if let Ok(url) = tauri::Url::parse(&url) {
                    if url.origin().ascii_serialization() == ORIGIN {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.navigate(url);
                        }
                        return;
                    }
                }
                show_error(&app, "Invalid local server response.".into());
            }
            Err(_) => {
                app.state::<Backend>().stop();
                show_error(&app, format!("本地服务未能启动。端口 43187 可能被占用，或数据库迁移失败。\n请查看日志：{}\n\nThe local service could not start. See the log above.", log_path.display()));
            }
        },
    );
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(StartupError::default())
        .setup(|app| {
            let data = std::env::var_os("LUJIE_DESKTOP_DATA_DIR")
                .map(PathBuf::from)
                .unwrap_or(app.path().app_local_data_dir()?);
            let window =
                WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                    .title(TITLE)
                    .inner_size(1320.0, 880.0)
                    .min_inner_size(960.0, 640.0)
                    // Existing resume upload zones use HTML5 file drops, not Tauri drag/drop events.
                    .disable_drag_drop_handler()
                    .on_page_load(|window, payload| {
                        if payload.event() == PageLoadEvent::Finished {
                            render_startup_error(&window);
                        }
                    })
                    .on_navigation(|url| {
                        if url.origin().ascii_serialization() == ORIGIN
                            || matches!(url.scheme(), "tauri")
                            || url.host_str() == Some("tauri.localhost")
                        {
                            return true;
                        }
                        open_external(url);
                        false
                    })
                    .on_new_window(|url, _| {
                        open_external(&url);
                        tauri::webview::NewWindowResponse::Deny
                    });
            // WKWebView does not support a filesystem data_directory. Use its app-scoped store on macOS.
            #[cfg(not(target_os = "macos"))]
            let window = window.data_directory(data.join("webview"));
            window.build()?;
            if let Err(error) = start_backend(app.handle(), data) {
                show_error(app.handle(), error.to_string());
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Unable to initialize LuJie desktop")
        .run(|app, event| {
            // Cmd+Q / the application menu must go through the same JS save guard as window close.
            if let tauri::RunEvent::ExitRequested { api, .. } = &event {
                if let Some(window) = app.get_webview_window("main") {
                    api.prevent_exit();
                    let _ = window.close();
                }
            }
            // ponytail: this is a single-window app; closing it also quits on macOS.
            if let tauri::RunEvent::WindowEvent {
                label,
                event: tauri::WindowEvent::Destroyed,
                ..
            } = &event
            {
                if label == "main" {
                    app.exit(0);
                }
            }
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(backend) = app.try_state::<Backend>() {
                    backend.stop();
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Read;

    #[test]
    fn stopping_backend_closes_descendants_and_is_repeatable() {
        let node = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("backend")
            .join(if cfg!(windows) { "node.exe" } else { "node" });
        let mut command = Command::new(node);
        command
            .args(["-e", "process.stdin.once('data',()=>{require('child_process').spawn(process.execPath,['-e','setTimeout(()=>{},30000)'],{stdio:'inherit'});console.log('ready')})"])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped());
        #[cfg(unix)]
        command.process_group(0);
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        let mut child = command.spawn().unwrap();
        #[cfg(windows)]
        let job = attach_job(&child).unwrap();
        child.stdin.as_mut().unwrap().write_all(b"start\n").unwrap();
        let mut stdout = BufReader::new(child.stdout.take().unwrap());
        let mut ready = String::new();
        stdout.read_line(&mut ready).unwrap();
        assert_eq!(ready.trim(), "ready");
        let backend = Backend {
            child: Mutex::new(Some(child)),
            #[cfg(windows)]
            _job: job,
        };
        let (sender, receiver) = mpsc::channel();
        std::thread::spawn(move || {
            let mut remaining = String::new();
            sender.send(stdout.read_to_string(&mut remaining)).unwrap();
        });
        backend.stop();
        backend.stop();
        // A surviving grandchild would keep stdout open for 30 seconds.
        receiver
            .recv_timeout(Duration::from_secs(3))
            .unwrap()
            .unwrap();
        assert!(backend.child.lock().unwrap().is_none());
    }
}
