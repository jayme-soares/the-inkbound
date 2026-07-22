# The Inkbound

Aplicativo desktop para Windows voltado a escritores de ficção: organiza um projeto de escrita inteiro (capítulos em Markdown, fichas de personagens e localidades) numa pasta local, com preview ao vivo, autosave, contagem de palavras, modo foco e sincronização opcional com o Google Drive.

## Stack

- **Front-end:** React 19 + Vite 7 + Tailwind CSS v4 + Zustand + Framer Motion
- **Back-end nativo:** Tauri 2 (Rust)
- **Dados:** arquivos `.md` no disco (fonte da verdade da prosa) + SQLite local por projeto (`tauri-plugin-sql`) para fichas de personagens/localidades
- **Nuvem (opcional):** OAuth2 com Google e sincronização de arquivos via Google Drive API
- **i18n:** `i18next` / `react-i18next` — português (pt-BR) e inglês (en)

O histórico de decisões de cada etapa do desenvolvimento está documentado em [`docs/`](docs).

## Rodando em desenvolvimento

Pré-requisitos: [Node.js](https://nodejs.org/), [Rust](https://www.rust-lang.org/tools/install) e os [pré-requisitos do Tauri para Windows](https://tauri.app/start/prerequisites/) (MSVC Build Tools + WebView2).

```bash
npm install
npm run tauri dev
```

Isso abre a janela nativa do app com hot-reload do front-end.

### Login com Google Drive (opcional)

O login com Google só funciona se existir um arquivo `src-tauri/google-oauth.json` (nunca versionado, fora do `.gitignore`) com credenciais OAuth de um projeto no Google Cloud Console:

```json
{
  "client_id": "SEU_CLIENT_ID.apps.googleusercontent.com",
  "client_secret": "SEU_CLIENT_SECRET"
}
```

O passo a passo completo de como gerar essas credenciais está em [`docs/fase-5-cloud-sync.md`](docs/fase-5-cloud-sync.md). Sem esse arquivo, o app funciona normalmente — só o botão "Conectar ao Google Drive" fica indisponível, e **a build de produção falha** (as credenciais são embutidas no binário em tempo de compilação).

## Gerando o instalador Windows

```bash
npm run tauri build
```

Gera um instalador NSIS (`.exe`) em `src-tauri/target/release/bundle/nsis/`. Requer o `google-oauth.json` descrito acima presente antes de compilar.
