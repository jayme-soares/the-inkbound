# The Inkbound

*from writers to writers*

A Windows desktop app for fiction writers. Keep an entire writing project — chapters, character sheets, locations — organized in a local folder, with live preview, autosave, and optional cloud sync.

**[🇬🇧 English](#english) · [🇧🇷 Português](#português)**

---

## English

### What it does

The Inkbound organizes each writing project as a plain folder on your disk: chapters are Markdown files (so they're readable and portable with or without the app), and character/location sheets live in a small local database inside the project folder. Nothing is locked into a proprietary format.

- **Distraction-free editor** with live Markdown preview, a formatting toolbar (bold, italic, underline, scene breaks), word/character count, and a focus mode that hides everything but the page.
- **Customizable writing surface** — pick a serif, sans-serif, or monospace font and adjust the text size to your taste.
- **Version history** per chapter, with automatic checkpoints as you write and manual ones on demand — restoring never overwrites without first saving a safety checkpoint of the current text.
- **Daily writing goals** — set a words-per-day target per project and track today's progress at a glance.
- **Character & location sheets** to keep track of your story bible alongside the manuscript.
- **Manuscript export** to PDF and Word (`.docx`), formatted to publisher-submission standards: title page, running header with page numbers, double line spacing, page break per chapter.
- **Optional Google Drive sync** to keep a project in sync across multiple computers.
- **Interface in English or Portuguese**, light or dark theme.

### Installing

1. Go to [Releases](https://github.com/jayme-soares/the-inkbound/releases) and download the latest `the-inkbound_x.y.z_x64-setup.exe`.
2. Run the installer. The installer isn't code-signed, so Windows SmartScreen may warn you — click **"More info" → "Run anyway"**.
3. Launch The Inkbound from the Start menu.

The app checks for new releases automatically on startup (a small dot appears on the settings icon when one's available) — no need to keep checking here manually.

### Getting started

- Create a new project from the Dashboard — give it a title and (optionally) a genre.
- Open it and start writing under the **Writing** tab; chapters are organized as files/folders in the sidebar.
- Use the **Sheets** tab for characters and locations.
- When a chapter (or the whole manuscript) is ready, use the **Export** tab to generate a PDF or Word file.
- To sync across devices, connect a Google account from the Dashboard — the same project will then be available anywhere you're signed in.
- Fullscreen, font, language, and theme preferences live behind the gear icon (Settings).

---

## Português

### O que o app faz

O The Inkbound organiza cada projeto de escrita como uma pasta comum no seu disco: os capítulos são arquivos Markdown (legíveis e portáveis, com ou sem o app), e as fichas de personagens/localidades ficam num banco de dados local dentro da própria pasta do projeto. Nada fica preso a um formato proprietário.

- **Editor sem distrações** com preview de Markdown ao vivo, toolbar de formatação (negrito, itálico, sublinhado, quebra de cena), contagem de palavras/caracteres, e um modo foco que esconde tudo, menos a página.
- **Área de escrita personalizável** — escolha entre fonte serifada, sem serifa ou monoespaçada, e ajuste o tamanho do texto.
- **Histórico de versões** por capítulo, com checkpoints automáticos durante a escrita e manuais sob demanda — restaurar uma versão antiga nunca sobrescreve sem antes salvar um checkpoint de segurança do texto atual.
- **Metas de escrita** — defina uma meta de palavras por dia para cada projeto e acompanhe o progresso de hoje rapidamente.
- **Fichas de personagens e localidades** para manter a bíblia da história junto do manuscrito.
- **Exportação de manuscrito** para PDF e Word (`.docx`), formatado nos padrões de submissão a editoras: folha de rosto, cabeçalho corrente com número de página, espaçamento duplo, quebra de página por capítulo.
- **Sincronização opcional via Google Drive** para manter um projeto atualizado em vários computadores.
- **Interface em português ou inglês**, tema claro ou escuro.

### Instalando

1. Acesse [Releases](https://github.com/jayme-soares/the-inkbound/releases) e baixe o `the-inkbound_x.y.z_x64-setup.exe` mais recente.
2. Rode o instalador. Ele não é assinado digitalmente, então o SmartScreen do Windows pode alertar — clique em **"Mais informações" → "Executar assim mesmo"**.
3. Abra o The Inkbound pelo menu Iniciar.

O app verifica novas versões automaticamente ao abrir (um pontinho dourado aparece no ícone de configurações quando há uma nova) — não é preciso checar aqui manualmente.

### Primeiros passos

- Crie um novo projeto pelo Dashboard — dê um título e, opcionalmente, um gênero.
- Abra-o e comece a escrever na aba **Escrita**; os capítulos ficam organizados como arquivos/pastas na barra lateral.
- Use a aba **Fichas** para personagens e localidades.
- Quando um capítulo (ou o manuscrito inteiro) estiver pronto, use a aba **Exportar** para gerar um PDF ou Word.
- Para sincronizar entre dispositivos, conecte uma conta Google pelo Dashboard — o mesmo projeto passa a ficar disponível em qualquer lugar em que você estiver conectado.
- As preferências de tela cheia, fonte, idioma e tema ficam atrás do ícone de engrenagem (Configurações).

---

## Development

Prerequisites: [Node.js](https://nodejs.org/), [Rust](https://www.rust-lang.org/tools/install), and the [Tauri prerequisites for Windows](https://tauri.app/start/prerequisites/) (MSVC Build Tools + WebView2).

```bash
npm install
npm run tauri dev
```

Google Drive login requires a `src-tauri/google-oauth.json` file (never committed) with OAuth credentials from a Google Cloud Console project:

```json
{
  "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  "client_secret": "YOUR_CLIENT_SECRET"
}
```

Full steps to generate those credentials are in [`docs/fase-5-cloud-sync.md`](docs/fase-5-cloud-sync.md). Without this file the app runs fine — only the "Connect to Google Drive" button stays unavailable — but **a release build will fail to compile**, since the credentials are embedded into the binary at build time.

To produce the Windows installer:

```bash
npm run tauri build
```

This generates an NSIS installer (`.exe`) under `src-tauri/target/release/bundle/nsis/`.

Stack: React 19 + Vite 7 + Tailwind CSS v4 + Zustand + Framer Motion on the front end, Tauri 2 (Rust) as the native shell, Markdown files + a local SQLite database per project (`tauri-plugin-sql`) for storage, and `i18next`/`react-i18next` for the pt-BR/en interface. The development history and design decisions behind each phase are documented in [`docs/`](docs) (in Portuguese).
