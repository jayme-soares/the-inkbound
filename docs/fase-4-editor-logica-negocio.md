# Fase 4 — Editor e Lógica de Negócio

**Status:** Concluída e validada manualmente pelo autor na janela nativa do app
**Data:** 2026-07-21

## Objetivo

Implementar o editor de manuscrito (requisito 4.3) e os formulários de fichamento de Personagens/Localidades (requisito 4.4), sobre a base de disco/SQLite construída na Fase 3.

## O que foi implementado

### Editor de Manuscrito ([`Editor.jsx`](../src/components/workspace/Editor.jsx))
- Abre ao clicar num arquivo `.md` na sidebar (clique simples agora abre o arquivo; duplo clique continua renomeando — herdado da Fase 3).
- **Preview ao vivo em split-pane**: textarea à esquerda, HTML renderizado (via `marked`) à direita, alternável por um botão. Essa é a interpretação escolhida para "Markdown com preview ao vivo (tipo Typora)" — um WYSIWYG inline de verdade (edição direta sobre texto formatado, sincronizando com markdown por baixo) é um projeto de UI bem mais arriscado e não crítico para o MVP; o split-pane entrega a mesma necessidade funcional (ver o resultado formatado enquanto escreve) com muito menos risco de implementação. Fica registrado como possível refinamento futuro, não como pendência.
- **Autosave com debounce de 800ms**, usando escrita atômica (`escreverDocumentoAtomico` em [`documentos.js`](../src/lib/documentos.js): grava em `<arquivo>.tmp` e só então faz `rename` sobre o arquivo original) — implementa a preocupação levantada ainda na fase de planejamento sobre não corromper capítulos em caso de crash no meio da escrita.
- Flush garantido ao trocar de arquivo ou fechar o editor (o conteúdo não salvo do arquivo anterior é escrito antes de trocar), usando refs para evitar o bug clássico de closure desatualizada em `useEffect`.
- **Focus Mode**: oculta a sidebar e o cabeçalho do Workspace, deixando só o texto centralizado — controlado pelo `Workspace.jsx` (estado de layout), não pelo próprio editor.

### Contagem de palavras ([`palavras.js`](../src/lib/palavras.js))
- A cada autosave bem-sucedido, o projeto inteiro é revarrido (todos os `.md`, recursivamente) e o total de palavras é recalculado e gravado em `projeto.contagem_palavras` no SQLite, refletindo imediatamente no card do Dashboard via a store.
- **Trade-off aceito:** recalcular por varredura completa a cada save é simples e sempre correto (fonte da verdade = arquivos reais), mas custa uma leitura de todos os arquivos do projeto a cada ~800ms de digitação contínua. Para o volume esperado de um projeto de escrita (dezenas de capítulos) isso é imperceptível; se um projeto crescer para milhares de arquivos, valeria a pena trocar por contagem incremental por arquivo — não implementado agora por ser otimização prematura.

### Fichas de Personagens e Localidades ([`Fichas.jsx`](../src/components/workspace/Fichas.jsx), [`FichaForm.jsx`](../src/components/workspace/FichaForm.jsx), [`fichas.js`](../src/lib/fichas.js))
- Nova aba "Fichas" no cabeçalho do Workspace (ao lado de "Escrita"), com sub-abas Personagens/Localidades.
- CRUD completo (criar, listar, editar, excluir) gravando nas tabelas `personagens`/`localidades` do SQLite do projeto (schema já existia desde a Fase 1/3).
- Formulário único e parametrizado por tipo (`FichaForm`), evitando duplicar o formulário para cada entidade.

## O que continua fora do escopo (deliberadamente)

- **Cruzamento de documentos com fichas** (ex: "este capítulo menciona este personagem"): a seção 4.4 do documento original menciona isso como motivação de design, mas não é um requisito de formulário concreto do MVP. Continua sem tabela de relação nem UI — mantendo a mesma decisão já registrada na Fase 3.
- **Pistas e eventos de timeline**: mesma razão da Fase 3 — sem forma de campos definida, ficam fora do schema até serem desenhados.
- **Mover arquivos por drag-and-drop** na sidebar: pendência explícita desde a Fase 3, ainda não implementada.

## Validação executada

| Verificação | Método | Resultado |
|---|---|---|
| Build do front-end | `npm run build` | OK — sem erros (CSS cresceu para 33 kB com a adição do plugin `@tailwindcss/typography`, usado só no preview do editor) |
| Boot do runtime completo | `npm run tauri dev` | OK — compila e inicia sem panics |
| Teste manual na janela nativa | Autor testou diretamente no app | **Confirmado funcionando** |

## Próxima fase

Fase 5 — Sincronização em Nuvem (Google Drive). Diferente das fases anteriores, esta foi sinalizada desde o planejamento inicial como a de **maior risco técnico** do roadmap (OAuth2, resolução de conflitos de merge entre `.md`/SQLite editados offline em mais de um dispositivo) — vai precisar de uma rodada de design própria antes de qualquer código, não só um "avançar e implementar" direto como as fases anteriores.
