#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs,
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{webview::DownloadEvent, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

struct Service(Child);
impl Drop for Service {
    fn drop(&mut self) {
        // Closing stdin asks Node to drain requests and close its SQLite connection.
        drop(self.0.stdin.take());
        let deadline = Instant::now() + Duration::from_secs(5);
        while Instant::now() < deadline {
            if matches!(self.0.try_wait(), Ok(Some(_))) {
                return;
            }
            std::thread::sleep(Duration::from_millis(50));
        }
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

struct Desktop {
    service: Mutex<Option<Service>>,
    origin: String,
    exiting: AtomicBool,
    closing: AtomicBool,
}

fn valid_workspace(path: &Path) -> bool {
    ["content/blog", "public"]
        .iter()
        .all(|name| path.join(name).is_dir())
        && path.join("nuxt.config.ts").is_file()
}

fn save_workspace(app: &tauri::AppHandle, root: &Path) -> Result<(), String> {
    let directory = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    fs::write(
        directory.join("workspace.json"),
        serde_json::to_vec(root).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

fn initial_workspace(
    app: &tauri::AppHandle,
) -> Result<Option<PathBuf>, Box<dyn std::error::Error>> {
    if let Some(root) = std::env::var_os("ADMIN_BLOG_ROOT")
        .map(PathBuf::from)
        .filter(|p| valid_workspace(p))
    {
        return Ok(Some(root));
    }
    let saved = app.path().app_config_dir()?.join("workspace.json");
    if let Ok(bytes) = fs::read(saved) {
        if let Ok(root) = serde_json::from_slice::<PathBuf>(&bytes) {
            if valid_workspace(&root) {
                return Ok(Some(root));
            }
        }
    }
    loop {
        let Some(root) = rfd::FileDialog::new()
            .set_title("选择博客目录")
            .pick_folder()
        else {
            return Ok(None);
        };
        if valid_workspace(&root) {
            save_workspace(app, &root)?;
            return Ok(Some(root));
        }
        rfd::MessageDialog::new()
            .set_title("无法打开博客")
            .set_description("所选目录不是博客项目，请重新选择。")
            .set_level(rfd::MessageLevel::Error)
            .show();
    }
}

fn trusted(window: &WebviewWindow, state: &Desktop) -> Result<(), String> {
    if window.label() != "main"
        || window
            .url()
            .map_err(|e| e.to_string())?
            .origin()
            .ascii_serialization()
            != state.origin
    {
        return Err("访问被拒绝".into());
    }
    Ok(())
}

#[tauri::command]
fn finish_close(app: tauri::AppHandle, window: WebviewWindow, saved: bool) -> Result<(), String> {
    let state = app.state::<Desktop>();
    trusted(&window, &state)?;
    state.closing.store(false, Ordering::SeqCst);
    if saved {
        state.exiting.store(true, Ordering::SeqCst);
        app.exit(0);
    }
    Ok(())
}

#[tauri::command]
async fn choose_workspace(app: tauri::AppHandle, window: WebviewWindow) -> Result<(), String> {
    trusted(&window, &app.state::<Desktop>())?;
    let Some(folder) = rfd::AsyncFileDialog::new()
        .set_title("选择博客目录")
        .pick_folder()
        .await
    else {
        return Ok(());
    };
    if !valid_workspace(folder.path()) {
        return Err("所选目录不是博客项目".into());
    }
    save_workspace(&app, folder.path())?;
    // The frontend has drained all pending saves before invoking this command.
    app.state::<Desktop>().exiting.store(true, Ordering::SeqCst);
    app.state::<Desktop>()
        .service
        .lock()
        .map_err(|e| e.to_string())?
        .take();
    std::env::remove_var("ADMIN_BLOG_ROOT");
    app.restart();
}

fn request_close(app: &tauri::AppHandle) {
    let state = app.state::<Desktop>();
    if state.closing.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Some(window) = app.get_webview_window("main") {
        let script = "if (window.__BLOG_DESKTOP_CLOSE__) { window.__BLOG_DESKTOP_CLOSE__(); } else { window.__TAURI_INTERNALS__.invoke('finish_close', { saved: true }); }";
        if window.eval(script).is_err() {
            state.closing.store(false, Ordering::SeqCst);
        }
    }
}

fn external(url: &tauri::Url) {
    if matches!(url.scheme(), "http" | "https" | "mailto") {
        let _ = open::that_detached(url.as_str());
    }
}

fn main() {
    let result = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .invoke_handler(tauri::generate_handler![finish_close, choose_workspace])
        .setup(|app| {
            let Some(root) = initial_workspace(app.handle())? else {
                app.handle().exit(0);
                return Ok(());
            };
            let (resources, executable) = if cfg!(debug_assertions) {
                let base = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
                (
                    base.join("resources"),
                    base.join(format!(
                        "binaries/blog-node-{}{}",
                        env!("BLOG_TARGET"),
                        std::env::consts::EXE_SUFFIX
                    )),
                )
            } else {
                (
                    app.path().resource_dir()?.join("resources"),
                    std::env::current_exe()?
                        .parent()
                        .ok_or("找不到应用目录")?
                        .join(format!("blog-node{}", std::env::consts::EXE_SUFFIX)),
                )
            };
            let mut command = Command::new(executable);
            command
                .arg(resources.join("service.mjs"))
                .arg(&root)
                .arg(&resources)
                .current_dir(&root)
                .env_remove("NODE_OPTIONS")
                .env_remove("NODE_PATH")
                .stdin(Stdio::piped())
                .stdout(Stdio::piped())
                .stderr(Stdio::inherit());
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                command.creation_flags(0x08000000);
            }
            let mut service = Service(command.spawn()?);
            let output = service.0.stdout.take().ok_or("无法读取服务状态")?;
            let (sender, receiver) = mpsc::channel();
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut lines = BufReader::new(output).lines();
                let first = lines.next().and_then(Result::ok);
                let _ = sender.send(first);
                for line in lines {
                    if line.is_err() {
                        break;
                    }
                }
                if let Some(state) = handle.try_state::<Desktop>() {
                    if !state.exiting.load(Ordering::SeqCst) {
                        rfd::MessageDialog::new()
                            .set_title("后台服务已停止")
                            .set_description("本地服务意外退出，请重新打开应用。")
                            .set_level(rfd::MessageLevel::Error)
                            .show();
                        state.exiting.store(true, Ordering::SeqCst);
                        handle.exit(1);
                    }
                }
            });
            let line = receiver
                .recv_timeout(Duration::from_secs(30))?
                .ok_or("本地服务启动失败")?;
            let ready: serde_json::Value = serde_json::from_str(&line)?;
            let url: tauri::Url = ready["url"].as_str().ok_or("本地服务未返回地址")?.parse()?;
            if url.scheme() != "http" || url.host_str() != Some("127.0.0.1") {
                return Err("本地服务地址无效".into());
            }
            let origin = url.origin().ascii_serialization();
            app.manage(Desktop {
                service: Mutex::new(Some(service)),
                origin: origin.clone(),
                exiting: AtomicBool::new(false),
                closing: AtomicBool::new(false),
            });
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title(format!(
                    "Immki Blog · {}",
                    root.file_name().unwrap_or_default().to_string_lossy()
                ))
                .inner_size(1440.0, 960.0)
                .min_inner_size(900.0, 640.0)
                .on_navigation(move |url| {
                    if url.origin().ascii_serialization() == origin {
                        true
                    } else {
                        external(url);
                        false
                    }
                })
                .on_new_window(|url, _| {
                    external(&url);
                    tauri::webview::NewWindowResponse::Deny
                })
                .on_download(|_, event| match event {
                    DownloadEvent::Requested { destination, .. } => {
                        let Some(file) = rfd::FileDialog::new()
                            .set_title("导出文档")
                            .set_file_name(
                                destination
                                    .file_name()
                                    .unwrap_or_default()
                                    .to_string_lossy(),
                            )
                            .save_file()
                        else {
                            return false;
                        };
                        *destination = file;
                        true
                    }
                    _ => true,
                })
                .build()?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if let Some(state) = window.try_state::<Desktop>() {
                    if !state.exiting.load(Ordering::SeqCst) {
                        api.prevent_close();
                        request_close(window.app_handle());
                    }
                }
            }
        })
        .build(tauri::generate_context!());
    match result {
        Ok(app) => app.run(|handle, event| match event {
            tauri::RunEvent::ExitRequested { api, .. } => {
                if let Some(state) = handle.try_state::<Desktop>() {
                    if !state.exiting.load(Ordering::SeqCst) {
                        api.prevent_exit();
                        request_close(handle);
                    }
                }
            }
            tauri::RunEvent::Exit => {
                if let Some(state) = handle.try_state::<Desktop>() {
                    state.exiting.store(true, Ordering::SeqCst);
                    if let Ok(mut service) = state.service.lock() {
                        service.take();
                    }
                }
            }
            _ => {}
        }),
        Err(error) => {
            rfd::MessageDialog::new()
                .set_title("无法启动后台")
                .set_description(error.to_string())
                .set_level(rfd::MessageLevel::Error)
                .show();
        }
    }
}
