# Fase 6 — Identidade Visual (ícone, tema, tela de carregamento)

**Status:** Concluída e validada pelo autor.
**Data:** 2026-07-22

Não fazia parte do roadmap original de 5 fases — foi aberta depois que todas elas foram concluídas e validadas (ver [fase-1](fase-1-setup-infraestrutura.md) a [fase-5](fase-5-cloud-sync.md)), a partir dos arquivos de logo que o autor já tinha em `Inkbound Logo/` (dois exports de exploração de design, `Inkbound Logo - Exploracao.dc.html` e `Inkbound Logo - Final.dc.html`).

## De onde veio o design

O arquivo "Final" já continha a decisão de design fechada: um traço de pena/quill estilizado (`viewBox 0 0 58 66`, três `<path>`), wordmark "Inkbound" em **Cormorant Garamond** (serifada), tagline "from writers to writers" em **Inter**, com variantes para fundo escuro (`#121114`, dourado `oklch(0.78 0.13 85)`) e fundo claro (`oklch(0.97 0.005 90)`, dourado mais escuro `oklch(0.42 0.1 85)` para contraste). Isso já vinha com paleta e tipografia prontas — o trabalho aqui foi extrair essa decisão para dentro do código do app.

## O que foi implementado

### Tokens de design ([`index.css`](../src/index.css))
- Fontes: `Cormorant Garamond` (título/wordmark, via `font-display`) e `Inter` (resto da UI, sobrescrevendo o `font-sans` padrão do Tailwind).
- Paleta como variáveis CSS via `@theme` do Tailwind v4: `--color-paper`, `--color-paper-2`, `--color-line`, `--color-ink`, `--color-ink-muted`, `--color-hover`, `--color-gold`, `--color-gold-fg`, `--color-danger*` — cada uma com um valor em `:root` (tema claro) e outro sob `.dark` (tema escuro). Como a variável muda de valor, os componentes usam uma única classe (`bg-paper`, `text-ink` etc.) e o tema muda sozinho, sem precisar de `dark:` em todo lugar.
- `@custom-variant dark (&:where(.dark, .dark *));` — necessário porque o tema é alternado manualmente (não pelo `prefers-color-scheme` do sistema, que é o padrão do Tailwind v4).

### Tema claro/escuro
- [`useTemaStore.js`](../src/store/useTemaStore.js): store Zustand mínima que aplica/remove a classe `.dark` no `<html>` e persiste a escolha em `localStorage`. Padrão: escuro.
- [`ToggleTema.jsx`](../src/components/ToggleTema.jsx): botão sol/lua, presente no cabeçalho do Dashboard e do Workspace.

### Reescrita de todos os componentes
Toda classe Tailwind hardcoded (`bg-neutral-950`, `text-amber-400`, `border-neutral-800` etc.) foi substituída pelos tokens semânticos acima, em: `Dashboard`, `NewProjectModal`, `ContaGoogle`, `Workspace`, `Sidebar`, `Editor` (incluindo o preview markdown, que usa `dark:prose-invert` para o plugin de tipografia), `Fichas`, `FichaForm`, `SincronizacaoDrive`.

### Ícone do app
- [`Inkbound Logo/icon-source.svg`](../Inkbound%20Logo/icon-source.svg): SVG de 1024×1024 com o traço da pena, fundo **transparente** (não a versão com fundo escuro arredondado do arquivo original) — decisão tomada depois de testar: com fundo, a pena ficava ilegível em tamanhos pequenos (barra de tarefas). Sem fundo e com a marca ocupando quase todo o quadro (~95%), fica legível mesmo em 16-32px.
- Gerado via `npx tauri icon "Inkbound Logo/icon-source.svg"`, que produz automaticamente `.ico` (Windows), `.icns` (macOS) e todos os tamanhos PNG a partir de uma única fonte — não é necessário desenhar cada tamanho manualmente.
- **Atenção para o futuro:** trocar os arquivos em `src-tauri/icons/` não é suficiente para ver o ícone novo — o Cargo não detecta esses arquivos como "input" da build por padrão, então `tauri dev`/`cargo run` pode reusar o binário antigo já linkado. É necessário forçar (`touch src-tauri/build.rs` antes de rebuildar) para o `tauri-build` reincorporar o `.ico` no executável.
- [`LogoMarca.jsx`](../src/components/LogoMarca.jsx): a mesma geometria do traço, para uso inline em cabeçalhos (Dashboard/Workspace), com `stroke="currentColor"` para herdar a cor do tema.

### Tela de carregamento
- [`LogoMarcaAnimada.jsx`](../src/components/LogoMarcaAnimada.jsx): variante do traço usando `motion.path` do Framer Motion com animação de `pathLength` (0 → 1) — efeito de "traço sendo desenhado à mão", apropriado para um app de escrita.
- [`TelaCarregamento.jsx`](../src/components/TelaCarregamento.jsx): tela cheia com a logo animada, wordmark, tagline, e uma frase rotativa (a cada 850ms) com trocadilhos sobre escrita em inglês ("Dipping the quill in ink...", "Sharpening the nib...", etc. — 10 frases, `FRASES` no componente).
- [`App.jsx`](../src/App.jsx): centraliza o carregamento inicial (`carregarProjetos()`) antes de decidir entre Dashboard/Workspace, mostrando a tela de carregamento enquanto isso. Como o carregamento local é quase instantâneo, foi somado um piso de **2.8s** (`Promise.all` com o carregamento real e um timer) só para a tela ter tempo de aparecer e a animação/frases serem percebidas — se o carregamento real demorar mais que isso, o piso não tem efeito (o maior dos dois vence).

## Decisões/observações registradas durante o trabalho

- As frases da tela de carregamento estão em **inglês por pedido explícito do autor "por hora"** — sinal de que pode vir um pedido de traduzir para português (ou internacionalizar) mais adiante. Não implementado agora, é só texto fixo em `TelaCarregamento.jsx`.
- O ícone precisou de duas iterações depois do primeiro teste real na barra de tarefas do Windows — a versão inicial (com fundo escuro arredondado, fiel ao lockup "ícone" do arquivo de design) ficou ilegível em tamanho pequeno. A correção (remover fundo, aumentar a marca) foi validada olhando o PNG gerado antes de pedir para o autor testar de novo.

## Validação executada

| Verificação | Método | Resultado |
|---|---|---|
| Build do front-end | `npm run build` | OK |
| Ícone gerado e reincorporado no executável | `tauri icon` + rebuild forçado + inspeção visual do PNG | OK |
| Alternância de tema claro/escuro | Teste manual do autor | **Confirmado funcionando** |
| Tela de carregamento (animação + frases + tempo mínimo) | Teste manual do autor (múltiplos reinícios) | **Confirmado funcionando** |
| Ícone legível na barra de tarefas | Teste manual do autor | **Confirmado funcionando** |
