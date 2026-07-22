use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::Rng;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tauri::Emitter;

const ESCOPO_DRIVE: &str = "https://www.googleapis.com/auth/drive.file";
const SERVICO_KEYRING: &str = "the-inkbound";
const USUARIO_KEYRING: &str = "google-refresh-token";

#[derive(Deserialize)]
pub(crate) struct OauthConfig {
    pub(crate) client_id: String,
    pub(crate) client_secret: String,
}

// Embutido no binário em tempo de compilação a partir de src-tauri/google-oauth.json
// (arquivo local, não versionado — ver docs/fase-5-cloud-sync.md para o passo a passo de
// como gerar essas credenciais no Google Cloud Console). Lido via std::fs em runtime
// funcionava em `tauri dev` (cwd = src-tauri/), mas quebrava no .exe instalado, onde
// esse caminho relativo não existe. include_str! resolve isso e ainda falha a build,
// em vez de falhar só quando o usuário clica em "Conectar".
const OAUTH_CONFIG_JSON: &str = include_str!("../google-oauth.json");

pub(crate) fn carregar_config() -> Result<OauthConfig, String> {
    serde_json::from_str(OAUTH_CONFIG_JSON).map_err(|e| format!("google-oauth.json inválido: {e}"))
}

fn gerar_code_verifier() -> String {
    let mut bytes = [0u8; 64];
    rand::thread_rng().fill(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn gerar_code_challenge(verifier: &str) -> String {
    let hash = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hash)
}

fn salvar_refresh_token(token: &str) -> Result<(), String> {
    crate::credential_store::salvar(SERVICO_KEYRING, USUARIO_KEYRING, token)
}

pub(crate) fn ler_refresh_token() -> Result<String, String> {
    crate::credential_store::ler(SERVICO_KEYRING, USUARIO_KEYRING)
}

fn remover_refresh_token() -> Result<(), String> {
    crate::credential_store::excluir(SERVICO_KEYRING, USUARIO_KEYRING)
}

async fn concluir_login(
    url_redirecionamento: &str,
    client_id: &str,
    client_secret: &str,
    code_verifier: &str,
) -> Result<(), String> {
    eprintln!("[auth] concluir_login: redirect recebido = {url_redirecionamento}");
    let analisada = url::Url::parse(url_redirecionamento).map_err(|e| e.to_string())?;

    let code = analisada
        .query_pairs()
        .find(|(chave, _)| chave == "code")
        .map(|(_, valor)| valor.to_string())
        .ok_or_else(|| "Nenhum código de autorização recebido do Google".to_string())?;
    eprintln!("[auth] code extraído com sucesso (len={})", code.len());

    let porta = analisada
        .port()
        .ok_or_else(|| "Porta de redirecionamento ausente".to_string())?;
    let redirect_uri = format!("http://localhost:{porta}");

    let cliente = reqwest::Client::new();
    let resposta = cliente
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("code", code.as_str()),
            ("client_id", client_id),
            ("client_secret", client_secret),
            ("redirect_uri", redirect_uri.as_str()),
            ("grant_type", "authorization_code"),
            ("code_verifier", code_verifier),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resposta.status().is_success() {
        let status = resposta.status();
        let corpo = resposta.text().await.unwrap_or_default();
        eprintln!("[auth] troca de código falhou ({status}): {corpo}");
        return Err(format!("Falha na troca do token com o Google: {corpo}"));
    }

    let dados: serde_json::Value = resposta.json().await.map_err(|e| e.to_string())?;
    eprintln!(
        "[auth] resposta do token endpoint tem refresh_token? {}",
        dados.get("refresh_token").is_some()
    );
    let refresh_token = dados
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .ok_or_else(|| {
            "O Google não retornou um refresh_token. Revogue o acesso em \
             myaccount.google.com/permissions e tente logar novamente."
                .to_string()
        })?;

    let resultado = salvar_refresh_token(refresh_token);
    eprintln!("[auth] concluir_login: resultado final = {resultado:?}");
    resultado
}

#[tauri::command]
pub async fn iniciar_login_google(app: tauri::AppHandle) -> Result<String, String> {
    let config = carregar_config()?;
    let verifier = gerar_code_verifier();
    let challenge = gerar_code_challenge(&verifier);

    let app_handle = app.clone();
    let client_id_callback = config.client_id.clone();
    let client_secret_callback = config.client_secret.clone();
    let verifier_callback = verifier.clone();

    let porta = tauri_plugin_oauth::start(move |url_redirecionamento| {
        let app_handle = app_handle.clone();
        let client_id = client_id_callback.clone();
        let client_secret = client_secret_callback.clone();
        let verifier = verifier_callback.clone();
        let url_redirecionamento = url_redirecionamento.clone();

        tauri::async_runtime::spawn(async move {
            let resultado =
                concluir_login(&url_redirecionamento, &client_id, &client_secret, &verifier).await;
            match resultado {
                Ok(()) => {
                    let _ = app_handle.emit("google-login-concluido", ());
                }
                Err(erro) => {
                    let _ = app_handle.emit("google-login-erro", erro);
                }
            }
        });
    })
    .map_err(|e| e.to_string())?;

    let redirect_uri = format!("http://localhost:{porta}");
    let mut url_autorizacao = url::Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .map_err(|e| e.to_string())?;
    url_autorizacao
        .query_pairs_mut()
        .append_pair("client_id", &config.client_id)
        .append_pair("redirect_uri", &redirect_uri)
        .append_pair("response_type", "code")
        .append_pair("scope", ESCOPO_DRIVE)
        .append_pair("code_challenge", &challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("access_type", "offline")
        .append_pair("prompt", "consent");

    Ok(url_autorizacao.to_string())
}

#[tauri::command]
pub fn status_login_google() -> bool {
    ler_refresh_token().is_ok()
}

#[tauri::command]
pub fn logout_google() -> Result<(), String> {
    remover_refresh_token()
}

// Troca o refresh_token guardado por um access_token novo. Chamado antes de
// qualquer operação na API do Drive — mais simples e sempre correto do que
// tentar rastrear a expiração do token anterior (que dura só ~1h).
pub(crate) async fn obter_access_token() -> Result<String, String> {
    let config = carregar_config()?;
    let refresh_token = ler_refresh_token()
        .map_err(|_| "Não conectado ao Google Drive. Conecte-se primeiro.".to_string())?;

    let cliente = reqwest::Client::new();
    let resposta = cliente
        .post("https://oauth2.googleapis.com/token")
        .form(&[
            ("client_id", config.client_id.as_str()),
            ("client_secret", config.client_secret.as_str()),
            ("refresh_token", refresh_token.as_str()),
            ("grant_type", "refresh_token"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resposta.status().is_success() {
        let corpo = resposta.text().await.unwrap_or_default();
        eprintln!("[drive] falha ao renovar access_token: {corpo}");
        return Err(format!("Falha ao renovar o token de acesso: {corpo}"));
    }

    let dados: serde_json::Value = resposta.json().await.map_err(|e| e.to_string())?;
    eprintln!("[drive] access_token renovado com sucesso");
    dados
        .get("access_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Google não retornou access_token na renovação".to_string())
}
