# Fase 10 — Editor Avançado (toolbar, contagem de caracteres, histórico de versões)

**Status:** Concluída e validada pelo autor.
**Data:** 2026-07-22

## Objetivo

Fechar o restante da lista de melhorias de editor/escrita pedida pelo autor (a exportação, tratada como prioridade "crucial", já saiu na Fase 9): botões de formatação gráfica (negrito/itálico/sublinhado) sem depender só da sintaxe Markdown, contagem de caracteres ao lado da contagem de palavras já existente, e histórico de versões dos capítulos.

## Toolbar de formatação + contagem de caracteres

Nova linha de botões abaixo do cabeçalho do [`Editor.jsx`](../src/components/workspace/Editor.jsx) (some no Focus Mode, que é justamente o modo de escrita sem distração): negrito, itálico, sublinhado (via tag `<u>`, já que Markdown não tem sintaxe nativa para isso — o `marked` já renderiza sem configuração extra) e quebra de cena (insere `***` numa linha própria). Os botões envolvem a seleção atual do textarea com a sintaxe correspondente, ou inserem um marcador de texto no cursor se nada estiver selecionado, reposicionando a seleção depois do re-render.

`contarCaracteres()` adicionada em [`palavras.js`](../src/lib/palavras.js) (contagem simples, `texto.length`), exibida ao lado da contagem de palavras já existente. Escopo deliberadamente contido: é só uma métrica ao vivo no editor, não vira um total persistido por projeto (diferente de `contagem_palavras`) — não foi isso que o autor pediu.

## Histórico de versões

### Decisão de arquitetura

- **Snapshot automático só ao abrir um arquivo**, não a cada autosave (que geraria uma versão a cada ~800ms de digitação contínua — inútil). Throttle de 10 minutos: só cria uma nova versão automática se a última tiver mais de 10 minutos, evitando empilhar versões idênticas quando o autor só abre e fecha um capítulo rapidamente.
- **Retenção:** mantém as 20 versões automáticas mais recentes por arquivo (poda as mais antigas a cada inserção); versões manuais nunca são podadas sozinhas — é o autor quem decide se ainda quer aquele marco.
- **Armazenamento: SQLite do projeto** (nova tabela `versoes_documento`, texto completo por versão), não arquivos soltos — consistente com a decisão já tomada nas Fases 1/3 de manter dados estruturados/metadados no banco, não como arquivos ad-hoc que precisariam ser filtrados da árvore de arquivos e da sincronização com o Drive.
- **Restaurar nunca é uma operação sem volta**: antes de sobrescrever o arquivo com uma versão antiga, o estado atual é salvo como uma nova versão manual automaticamente.

### O que foi implementado

- [`src/lib/versoes.js`](../src/lib/versoes.js) — `criarVersao`, `talvezCriarVersaoAutomatica` (aplica o throttle), `listarVersoes`, `obterConteudoVersao`, `caminhoRelativoDoArquivo` (converte o caminho absoluto do arquivo aberto para o caminho relativo usado como chave na tabela).
- [`src/components/workspace/HistoricoVersoes.jsx`](../src/components/workspace/HistoricoVersoes.jsx) — modal acessível pelo ícone de relógio na toolbar do editor: botão "Salvar versão atual" (checkpoint manual) + lista de versões (tempo relativo, contagem de palavras, tipo automática/manual) com "Restaurar" em cada uma.
- `Editor.jsx` ganhou a prop `projeto` (antes só recebia `caminhoArquivo`), necessária para computar o caminho relativo e abrir a conexão SQLite correta.
- Pequeno refactor: `formatarRelativo` (tempo relativo tipo "há 5 min") foi extraído de [`SincronizacaoDrive.jsx`](../src/components/workspace/SincronizacaoDrive.jsx) para [`src/lib/tempo.js`](../src/lib/tempo.js), reaproveitado também pelo histórico de versões em vez de duplicar a mesma lógica.

## Validação executada

| Verificação | Método | Resultado |
|---|---|---|
| Build do front-end | `npm run build` | OK |
| Paridade de chaves i18n | Verificação `pt-BR.json`/`en.json` | OK |
| Fluxo completo na janela nativa | Teste manual do autor: formatação, contagem de caracteres, criar/restaurar versões | **Confirmado funcionando** |

**Nota para quem for testar depois de uma atualização de schema:** como o `tauri-plugin-sql` cacheia a conexão por caminho de banco (ver Fase 3), a tabela `versoes_documento` só é criada quando a conexão é reaberta — reiniciar o app garante isso.
