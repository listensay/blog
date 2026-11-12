fn main() {
    println!(
        "cargo:rustc-env=BLOG_TARGET={}",
        std::env::var("TARGET").unwrap()
    );
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&["finish_close", "choose_workspace"]),
    ))
    .expect("failed to build desktop application");
}
