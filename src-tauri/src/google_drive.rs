use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};

use crate::google_auth::obter_access_token;

const ARQUIVOS_URL: &str = "https://www.googleapis.com/drive/v3/files";
const UPLOAD_URL: &str = "https://www.googleapis.com/upload/drive/v3/files";
const MIME_PASTA: &str = "application/vnd.google-apps.folder";

#[derive(Serialize, Deserialize, Clone)]
pub struct ArquivoDrive {
    pub id: String,
    #[serde(rename = "modifiedTime")]
    pub modified_time: String,
}

#[derive(Serialize, Clone)]
pub struct EntradaDrive {
    pub id: String,
    pub nome: String,
    pub tipo: String,
    #[serde(rename = "modifiedTime")]
    pub modified_time: Option<String>,
}

fn escapar_para_query(valor: &str) -> String {
    valor.replace('\\', "\\\\").replace('\'', "\\'")
}

async fn buscar_entrada(
    token: &str,
    nome: &str,
    pasta_pai_id: &str,
    apenas_pastas: bool,
) -> Result<Option<ArquivoDrive>, String> {
    let mime = if apenas_pastas {
        format!(" and mimeType = '{MIME_PASTA}'")
    } else {
        format!(" and mimeType != '{MIME_PASTA}'")
    };
    let query = format!(
        "name = '{}' and '{}' in parents and trashed = false{}",
        escapar_para_query(nome),
        escapar_para_query(pasta_pai_id),
        mime
    );

    let cliente = reqwest::Client::new();
    let resposta = cliente
        .get(ARQUIVOS_URL)
        .bearer_auth(token)
        .query(&[
            ("q", query.as_str()),
            ("fields", "files(id,modifiedTime)"),
            ("spaces", "drive"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resposta.status().is_success() {
        let status = resposta.status();
        let corpo = resposta.text().await.unwrap_or_default();
        eprintln!("[drive] falha na busca (query={query:?}, status={status}): {corpo}");
        return Err(format!("Falha ao buscar no Drive: {corpo}"));
    }

    let dados: serde_json::Value = resposta.json().await.map_err(|e| e.to_string())?;
    let arquivo = dados
        .get("files")
        .and_then(|v| v.as_array())
        .and_then(|lista| lista.first())
        .and_then(|item| {
            Some(ArquivoDrive {
                id: item.get("id")?.as_str()?.to_string(),
                modified_time: item.get("modifiedTime")?.as_str()?.to_string(),
            })
        });

    Ok(arquivo)
}

#[tauri::command]
pub async fn drive_obter_ou_criar_pasta(
    nome: String,
    pasta_pai_id: Option<String>,
) -> Result<String, String> {
    eprintln!("[drive] obter_ou_criar_pasta: nome={nome:?} pasta_pai_id={pasta_pai_id:?}");
    let token = obter_access_token().await?;
    let pasta_pai = pasta_pai_id.unwrap_or_else(|| "root".to_string());

    if let Some(existente) = buscar_entrada(&token, &nome, &pasta_pai, true).await? {
        eprintln!("[drive] pasta já existia: id={}", existente.id);
        return Ok(existente.id);
    }

    eprintln!("[drive] pasta não encontrada, criando nova sob parent={pasta_pai}");
    let cliente = reqwest::Client::new();
    let resposta = cliente
        .post(ARQUIVOS_URL)
        .bearer_auth(&token)
        .query(&[("fields", "id")])
        .json(&json!({
            "name": nome,
            "mimeType": MIME_PASTA,
            "parents": [pasta_pai],
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resposta.status().is_success() {
        let status = resposta.status();
        let corpo = resposta.text().await.unwrap_or_default();
        eprintln!("[drive] falha ao criar pasta ({status}): {corpo}");
        return Err(format!("Falha ao criar pasta no Drive: {corpo}"));
    }

    let dados: serde_json::Value = resposta.json().await.map_err(|e| e.to_string())?;
    eprintln!("[drive] pasta criada: {dados:?}");
    dados
        .get("id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Drive não retornou o id da pasta criada".to_string())
}

#[tauri::command]
pub async fn drive_buscar_arquivo(
    nome: String,
    pasta_pai_id: String,
) -> Result<Option<ArquivoDrive>, String> {
    let token = obter_access_token().await?;
    buscar_entrada(&token, &nome, &pasta_pai_id, false).await
}

// Lista os filhos diretos (arquivos e pastas) de uma pasta do Drive. Usado
// para descobrir, ao conectar num dispositivo novo, quais projetos/arquivos
// já existem no Drive mas ainda não foram baixados localmente.
#[tauri::command]
pub async fn drive_listar_filhos(pasta_id: String) -> Result<Vec<EntradaDrive>, String> {
    let token = obter_access_token().await?;
    let query = format!("'{}' in parents and trashed = false", escapar_para_query(&pasta_id));

    let cliente = reqwest::Client::new();
    let resposta = cliente
        .get(ARQUIVOS_URL)
        .bearer_auth(&token)
        .query(&[
            ("q", query.as_str()),
            ("fields", "files(id,name,mimeType,modifiedTime)"),
            ("spaces", "drive"),
            ("pageSize", "1000"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resposta.status().is_success() {
        return Err(format!(
            "Falha ao listar pasta do Drive: {}",
            resposta.text().await.unwrap_or_default()
        ));
    }

    let dados: serde_json::Value = resposta.json().await.map_err(|e| e.to_string())?;
    let entradas = dados
        .get("files")
        .and_then(|v| v.as_array())
        .map(|lista| {
            lista
                .iter()
                .filter_map(|item| {
                    let id = item.get("id")?.as_str()?.to_string();
                    let nome = item.get("name")?.as_str()?.to_string();
                    let mime = item.get("mimeType")?.as_str()?;
                    let tipo = if mime == MIME_PASTA { "pasta" } else { "arquivo" }.to_string();
                    let modified_time = item
                        .get("modifiedTime")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    Some(EntradaDrive {
                        id,
                        nome,
                        tipo,
                        modified_time,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(entradas)
}

#[tauri::command]
pub async fn drive_obter_metadados(file_id: String) -> Result<String, String> {
    let token = obter_access_token().await?;
    let cliente = reqwest::Client::new();
    let resposta = cliente
        .get(format!("{ARQUIVOS_URL}/{file_id}"))
        .bearer_auth(&token)
        .query(&[("fields", "modifiedTime")])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resposta.status().is_success() {
        return Err(format!(
            "Falha ao obter metadados do Drive: {}",
            resposta.text().await.unwrap_or_default()
        ));
    }

    let dados: serde_json::Value = resposta.json().await.map_err(|e| e.to_string())?;
    dados
        .get("modifiedTime")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Drive não retornou modifiedTime".to_string())
}

#[tauri::command]
pub async fn drive_enviar_arquivo(
    caminho_local: String,
    nome_remoto: String,
    pasta_pai_id: String,
    file_id_existente: Option<String>,
) -> Result<ArquivoDrive, String> {
    let conteudo = std::fs::read(&caminho_local).map_err(|e| e.to_string())?;
    let token = obter_access_token().await?;
    let cliente = reqwest::Client::new();

    let resposta = if let Some(file_id) = file_id_existente {
        cliente
            .patch(format!("{UPLOAD_URL}/{file_id}"))
            .bearer_auth(&token)
            .query(&[("uploadType", "media"), ("fields", "id,modifiedTime")])
            .body(conteudo)
            .send()
            .await
            .map_err(|e| e.to_string())?
    } else {
        let metadados = json!({ "name": nome_remoto, "parents": [pasta_pai_id] });
        let corpo_multipart = reqwest::multipart::Form::new()
            .part(
                "metadata",
                reqwest::multipart::Part::text(metadados.to_string())
                    .mime_str("application/json; charset=UTF-8")
                    .map_err(|e| e.to_string())?,
            )
            .part("media", reqwest::multipart::Part::bytes(conteudo));

        cliente
            .post(UPLOAD_URL)
            .bearer_auth(&token)
            .query(&[("uploadType", "multipart"), ("fields", "id,modifiedTime")])
            .multipart(corpo_multipart)
            .send()
            .await
            .map_err(|e| e.to_string())?
    };

    if !resposta.status().is_success() {
        return Err(format!(
            "Falha ao enviar arquivo ao Drive: {}",
            resposta.text().await.unwrap_or_default()
        ));
    }

    resposta
        .json::<ArquivoDrive>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn drive_baixar_arquivo(file_id: String, caminho_local: String) -> Result<(), String> {
    let token = obter_access_token().await?;
    let cliente = reqwest::Client::new();
    let resposta = cliente
        .get(format!("{ARQUIVOS_URL}/{file_id}"))
        .bearer_auth(&token)
        .query(&[("alt", "media")])
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !resposta.status().is_success() {
        return Err(format!(
            "Falha ao baixar arquivo do Drive: {}",
            resposta.text().await.unwrap_or_default()
        ));
    }

    let bytes = resposta.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&caminho_local, bytes).map_err(|e| e.to_string())
}

// Exclui um arquivo/pasta no Drive. Excluir a pasta-mãe já apaga em cascata
// os filhos do lado do Drive, então um 404 aqui (item já não existe) é
// tratado como sucesso — não é um erro real, só reflete que outra chamada
// desta mesma sincronização já removeu o item via a pasta-mãe.
#[tauri::command]
pub async fn drive_excluir_arquivo(file_id: String) -> Result<(), String> {
    let token = obter_access_token().await?;
    let cliente = reqwest::Client::new();
    let resposta = cliente
        .delete(format!("{ARQUIVOS_URL}/{file_id}"))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if resposta.status().is_success() || resposta.status() == reqwest::StatusCode::NOT_FOUND {
        return Ok(());
    }

    Err(format!(
        "Falha ao excluir no Drive: {}",
        resposta.text().await.unwrap_or_default()
    ))
}

#[tauri::command]
pub fn hash_arquivo_local(caminho_local: String) -> Result<String, String> {
    let conteudo = std::fs::read(&caminho_local).map_err(|e| e.to_string())?;
    let hash = Sha256::digest(&conteudo);
    Ok(format!("{hash:x}"))
}
