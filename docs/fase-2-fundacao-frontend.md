# Fase 2 — Fundação do Front-end

**Status:** Concluída
**Data:** 2026-07-21

## Objetivo

Implementar a macro-navegação entre os dois contextos definidos no documento de arquitetura (seção 3): Dashboard Global (`projetoAtivo === null`) e Workspace Isolado (`projetoAtivo !== null`), com gerenciamento de estado local via Zustand.

## O que foi feito

### Store global (Zustand)
[`src/store/useAppStore.js`](../src/store/useAppStore.js) — única fonte de verdade da navegação e dos dados de projeto nesta fase:

- `projetoAtivo`: objeto do projeto aberto ou `null`. É exatamente o flag que decide qual tela renderizar.
- `projetos`: lista de projetos em memória (mock — ver "Pendências" abaixo).
- `termoBusca`: texto do campo de busca do Dashboard.
- Ações: `criarProjeto`, `excluirProjeto`, `abrirProjeto`, `fecharProjeto`, `setTermoBusca`.

### Dashboard Global
- [`src/components/dashboard/Dashboard.jsx`](../src/components/dashboard/Dashboard.jsx) — grid de cards de projeto (título, gênero, contagem de palavras, data de criação — conforme requisito 4.1 do documento), campo de busca com filtro em tempo real, botão "Novo projeto" e exclusão por card (com confironClick isolado via `stopPropagation`).
- [`src/components/dashboard/NewProjectModal.jsx`](../src/components/dashboard/NewProjectModal.jsx) — formulário modal simples (título, gênero) que despacha `criarProjeto` na store.

### Workspace Isolado
- [`src/components/workspace/Workspace.jsx`](../src/components/workspace/Workspace.jsx) — layout de duas colunas (sidebar + área principal) com breadcrumb e botão para voltar ao Dashboard (`fecharProjeto`).
- [`src/components/workspace/Sidebar.jsx`](../src/components/workspace/Sidebar.jsx) — árvore de pastas/arquivos **estática (mock)**, com expand/collapse, só para validar o layout da navegação em árvore descrita na seção 3.2.

### App.jsx
Reduzido a um switch direto sobre a store:
```jsx
return projetoAtivo ? <Workspace /> : <Dashboard />;
```
Espelha literalmente a regra de estados mutuamente exclusivos da seção 3 do documento.

## Pendências explícitas para a Fase 3

- **`projetos` e a árvore da sidebar são dados mock em memória** — não persistem entre reinícios do app e não têm nenhuma relação com o disco ainda. A Fase 3 substitui isso por leitura/escrita real via `tauri-plugin-fs`, criação da estrutura de pastas padronizada por projeto, e populamento do SQLite para as entidades relacionais (personagens, locais, pistas, timeline) combinadas na Fase 1.
- **Escopo de permissões `fs`** (`$DOCUMENT/**`, `$APPDATA/**`, definido na Fase 1) ainda não foi validado contra um caso real de leitura/escrita — só foi compilado. Precisa ser exercitado na Fase 3.
- Sem persistência = ao recarregar o app, todos os projetos criados na sessão são perdidos. Isso é esperado nesta fase.

## Validação executada

| Verificação | Método | Resultado |
|---|---|---|
| Build de produção | `npm run build` | OK — sem erros, bundle CSS cresceu de 6.56 kB para 11.59 kB (novos componentes/estilos aplicados) |
| Fluxo funcional no navegador (via Browser pane, `npm run dev` + Vite em `localhost:1420`) | Criar projeto → card aparece com metadados corretos → abrir projeto → Workspace renderiza sidebar mock e breadcrumb → voltar → projeto ainda listado → excluir → lista volta a vazio | OK — nenhum erro de console em nenhuma etapa |

## Próxima fase

Fase 3 — O Motor Local (Tauri FS): substituir os dados mock por chamadas reais de leitura/escrita no disco, implementar CRUD real de pastas/arquivos e decidir definitivamente o diretório-base dos projetos (o que também resolve a pendência de escopo `fs` da Fase 1). **Aguardando autorização para iniciar.**
