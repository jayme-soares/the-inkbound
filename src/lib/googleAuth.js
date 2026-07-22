import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";

export async function statusLoginGoogle() {
  return invoke("status_login_google");
}

export async function logoutGoogle() {
  return invoke("logout_google");
}

// Abre o navegador do sistema para o consentimento do Google e resolve
// quando o Rust confirma (via evento) que o refresh_token foi salvo.
export async function iniciarLoginGoogle() {
  const urlAutorizacao = await invoke("iniciar_login_google");
  await openUrl(urlAutorizacao);

  return new Promise((resolve, reject) => {
    let pararOk;
    let pararErro;

    const limpar = () => {
      pararOk?.();
      pararErro?.();
    };

    listen("google-login-concluido", () => {
      limpar();
      resolve();
    }).then((fn) => (pararOk = fn));

    listen("google-login-erro", (evento) => {
      limpar();
      reject(new Error(evento.payload));
    }).then((fn) => (pararErro = fn));
  });
}
