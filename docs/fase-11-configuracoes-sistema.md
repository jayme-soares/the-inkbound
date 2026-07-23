# Fase 11 — Configurações do Sistema

**Status:** Concluída e validada pelo autor.
**Data:** 2026-07-22

## Objetivo

Primeira tela de configurações do app: iniciar em tela cheia, gerenciar a conexão com o Google Drive num lugar mais seguro (sem risco de desconectar sem querer), e verificação de atualização via GitHub Releases.

## Decisões tomadas com o autor

- **Desconectar do Google Drive saiu do botão do cabeçalho e foi para dentro de Configurações.** O botão do cabeçalho do Dashboard (`ContaGoogle.jsx`) continua mostrando o status e permitindo *conectar*, mas quando já conectado vira só um indicador (não-clicável) — evita que um clique acidental no ícone do cabeçalho derrube a sincronização sem querer. Desconectar de propósito agora exige abrir Configurações.
- **Verificação de atualização: automática ao abrir + botão manual.** Roda em segundo plano no carregamento inicial (não bloqueia a tela de carregamento) e mostra um indicador discreto (um ponto dourado no ícone de engrenagem) se houver versão nova — sem popup, sem interromper o autor. Também dá pra forçar a qualquer momento pelo botão "Verificar" dentro de Configurações.
- **Comparação de versão contra as GitHub Releases** (não um servidor próprio de atualização) — reaproveita a infraestrutura de distribuição já criada na Fase 8, sem introduzir um novo serviço. Como o repositório estava privado no momento da implementação, a checagem falhava (API pública do GitHub não enxerga releases de repo privado sem autenticação) — comportamento esperado, tratado silenciosamente (sem alarmar o autor por uma falha de rede/permissão numa checagem em segundo plano). O autor tornou o repositório público durante a validação desta fase justamente para testar o fluxo completo, e confirmou funcionando.

## O que foi implementado

### Estado compartilhado (stores Zustand, mesmo padrão de `useTemaStore`/`useIdiomaStore`)
- [`useConfiguracoesStore.js`](../src/store/useConfiguracoesStore.js) — preferência `telaCheiaAoIniciar`, persistida em `localStorage`.
- [`useContaGoogleStore.js`](../src/store/useContaGoogleStore.js) — levanta o estado que antes vivia só dentro de `ContaGoogle.jsx` (`conectado`/`carregando`/`erro`/`conectar`/`desconectar`) para uma store, porque agora dois lugares diferentes (botão do cabeçalho e painel de Configurações) precisam refletir o mesmo estado em tempo real — desconectar em Configurações precisa atualizar o cabeçalho na hora, sem reload.
- [`useAtualizacaoStore.js`](../src/store/useAtualizacaoStore.js) — resultado da última verificação de atualização (`ocioso`/`verificando`/`atualizado`/`disponivel`/`erro`), consumido tanto pelo indicador discreto no ícone quanto pelo painel.

### Tela cheia
`App.jsx` lê `useConfiguracoesStore` no carregamento inicial e chama `getCurrentWindow().setFullscreen(true)` (API nativa do Tauri) se a preferência estiver marcada. Permissão `core:window:allow-set-fullscreen` adicionada em `capabilities/default.json` (comandos de janela não vêm liberados por padrão em `core:default`).

### Verificação de atualização
[`src/lib/atualizacoes.js`](../src/lib/atualizacoes.js) — `verificarAtualizacao()` busca `getVersion()` (versão instalada, via `@tauri-apps/api/app`) e a última Release do GitHub (`GET /repos/jayme-soares/the-inkbound/releases/latest`, `fetch` direto do JS — sem necessidade de um comando Rust, já que não envolve nenhum segredo e o `csp: null` do app não bloqueia chamadas externas), compara por uma função simples de comparação de versão (`major.minor.patch`, sem precisar de uma lib de semver inteira para um esquema tão simples).

### Painel de Configurações
[`src/components/Configuracoes.jsx`](../src/components/Configuracoes.jsx) — ícone de engrenagem nos cabeçalhos do Dashboard e do Workspace (ao lado de `ToggleIdioma`/`ToggleTema`), abrindo um modal com três seções: tela cheia (checkbox), conta (status + desconectar), atualizações (versão atual, botão verificar, link de download quando há versão nova via `openUrl` do `@tauri-apps/plugin-opener` — mesmo padrão já usado pelo fluxo de login do Google na Fase 5).

## Validação executada

| Verificação | Método | Resultado |
|---|---|---|
| Build do front-end | `npm run build` | OK |
| Compilação do back-end Rust | `cargo check` | OK (nenhum código Rust novo nesta fase, só a permissão de capabilities) |
| Paridade de chaves i18n | Verificação `pt-BR.json`/`en.json` | OK |
| Tela cheia ao iniciar | Teste manual do autor | **Confirmado funcionando** |
| Desconectar só via Configurações (clique no cabeçalho não desconecta mais) | Teste manual do autor | **Confirmado funcionando** |
| Verificação de atualização (com o repositório tornado público pelo autor para o teste) | Teste manual do autor | **Confirmado funcionando** |
