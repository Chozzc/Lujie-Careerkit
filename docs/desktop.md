# Desktop build checks / 桌面构建测试

## 范围

桌面测试版基于公开 v0.4.0 的业务代码，使用 Tauri 2、内置 Node 22、Next.js、Prisma 和 SQLite。用户无需另装 Node 或 Docker；云端 AI 仍需自己的配置和网络。个人数据保存在各设备本机，不提供账号或同步。

| 目标 | 构建环境 | 安装格式 |
| --- | --- | --- |
| Windows x64 | windows-2022 | NSIS EXE |
| macOS Apple Silicon | macos-15 / ARM64 | DMG |
| macOS Intel | macos-15-intel / x64 | DMG |
| Linux x64 | ubuntu-22.04 | AppImage、DEB |

这是一套构建与后台验证流程，不是正式桌面 Release。Mac/Linux 图形交互需要分别验收；不能把编译通过解释为兼容所有系统。Windows ARM64、Linux ARM64 和手机端暂未包含。

## 业务与校招数据

桌面使用公开本地版完整业务实现，与 Git/Docker 部署主要区别在启动方式、数据目录和系统 WebView。浏览器本地版与桌面都使用 500 ms 防抖自动保存。

安装包带上正式 `data/campus/current.json`，仅复制这一份已移除原始来源字段的文件。构建遇到 `sourceUrl` 字段会失败；intake、历史留档、个人数据库、环境文件不进入安装包。招聘公告/投递链接保留。目录随安装包更新，不提供校招数据在线自动同步；记录不保证逐条核验或仍在招聘。

README 专用的截图、GIF、宣传视频和封面不进入桌面资源；应用需要的品牌 SVG 保留。三份 README 的内容不由桌面测试工作修改。

## 构建与检查

须在匹配 OS/CPU 的环境构建，不复制其他平台的 node_modules。需要 Node.js 22、npm、Rust，以及 Windows C++ Build Tools/SDK、Mac Xcode Command Line Tools，或工作流列出的 Linux GTK/WebKitGTK/OpenSSL 开发依赖。

```sh
npm ci
node node_modules/vitest/vitest.mjs run --maxWorkers=2
npm run desktop:check
node node_modules/@tauri-apps/cli/tauri.js build -- --locked
cargo test --manifest-path src-tauri/Cargo.toml --release --locked
npm run desktop:smoke
```

生成资源在 `src-tauri/backend/`，安装器在 `src-tauri/target/release/bundle/`，均不提交 Git。Node 下载按固定 SHA256 验证，Node/Prisma 必须匹配目标平台。Linux 为 glibc/OpenSSL 3 目标，不包含 musl 可选模块。

CI 从干净检出构建。Tauri 的旧 `target/release/backend` 和 `target/release/bundle` 可能保留删除过的资源，本机删除/更换依赖后应先把这些生成目录另存到构建路径外再重打包；不要操作个人数据目录。

`.github/workflows/desktop-check.yml` 可手动触发或由 `codex/desktop-*` 分支推送触发。四个任务分别构建和验证实际包内资源，通过后上传 14 天测试附件；没有创建 tag、Release、上传更新服务或部署的步骤。Docker 发布工作流独立保留。

## 自动验证的范围

- 架构及引擎校验、中文路径下的密钥/数据库、迁移备份和拒绝数据库降级。
- 包内后端在隔离缓存且 PATH 无系统 Node/npm 的环境启动，禁用 Prisma 引擎下载。
- 正式校招文件与源码一致，API 数量、检索、详情和原始来源字段排除。
- 原生图片转换、TXT/PDF/DOCX 导入、简历/投递保存、重启持久化、加密和 HTTP 访问隔离。
- 模拟 Provider 的 AI 连接、Agent SSE 和历史；不使用个人 Key、不收费调用真实模型。
- 原生父子进程退出测试；Windows Job Object，Unix 专用进程组。Mac Cmd+Q 走与正常关闭相同的保存保护。

Windows CI 实际安装 EXE 后检查；Mac 挂载 DMG，检查匿名签名与包内后端；Linux 分别提取 DEB/AppImage 后检查。没有自动点击原生窗口，不替代用户操作和干净消费级系统测试。

## 数据与保存

identifier 固定为 `dev.chozzc.lujie.preview`，升级不得随意更改。

- Windows：`%LOCALAPPDATA%/dev.chozzc.lujie.preview/`
- macOS：`~/Library/Application Support/dev.chozzc.lujie.preview/`
- Linux：`$XDG_DATA_HOME/dev.chozzc.lujie.preview/`，默认 `~/.local/share/dev.chozzc.lujie.preview/`

`careerkit.db` 与 `settings.key` 必须成对备份。它们不是整个数据库加密，也不会自动从 Git/Docker/网页搬运。待执行迁移前自动做 SQLite 一致性备份及密钥副本，失败停止升级；未知新版本迁移拒绝降级。内部备份不能代替外部备份。

正常关闭会立即尝试保存简历并等待完成，失败保留窗口；不保证 AI 生成、其他表单或后台请求完成，也无法保护强制结束或断电。应用只监听固定本机端口 43187，端口被占用会报错；每次启动使用新的私有会话。

## 人工验收

1. 安装、导入中文 PDF/DOCX、拖放；保存后重开，检查内容保留。
2. 修改后立即关窗、慢保存和保存失败；Mac 另测 Cmd+Q。失败应保留窗口。
3. 两页简历导出 PDF/PNG/可编辑 Word，检查中文、头像、分页；面试资料打印为 PDF。
4. 配置真实 AI，试优化、JD 定制、面试和 Agent 确认写入；检查重启后成果。
5. 重复启动、外链、中英文和语音权限；记录目标 OS/WebView 版本。
6. 在没有开发工具的目标系统上安装，备份后覆盖升级；检查原数据和配置保留，断网重开本地资料。

Windows 缺少 WebView2 时安装器需要联网补装。Mac 最低系统配置是 12.0，但不代表已在该系统实测；Linux AppImage 不保证适用所有发行版。

Windows 未正式签名；Mac 使用 ad-hoc 匿名签名，没有 Developer ID、公证或 hardened runtime。正式分发的系统信任体验需单独处理。自动更新、一键恢复和网页数据迁移向导尚未实现。

## English

The preview packages the public v0.4.0 local app for Windows x64, macOS ARM64/x64 and Linux x64. It includes the reviewed public campus catalog, with original source fields rejected at build time. Personal databases, source archives and environment files are excluded. README-only promotional media is omitted.

The four native CI jobs test the application and actual packaged backend before uploading temporary artifacts. They do not publish a Release. These checks do not establish native window, printing, speech or clean consumer OS acceptance. The manual checklist above remains required. Windows is unsigned; macOS uses ad-hoc signing without Developer ID or notarization. Data remains local and automatic updates are not implemented.
