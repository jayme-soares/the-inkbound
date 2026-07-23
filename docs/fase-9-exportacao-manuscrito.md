# Fase 9 — Exportação de Manuscrito (PDF + Word)

**Status:** Concluída e validada pelo autor (ambos os formatos).
**Data:** 2026-07-22

## Objetivo

Exportar os capítulos de um projeto para PDF e Word (`.docx`) formatados segundo convenções padrão de submissão de manuscrito de ficção a editoras (folha de rosto com título/autor/contato/contagem de palavras, cabeçalho corrente com autor/título/página a partir da segunda página, espaço duplo, quebra de página por capítulo, marcação de quebra de cena). Sinalizado pelo autor como prioridade "crucial" ao retomar o trabalho após as Fases 7/8 (i18n e distribuição).

EPUB ficou deliberadamente fora do escopo desta fase — serve a um propósito diferente (leitura em e-reader, não submissão a editora) e fica para uma entrega separada e menor.

## Decisões tomadas antes da implementação

- **Ordem dos capítulos: não persistida.** Não existe hoje nenhuma infraestrutura de reconciliação de identidade de arquivo (renomear/mover/excluir) que tornaria uma ordem persistida confiável — a sidebar sempre ordenou puramente por nome (`localeCompare`). Em vez de construir essa reconciliação, a tela de exportação recalcula a lista (ordem alfabética como padrão) toda vez que abre, com reordenação manual via setas (sem drag-and-drop) que dura só a sessão. Se isso se mostrar incômodo na prática, persistir é um adicional pequeno e isolado depois, não uma reestruturação.
- **Autor e contato: novos campos em `projeto`**, adicionados via migração idempotente (ver abaixo), editados diretamente na aba Exportar — não foi criada uma tela de "configurações do projeto" separada só para isso.
- **Parsing de Markdown: reaproveita o `marked` já usado no preview do editor**, em vez de adicionar um parser Rust (`pulldown-cmark`). O token stream do `marked.lexer()` é achatado em `src/lib/exportarManuscrito.js` para uma estrutura `{ tipo, runs: [{texto, negrito, italico}] }` enviada ao Rust — evita ter dois parsers de Markdown divergindo em casos de borda (ex: heurística de quebra de cena).
- **Fonte do PDF: lida da instalação real do Windows** (`C:\Windows\Fonts\times.ttf` e variantes), não uma fonte substituta embutida no instalador. A Times New Roman da Microsoft não pode ser redistribuída, e o projeto está focado só em Windows por enquanto — decisão tomada com o autor, documentada como dependência aceitável nesse escopo (revisitar se um dia houver build para macOS/Linux).
- **Crates Rust escolhidas com o critério explícito de peso de build**: a máquina de desenvolvimento tem só ~8GB de RAM (frequentemente ~2GB livres), e um build de release já precisou de `CARGO_BUILD_JOBS=1` por causa do C bundlado do `libsqlite3-sys` (ver `fase-8`). Por isso, qualquer crate nova precisava ser Rust puro, sem dependência de compilação de C/C++ pesada:
  - **DOCX:** [`docx-rs`](https://crates.io/crates/docx-rs) 0.4.22 — zip/xml em Rust puro.
  - **PDF:** [`genpdf`](https://crates.io/crates/genpdf) 0.2.0 (sobre `printpdf`) — Rust puro, com paginação e decorador de página já prontos (evita reimplementar isso sobre `printpdf` cru). Risco de manutenção mais leve sinalizado antes de adotar; validado com um spike de compilação isolado antes de escrever a lógica de geração (ver "Validação").

## O que foi implementado

### Migração de schema (`src/lib/db.js`)
`projeto` ganhou as colunas `autor` e `contato` (nullable). Como o projeto só usa `CREATE TABLE IF NOT EXISTS` (sem sistema de migração), bancos de projetos já existentes precisavam de um `ALTER TABLE` explícito — adicionado `aplicarMigracoesColuna()`, que checa via `PRAGMA table_info` antes de tentar adicionar cada coluna (idempotente, roda a cada abertura de conexão). [`src/lib/projetos.js`](../src/lib/projetos.js) ganhou `atualizarAutorContato()`.

### Parsing e payload (`src/lib/exportarManuscrito.js`)
`montarPayloadExportacao()` lê cada arquivo `.md` incluído (na ordem escolhida pelo usuário), roda `marked.lexer()`, achata os tokens inline (`strong`/`em` aninhados) numa lista de runs com negrito/itálico resolvidos, e soma a contagem de palavras (via `contarPalavras` já existente) só dos arquivos incluídos — não usa `projeto.contagem_palavras`, que reflete o projeto inteiro incluindo notas de pesquisa excluídas da exportação. Tipos de bloco não tratados explicitamente (lista, citação etc.) caem num fallback que os transforma em parágrafo, para nunca sumir conteúdo silenciosamente.

### Tela de exportação (aba nova no Workspace)
- [`src/hooks/useExportarManuscrito.js`](../src/hooks/useExportarManuscrito.js) — carrega os `.md` do projeto via `caminharArvore` (mesma função já usada pela sincronização com o Drive), com arquivos em `Pesquisa/` desmarcados por padrão; expõe reordenação (`mover`), inclusão/exclusão, campos autor/contato e a função `exportar(formato)`.
- [`src/components/workspace/ExportarManuscrito.jsx`](../src/components/workspace/ExportarManuscrito.jsx) — lista reordenável (setas cima/baixo) com checkbox por arquivo, campos de autor/contato, botões "Exportar PDF"/"Exportar Word".
- [`Workspace.jsx`](../src/components/workspace/Workspace.jsx) ganhou uma terceira aba ("Exportar"), ao lado de "Escrita"/"Fichas".
- Destino do arquivo escolhido via `save()` do `@tauri-apps/plugin-dialog` (primeira vez que esse plugin é usado do lado JS neste projeto — permissão `dialog:allow-save` adicionada em `capabilities/default.json`).

### Geração dos documentos (Rust, [`src-tauri/src/exportacao.rs`](../src-tauri/src/exportacao.rs))
Dois comandos, `exportar_manuscrito_docx` e `exportar_manuscrito_pdf`, recebendo o mesmo payload estruturado (`Manuscrito { titulo, autor, contato, contagem_palavras, capitulos: [{ titulo, blocos }] }`) e escrevendo o arquivo direto no destino escolhido (`std::fs::File`/`render_to_file`, mesmo padrão de I/O já usado em `google_drive.rs`).

- **DOCX** (`docx-rs`): folha de rosto (contato à esquerda, contagem de palavras à direita, título e "por {autor}" centralizados), cabeçalho corrente via `Header`/`first_header` (o `first_header` vazio ativa o `title_pg` do OOXML, suprimindo o cabeçalho na folha de rosto), número de página como campo nativo do Word (`PageNum`, recalculado automaticamente, não um número estático), espaço duplo (`LineSpacing` com `line(480)`), margens de 3cm, quebra de página por capítulo (`page_break_before`).
- **PDF** (`genpdf`): mesma estrutura de folha de rosto e capítulos; cabeçalho corrente via `SimplePageDecorator::set_header`, que recebe o número da página em cada chamada e retorna vazio na página 1; espaço duplo (`set_line_spacing(2.0)`); fonte Times New Roman copiada de `C:\Windows\Fonts` para uma pasta temporária com a convenção de nomes que o `genpdf` exige (`TimesNewRoman-Regular.ttf` etc.).
- Blocos de "título" dentro do corpo do texto (headings do Markdown que não são o nome do capítulo) recebem negrito e centralização; quebras de cena (`---`/`***`) viram um `***` centralizado.

## Validação executada

| Verificação | Método | Resultado |
|---|---|---|
| Compatibilidade das crates novas com a máquina (RAM limitada) | Spike isolado: `cargo add docx-rs genpdf` + `cargo check` antes de escrever a lógica de geração | OK — compilou sem repetir o problema de memória do `libsqlite3-sys` (ver fase-8) |
| API exata do `docx-rs`/`genpdf` | Leitura direta do código-fonte das crates (já baixado em cache local), não por suposição de treinamento | Confirmado: `Docx::pack`, `Header`/`first_header`/`PageNum`, `SimplePageDecorator::set_header`, `fonts::from_files` com a convenção de nomes exata |
| Build do front-end | `npm run build` | OK |
| Compilação do back-end Rust | `cargo check` | OK, sem warnings (após remover um campo não lido do enum `Bloco`) |
| Paridade de chaves i18n (`exportar.*`) | Verificação de chaves entre `pt-BR.json`/`en.json` | OK |
| Fluxo completo na janela nativa | Teste manual do autor: abrir projeto, ir na aba Exportar, marcar/reordenar capítulos, exportar PDF e Word | **Confirmado funcionando para os dois formatos** |

## Pendências conhecidas (fora do escopo desta entrega)

- **EPUB** — fase separada, planejada para depois.
- **Posicionamento exato do título do capítulo na página** (hoje é uma aproximação com parágrafos em branco antes do título, não um cálculo de posição real) — aceitável para o padrão genérico adotado, pode ser refinado se uma editora específica exigir algo mais preciso.
- **Fonte do PDF depende do Windows** (lê `C:\Windows\Fonts` diretamente) — documentado como aceitável enquanto o app for só para Windows; precisaria de uma fonte substituta redistribuível (ex: Liberation Serif) se um dia houver build para outro SO.
- Cabeçalho vazio na página 1 do PDF ainda ocupa uma linha em branco (limitação da API do `genpdf` — o decorador de página precisa retornar o mesmo tipo em toda página, não dá pra "não renderizar nada" condicionalmente sem mais engenharia). Cosmético, não afeta o conteúdo.
