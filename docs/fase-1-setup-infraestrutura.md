# Fase 1 — Setup e Infraestrutura

**Status:** Concluída
**Data:** 2026-07-21

## Objetivo

Criar o scaffold inicial do projeto The Inkbound com a stack definida no documento de arquitetura, validando que front-end e back-end nativo compilam corretamente antes de qualquer lógica de negócio.

## Decisões tomadas no planejamento (contexto)

Antes do scaffold, três decisões técnicas foram fechadas em discussão com o autor do projeto:

1. **Armazenamento híbrido:** prosa em `.md` puro; personagens, locais, pistas e timeline em **SQLite local** (via `tauri-plugin-sql`), com IDs estáveis (UUID) em vez de paths como chave de referência entre entidades. Motivo: JSON solto por entidade (proposta original) não suporta bem consultas relacionais como "quais capítulos mencionam este personagem" — o diferencial de "encadeamento de pistas" do produto exige um modelo relacional.
2. **Editor de manuscrito:** Markdown com preview ao vivo (linha Typora), não WYSIWYG. O `.md` continua sendo a fonte única da verdade, sem camada de serialização.
3. **Sem migração de dados:** existe um protótipo anterior em Python/Streamlit (`WriteAnyWhere`, em `C:\Users\jayme\Documents\dev\WriteAnyWhere`) com conceito similar, mas sem dados reais — serve apenas como referência de ideias (ex: fluxo OAuth + Google Drive `appDataFolder`), não como fonte de migração.

## O que foi feito

### Scaffold base
- Projeto criado via `create-tauri-app` em `C:\Users\jayme\Documents\dev\the-inkbound`.
- Stack: Tauri 2 + React 19 + Vite 7, JavaScript puro (sem TypeScript), conforme documento original.

### Dependências de front-end instaladas
- `tailwindcss` + `@tailwindcss/vite` (Tailwind v4, plugin nativo do Vite)
- `framer-motion`
- `lucide-react`
- `zustand` (ainda não utilizado em código — reservado para a Fase 2, gerenciamento de estado da navegação Dashboard/Workspace)

### Plugins nativos Tauri (Rust + bindings JS)
- `tauri-plugin-fs` — leitura/escrita/CRUD de arquivos e pastas no disco
- `tauri-plugin-dialog` — seleção de pastas/arquivos via diálogo nativo
- `tauri-plugin-sql` (feature `sqlite`) — banco SQLite embutido

Registrados em [`src-tauri/src/lib.rs`](../src-tauri/src/lib.rs).

### Permissões (capabilities)
Configuradas em [`src-tauri/capabilities/default.json`](../src-tauri/capabilities/default.json):
- Permissões de leitura/escrita/mkdir/remove/rename/exists/read-dir/copy do plugin `fs`
- Escopo de acesso a disco: **`$DOCUMENT/**` e `$APPDATA/**`**
- Permissões `dialog:default`
- Permissões `sql:default`, `sql:allow-execute`, `sql:allow-select`, `sql:allow-load`

> ⚠️ **Pendência para a Fase 3:** o escopo de `fs` foi definido de forma ampla e provisória (`$DOCUMENT/**`, `$APPDATA/**`) só para permitir o build. Precisa ser revisado quando decidirmos onde os projetos do usuário realmente residem no disco (pasta fixa em Documentos? pasta escolhida via diálogo na criação do projeto?).

### Limpeza de boilerplate
- Removido o comando de exemplo `greet` (Rust) e sua chamada via `invoke` no front-end.
- Removidos `App.css` e o logo do React (não usados).
- Tela inicial ([`src/App.jsx`](../src/App.jsx)) substituída por um placeholder mínimo que confirma Tailwind, Framer Motion e Lucide funcionando.

## Validação executada

| Verificação | Comando | Resultado |
|---|---|---|
| Build do front-end | `npm run build` | OK — CSS do Tailwind gerado com 6.56 kB (não vazio, confirma que as classes utilitárias estão sendo processadas) |
| Compilação do back-end Rust | `cargo check` (em `src-tauri`) | OK — compila sem erros com os 3 plugins novos (`fs`, `dialog`, `sql`) |

Não foi executado `tauri dev` (abre janela nativa) nesta etapa — build e checagem de tipos/compilação foram suficientes para validar o scaffold.

## Estrutura de arquivos relevante após a Fase 1

```
the-inkbound/
├── docs/
│   └── fase-1-setup-infraestrutura.md
├── src/
│   ├── App.jsx          # placeholder validando Tailwind + Framer Motion + Lucide
│   ├── main.jsx
│   └── index.css        # @import "tailwindcss"
├── src-tauri/
│   ├── src/lib.rs        # registro dos plugins fs, dialog, sql
│   ├── capabilities/default.json  # permissões
│   └── Cargo.toml        # dependências Rust (fs, dialog, sql/sqlite)
├── vite.config.js        # plugin @tailwindcss/vite
└── package.json
```

## Próxima fase

Fase 2 — Fundação do Front-end (macro-navegação Dashboard ↔ Workspace via `projetoAtivo`, store Zustand). **Aguardando autorização para iniciar.**
