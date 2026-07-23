mod credential_store;
mod exportacao;
mod google_auth;
mod google_drive;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            google_auth::iniciar_login_google,
            google_auth::status_login_google,
            google_auth::logout_google,
            google_drive::drive_obter_ou_criar_pasta,
            google_drive::drive_buscar_arquivo,
            google_drive::drive_listar_filhos,
            google_drive::drive_obter_metadados,
            google_drive::drive_pasta_existe,
            google_drive::drive_enviar_arquivo,
            google_drive::drive_baixar_arquivo,
            google_drive::drive_excluir_arquivo,
            google_drive::hash_arquivo_local,
            exportacao::exportar_manuscrito_docx,
            exportacao::exportar_manuscrito_pdf,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
