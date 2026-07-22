# Fase 3 — O Motor Local (Tauri FS)

**Status:** Implementada e validada. Correção de bug em 2026-07-21 (ver "Correção" abaixo).
**Data:** 2026-07-21

## Correção: não era possível excluir um projeto (2026-07-21)

**Bug:** ao tentar excluir um projeto pelo Dashboard, a exclusão falhava silenciosamente ou com erro de I/O.

**Causa:** o `tauri-plugin-sql` mantém o pool de conexões SQLite aberto indefinidamente depois de qualquer `Database.load()` — não existe fechamento automático até o app inteiro ser encerrado. Como `listarProjetos()` abre o `inkbound.db` de cada projeto só para ler os metadados do card (e nunca fechava), o arquivo ficava com um handle aberto no processo. No Windows, isso impede excluir ou mover o arquivo (e, por extensão, a pasta que o contém) enquanto o handle não é liberado.

**Correção:** adicionada `fecharBancoProjeto()` em [`db.js`](../src/lib/db.js), chamada em três pontos deliberados de transição de estado: (1) ao final de `criarProjetoNoDisco()`, depois do insert inicial; (2) em `excluirProjetoNoDisco()`, imediatamente antes de remover a pasta do disco; (3) em `fecharProjeto()` da store, ao voltar do Workspace para o Dashboard.

**Efeito colateral descoberto e corrigido:** a primeira versão da correção também fechava a conexão dentro do loop de `listarProjetos()`, logo depois de ler cada card. Isso quebrou sob concorrência: o app usa `React.StrictMode`, que no modo dev dispara `useEffect` duas vezes de propósito — então duas chamadas de `carregarProjetos()` corriam em paralelo, e como o `tauri-plugin-sql` sempre abre uma conexão nova a cada `Database.load()` (sobrescrevendo a mesma entrada no mapa por caminho), uma chamada fechava o pool que a outra ainda estava lendo, gerando `attempted to acquire a connection on a closed pool`. Removido o fechamento de dentro do loop de listagem — os três pontos deliberados acima são suficientes para o bug original (exclusão bloqueada) e não competem entre si.

## Objetivo

Substituir os dados mock da Fase 2 por leitura/escrita real no disco: projetos passam a ser pastas reais em `Documentos/The Inkbound/`, com metadados em SQLite e CRUD real de arquivos/pastas na sidebar.

## Decisão tomada antes da implementação

Perguntei ao autor onde os projetos deveriam residir no disco. Resposta: **pasta fixa em Documentos**, com o Dashboard descobrindo projetos escaneando essa pasta (em vez de raiz configurável ou escolha de pasta por projeto). Isso também simplifica a futura sincronização com Google Drive (Fase 5), já que tudo fica sob uma raiz única e conhecida.

## Modelo de dados por projeto

Cada projeto é uma pasta em `Documentos/The Inkbound/<slug-do-titulo>/`, contendo:

```
<slug-do-projeto>/
├── inkbound.db       # SQLite: metadados do projeto + fichamentos
├── Rascunhos/         # pasta padrão, criada automaticamente
└── Pesquisa/          # pasta padrão, criada automaticamente
```

- **`inkbound.db`** guarda a tabela `projeto` (id, titulo, genero, data_criacao, contagem_palavras) e já inclui as tabelas `personagens` e `localidades` definidas no schema (vazias por enquanto — os formulários de fichamento entram na Fase 4). Ficou de fora por ora: `pistas` e `eventos_timeline` — são conceitos de visão do produto (seção 1 do documento) mas não têm um formulário de MVP definido na seção 4, então adicionar essas tabelas agora seria desenhar campos sem saber a forma real que vão assumir. Ficam para quando o fichamento delas for desenhado.
- **Slug do projeto:** gerado a partir do título (`slugify`), sem acentos, minúsculo, com deduplicação automática (`-2`, `-3`, ...) se já existir uma pasta com o mesmo nome.
- **Descoberta de projetos:** o Dashboard escaneia `Documentos/The Inkbound/`; qualquer subpasta que contenha `inkbound.db` é tratada como projeto válido.

## Por que "Personagens" não é mais uma pasta automática

Na Fase 1 decidimos que personagens e localidades (seção 4.4 do documento) vivem em SQLite, não como arquivos `.json` soltos. Consequência direta: a pasta "Personagens" citada como exemplo na seção 3.2 do documento não faz mais sentido como pasta *auto-criada*, porque não existem arquivos de personagem para colocar nela — o fichamento é feito por formulário (Fase 4), não por arquivo. As pastas padrão auto-criadas ficaram reduzidas a **Rascunhos** e **Pesquisa** (conteúdo textual). O usuário continua livre para criar manualmente qualquer pasta extra pela sidebar, inclusive uma "Personagens" para notas soltas em markdown, se quiser — isso é ortogonal ao fichamento estruturado.

## O que foi implementado

### Módulos de acesso a disco/banco (`src/lib/`)
- [`paths.js`](../src/lib/paths.js) — raiz do app (`Documentos/The Inkbound`), `slugify`, geração de slug único.
- [`db.js`](../src/lib/db.js) — abre/cria o SQLite do projeto e aplica o schema (`CREATE TABLE IF NOT EXISTS`).
- [`projetos.js`](../src/lib/projetos.js) — `listarProjetos`, `criarProjetoNoDisco` (cria pastas + banco + linha `projeto`, com rollback removendo a pasta se qualquer passo falhar), `excluirProjetoNoDisco`.
- [`arvoreArquivos.js`](../src/lib/arvoreArquivos.js) — `listarEntradas`, `criarPasta`, `criarArquivo`, `excluirEntrada` (cascata via `remove(..., {recursive:true})`), `renomearEntrada`. Todas com proteção contra sobrescrever um item existente com o mesmo nome.

### Store (Zustand)
[`useAppStore.js`](../src/store/useAppStore.js) — `projetos` agora vem de disco (`carregarProjetos`), `criarProjeto`/`excluirProjeto` são assíncronos e operam em disco + banco de verdade. Adicionados `carregando` e `erro` para refletir o novo caso real de falha de I/O.

### Dashboard
Passa a chamar `carregarProjetos()` no mount, exibe estado de carregamento e erros de disco. Criação/exclusão de projeto agora é assíncrona, com feedback de erro no modal.

### Sidebar (Workspace)
Reescrita por completo: árvore real do sistema de arquivos, com **lazy loading** (subpastas só são lidas quando expandidas, para não escanear tudo de uma vez). Suporta:
- Criar pasta/arquivo `.md` (na raiz do projeto ou dentro de qualquer pasta)
- Renomear (duplo clique no nome → edição inline)
- Excluir (com cascata para pastas)

**Não implementado nesta fase:** mover itens por drag-and-drop. O requisito 4.2 do documento pede "criar, renomear, mover e excluir" — mover ficou de fora deliberadamente porque drag-and-drop com reordenação é um bloco de trabalho de UI separado e não crítico para validar o motor de FS. Fica como pendência explícita, não um esquecimento.

## Validação executada

| Verificação | Método | Resultado |
|---|---|---|
| Lógica de slug (acentos, duplicatas) | Teste isolado via Node (`slugify("Sombras em Belém")` → `sombras-em-belem`) | OK |
| Build do front-end | `npm run build` | OK, sem erros |
| Boot do runtime completo (Rust + WebView) | `npm run tauri dev` | Ver observação abaixo |

### Observação importante sobre o alcance da validação automatizada

A partir desta fase, o app depende de APIs nativas (`@tauri-apps/plugin-fs`, `@tauri-apps/plugin-sql`) que só funcionam dentro do runtime real do Tauri — **não** funcionam abrindo `localhost:1420` num navegador comum, porque não existe a ponte de IPC com o Rust nesse contexto. Isso significa que a técnica usada na Fase 2 (abrir o Vite dev server na aba de navegador e clicar) não serve mais para testar leitura/escrita real de disco.

Consegui confirmar que o binário compila e o processo `tauri dev` sobe sem panics/erros de inicialização, mas **não tenho como clicar dentro da janela nativa** para simular o fluxo completo (criar projeto → ver pasta aparecer em `Documentos/The Inkbound` → abrir Workspace → criar/renomear/excluir arquivos na sidebar). Essa verificação interativa precisa ser feita manualmente.

## Próxima fase

Fase 4 — Editor e Lógica de Negócio (editor Markdown + preview, autosave, contagem de palavras, Focus Mode, formulários de fichamento de personagens/localidades gravando no SQLite). **Aguardando autorização para iniciar** — e, idealmente, sua confirmação de que o fluxo desta fase funcionou na prática.
