fn main() {
    println!("cargo:rerun-if-changed=backend/desktop-build.json");
    let target = std::env::var("TARGET").unwrap();
    let expected = match target.as_str() {
        "x86_64-pc-windows-msvc" => "win32-x64",
        "aarch64-apple-darwin" => "darwin-arm64",
        "x86_64-apple-darwin" => "darwin-x64",
        "x86_64-unknown-linux-gnu" => "linux-x64",
        _ => panic!("Unsupported desktop target: {target}"),
    };
    let manifest: serde_json::Value = serde_json::from_str(
        &std::fs::read_to_string("backend/desktop-build.json")
            .expect("Run npm run desktop:prepare first"),
    )
    .expect("Invalid desktop manifest");
    assert_eq!(
        manifest["platform"].as_str(),
        Some(expected),
        "Rebuild the backend on a matching OS/CPU runner"
    );
    tauri_build::build()
}
