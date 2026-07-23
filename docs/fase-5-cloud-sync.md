# Fase 5 — Sincronização em Nuvem (Google Drive)

**Status:** Concluída e validada pelo autor — login, sincronização de arquivos, exclusão espelhada (arquivo e projeto), sincronização dinâmica e descoberta de projetos em dispositivo novo, todos testados na prática.
**Data:** 2026-07-21

## Por que esta fase é diferente das anteriores

Desde o planejamento inicial, esta foi sinalizada como a de maior risco técnico do roadmap. Dois motivos concretos, discutidos e decididos antes de qualquer código:

1. **`inkbound.db` é binário.** Diferente dos capítulos em `.md` (texto, fácil de comparar), duas versões divergentes do SQLite não podem ser "mescladas" de forma sã sem um mecanismo bem mais sofisticado (log de operações, CRDT). Decisão tomada: em vez de permitir edição concorrente real, o Inkbound sempre verifica a versão mais recente no Drive antes de abrir um projeto e baixa se houver algo mais novo — isso evita a necessidade de merge binário, ao custo de não proteger contra edição simultânea (Inkbound + edição externa ao mesmo tempo, sem nunca "ver" a outra).
2. **OAuth2 requer uma conta/projeto no Google Cloud** — uma dependência externa que só o autor do projeto pode provisionar (não é algo que eu possa fazer em nome dele).

Por conta disso, a fase foi dividida em duas partes:
- **Slice A (esta entrega):** login/logout com Google, armazenamento seguro do token.
- **Slice B (próxima entrega):** motor de upload/download real dos arquivos do projeto, com a lógica de "verificar versão antes de abrir".

## Decisões tomadas

- **Escopo do Drive: `drive.file`** — o app só acessa arquivos que ele mesmo cria, mas eles ficam visíveis no Drive normal do usuário (diferente de `drive.appdata`, usado no protótipo Streamlit antigo, que é uma pasta oculta). Escolhido por transparência: o autor pode ver/gerenciar os arquivos de backup diretamente no Drive.
- **Estratégia de conflito: verificação de versão ao abrir**, não um lock explícito nem merge multi-dispositivo real. Cobre tanto "abri em outro computador" quanto "editei o arquivo direto no Drive/por fora" — nos dois casos, do ponto de vista da API é só "esse arquivo mudou desde a última vez que eu vi", e o Inkbound baixa a versão mais nova antes de deixar editar.
- **Fluxo OAuth: PKCE com servidor loopback local** (`http://localhost:<porta>`), via a crate `tauri-plugin-oauth`. É o método que o próprio Google recomenda para apps desktop/instalados — não há suporte a deep link (`app://callback`) para esse tipo de credencial.
- **Armazenamento do refresh token: Keychain do sistema operacional** (via crate `keyring`, que usa o Windows Credential Manager), nunca em arquivo de texto puro. Consistente com os valores de privacidade do produto.
- **Toda a troca de token e chamadas à API do Google Drive acontecem no lado Rust**, nunca no JS/WebView — o `client_secret` nunca é exposto ao front-end, só o resultado (conectado/desconectado).

## O que foi implementado (Slice A)

### Rust ([`google_auth.rs`](../src-tauri/src/google_auth.rs))
- `iniciar_login_google`: gera par PKCE (`code_verifier`/`code_challenge`), inicia o servidor loopback (`tauri_plugin_oauth::start`), monta a URL de autorização do Google e a retorna para o front-end abrir no navegador do sistema.
- Callback do servidor loopback: ao receber o redirect com o `code`, troca por `access_token`/`refresh_token` na API do Google (`reqwest`), salva o `refresh_token` no Keychain, e emite um evento (`google-login-concluido` ou `google-login-erro`) para o front-end.
- `status_login_google` / `logout_google`: verificam/removem a credencial do Keychain.

### Front-end
- [`googleAuth.js`](../src/lib/googleAuth.js): wrapper que invoca os comandos Rust e escuta os eventos de conclusão do login.
- [`ContaGoogle.jsx`](../src/components/dashboard/ContaGoogle.jsx): botão no cabeçalho do Dashboard — "Conectar ao Google Drive" / "Conectado ao Drive" (clique para desconectar).

### Configuração necessária (ação do autor, fora do código)

O app lê as credenciais OAuth de **`src-tauri/google-oauth.json`** (arquivo local, no `.gitignore`, nunca commitado):

```json
{
  "client_id": "SEU_CLIENT_ID.apps.googleusercontent.com",
  "client_secret": "SEU_CLIENT_SECRET"
}
```

Passo a passo para gerar essas credenciais:

1. Acesse [console.cloud.google.com](https://console.cloud.google.com/) e crie um novo projeto (ex: "The Inkbound").
2. **APIs e Serviços → Biblioteca** → busque "Google Drive API" → **Ativar**.
3. **APIs e Serviços → Tela de consentimento OAuth**:
   - Tipo de usuário: Externo.
   - Nome do app, e-mail de suporte e de contato do desenvolvedor.
   - Em "Acesso a dados", adicione o escopo `.../auth/drive.file`.
   - Em "Usuários de teste" (o app ficará em modo "Teste" inicialmente), adicione a própria conta Google que você vai usar — sem isso o Google bloqueia o login.
4. **APIs e Serviços → Credenciais → Criar credenciais → ID do cliente OAuth**:
   - Tipo de aplicativo: **Aplicativo para computador** (Desktop app) — importante, não é "Aplicativo da Web".
   - Nome: "The Inkbound Desktop".
5. O Google mostra um **Client ID** e um **Client Secret** — cole os dois no `google-oauth.json` conforme o formato acima.

Sem esse arquivo, o botão "Conectar ao Google Drive" mostra um erro claro (`google-oauth.json não encontrado...`) em vez de falhar silenciosamente — testado nesta fase.

## Validação executada

| Verificação | Método | Resultado |
|---|---|---|
| Build do front-end | `npm run build` | OK |
| Compilação do back-end Rust (novas deps: `tauri-plugin-oauth`, `reqwest`, `keyring`, `sha2`, `base64`, `rand`, `url`) | `cargo check` | OK, sem warnings |
| Boot do runtime completo | `npm run tauri dev` | OK |
| Fluxo de login ponta a ponta com credenciais reais do Google | — | **Pendente** — depende do autor gerar as credenciais acima |

## Correção pós-Slice A: exclusão de projeto travando

Ao testar a Slice A, o autor reportou não conseguir excluir um projeto de teste. Causa: o `tauri-plugin-sql` nunca fecha conexões SQLite automaticamente, e no Windows um arquivo com handle aberto não pode ser excluído. Documentado e corrigido em detalhe em [fase-3-motor-local.md](fase-3-motor-local.md#correção-não-era-possível-excluir-um-projeto-2026-07-21) (incluindo uma segunda rodada: a primeira correção quebrou sob concorrência do `React.StrictMode`).

## O que foi implementado (Slice B — motor de sincronização)

### Rust ([`google_drive.rs`](../src-tauri/src/google_drive.rs))
Comandos que fazem as chamadas HTTP à API do Google Drive (`reqwest` + `access_token` obtido via `obter_access_token`, renovado a cada chamada a partir do `refresh_token` no Keychain):
- `drive_obter_ou_criar_pasta`: busca uma pasta por nome+pai; cria se não existir. Usado para espelhar a estrutura `The Inkbound/<projeto>/<subpastas>` no Drive.
- `drive_buscar_arquivo` / `drive_obter_metadados`: consulta existência e `modifiedTime` de um arquivo.
- `drive_enviar_arquivo`: lê o arquivo local (`std::fs::read`) e faz upload — multipart (arquivo novo) ou PATCH de mídia (atualização de um arquivo existente).
- `drive_baixar_arquivo`: baixa o conteúdo (`alt=media`) e escreve direto no caminho local (`std::fs::write`).
- `hash_arquivo_local`: SHA-256 do conteúdo local, usado para detectar se o arquivo mudou desde o último sync sem depender de timestamp de sistema de arquivos.

### Estado de sincronização (SQLite, [`db.js`](../src/lib/db.js))
Duas tabelas novas no `inkbound.db` do próprio projeto:
- `sincronizacao_projeto`: guarda o id da pasta do projeto no Drive (tabela de uma linha só).
- `sincronizacao_arquivo`: para cada arquivo/pasta sincronizado, guarda `drive_file_id`, o `modifiedTime` do Drive na última sincronização, e o hash local na última sincronização.

### Orquestração ([`driveSync.js`](../src/lib/driveSync.js))
Por arquivo, compara o estado atual contra o que foi registrado no último sync:

| Situação | Ação |
|---|---|
| Sem mapeamento (arquivo novo) | Envia (cria no Drive) |
| Só o Drive mudou desde o último sync | Baixa (sobrescreve local) |
| Só o local mudou desde o último sync | Envia (sobrescreve Drive) |
| Nenhum dos dois mudou | Não faz nada |
| **Os dois mudaram desde o último sync** | **Não decide automaticamente** — sinaliza como conflito na UI. Consistente com a decisão da Fase 1/5 de não tentar merge automático de conteúdo. |

Pastas são criadas/reaproveitadas no Drive antes dos arquivos que contêm (percurso top-down via [`caminharArvore`](../src/lib/arvoreArquivos.js)).

**Deliberadamente fora desta versão:** o `inkbound.db` (fichas de personagens/localidades) não é sincronizado ainda. É um arquivo binário que pode estar com conexão SQLite aberta durante a sessão de edição — sincronizá-lo com segurança (fechando a conexão no momento certo, tratando o mesmo risco de "handle aberto" que acabamos de corrigir para exclusão de projeto) merece uma passada própria, não uma extensão apressada do motor de sincronização de texto.

### UI ([`SincronizacaoDrive.jsx`](../src/components/workspace/SincronizacaoDrive.jsx))
- Ao abrir um projeto no Workspace, se conectado ao Google, dispara automaticamente uma sincronização em segundo plano — implementa a estratégia "verificar antes de editar" combinada na Fase 5.
- Botão "Sincronizar" manual no cabeçalho do Workspace, para forçar uma passada a qualquer momento (ex: antes de fechar o app).
- Mostra o resumo (quantos enviados/baixados) ou um aviso de conflito com os caminhos afetados.

## Correção crítica: o refresh_token nunca era persistido de verdade

Depois de gerar as credenciais reais, o login parecia funcionar (o app mostrava "Conectado"), mas nada era sincronizado e, ao reabrir o app, sempre pedia login de novo.

**Causa raiz:** a crate `keyring` grava credenciais no Windows usando `CRED_PERSIST_ENTERPRISE` (hardcoded na própria crate, sem opção de configurar). Esse modo de persistência depende de perfil de roaming/domínio — em uma máquina pessoal comum (conta Microsoft, sem domínio), o `CredWriteW` do Windows retorna sucesso, mas a credencial nunca é de fato gravada no armazenamento seguro. Confirmado lendo o Gerenciador de Credenciais diretamente (`cmdkey /list`) imediatamente depois de um "salvamento" que a própria crate reportava como `Ok`.

**Correção:** removida a dependência `keyring`. Criado [`credential_store.rs`](../src-tauri/src/credential_store.rs), um wrapper direto sobre a API do Windows (`windows-sys`, `Win32::Security::Credentials`) usando `CRED_PERSIST_LOCAL_MACHINE` — confiável tanto em máquinas de domínio quanto pessoais. Validado: a credencial agora aparece em `cmdkey /list` e sobrevive a reinícios do app.

## Correção: condição de corrida no SQLite reintroduzida pela Fase 5

As Fases 3/4 já tinham corrigido uma corrida de conexões SQLite (ver [fase-3-motor-local.md](fase-3-motor-local.md#correção-não-era-possível-excluir-um-projeto-2026-07-21)), evitando fechar conexões fora de pontos deliberados. A Slice B reintroduziu o mesmo risco: `sincronizarProjeto`, `obterUltimaSincronizacao` e a descoberta de projetos cada um abria e fechava sua própria conexão para o mesmo `inkbound.db` — e como esses disparam **concorrentemente** ao abrir o Workspace (checar última sincronização + rodar sincronização automática ao mesmo tempo), um fechava a conexão que o outro ainda estava usando, gerando `attempted to acquire a connection on a closed pool` e, num caso relacionado, o erro do Windows 1224 ("seção mapeada pelo usuário aberta").

**Correção definitiva:** [`db.js`](../src/lib/db.js) agora cacheia uma única conexão por projeto (`Map` por caminho do banco) em vez de abrir uma nova a cada chamada. Todo o código que precisa do banco reaproveita a mesma conexão; ela só é fechada explicitamente imediatamente antes de excluir a pasta do projeto do disco (o único caso em que fechar é necessário e seguro).

## Correções de comportamento (encontradas em teste manual)

Depois das correções de infraestrutura acima, o autor testou o fluxo completo e encontrou lacunas de comportamento — todas corrigidas nesta entrega:

- **Exclusão não espelhava para o Drive.** Excluir um arquivo/pasta *dentro* de um projeto já sincronizava a exclusão (via `excluirOrfaosDrive` em [`driveSync.js`](../src/lib/driveSync.js)), mas excluir o **projeto inteiro** pelo Dashboard só removia a pasta local — a pasta ficava viva no Drive, e pior: a descoberta de projetos (ver abaixo) a encontrava de novo e a baixava de volta, "reanimando" o projeto excluído. Corrigido com `excluirProjetoDoDrive()`, chamada antes da exclusão local sempre que há um `drive_pasta_id` registrado.
- **Sincronização só disparava ao abrir/sair do Workspace ou pelo botão manual.** Criar ou excluir um arquivo/pasta na sidebar não sincronizava sozinho. Corrigido com [`useSincronizacaoDrive.js`](../src/hooks/useSincronizacaoDrive.js) — hook compartilhado com debounce (1.5s, para coalescer várias ações rápidas numa única passada) que a `Sidebar` dispara após qualquer criação/exclusão/renomeio, sem duplicar a lógica que já existia no botão manual.
- **Projeto novo só aparecia no Drive ao entrar no Workspace pela primeira vez.** Corrigido: `criarProjeto` na store agora dispara uma sincronização (se conectado) logo após criar a pasta local, então a pasta no Drive já existe antes do autor sequer abrir o projeto.
- **Dispositivo novo não descobria projetos que só existiam no Drive.** Esse era um gap real do design original (o objetivo da fase inclui "abri em outro computador"). Implementado `descobrirProjetosDrive()`: ao carregar o Dashboard, se conectado, lista as pastas de projeto dentro de "The Inkbound" no Drive e baixa por completo qualquer uma que não tenha pasta local correspondente (nova função `drive_listar_filhos` no Rust + download recursivo).
- **Sem indicação de quando foi a última sincronização.** Adicionado `ultima_sincronizacao` (já existia na tabela, só não era exibida) ao cabeçalho do Workspace, formatado como tempo relativo ("há 5 min").
- **Arquivos internos do SQLite (`inkbound.db-wal`, `inkbound.db-shm`) apareciam na sidebar e eram sincronizados como se fossem documentos do autor.** São arquivos que o próprio SQLite cria para o modo WAL (Write-Ahead Log) — inofensivos, mas não deveriam ser visíveis nem sincronizados. Corrigido o filtro em `listarEntradas()` ([`arvoreArquivos.js`](../src/lib/arvoreArquivos.js)) para excluir qualquer arquivo cujo nome comece com `inkbound.db` (cobre `-wal`, `-shm`, `-journal`), não só o nome exato.

## Validação executada

| Verificação | Método | Resultado |
|---|---|---|
| Build do front-end | `npm run build` | OK |
| Compilação do back-end Rust | `cargo check` | OK, sem warnings |
| Login com credenciais reais + persistência entre reinícios do app | Teste manual do autor | **Confirmado funcionando** |
| Sincronização de arquivos (criar, editar, excluir) refletindo no Drive | Teste manual do autor | **Confirmado funcionando** |
| Exclusão de projeto espelhada no Drive (sem "reanimação" pela descoberta) | Teste manual do autor | **Confirmado funcionando** |
| Sincronização dinâmica ao criar/excluir na sidebar (sem precisar sair/entrar do Workspace) | Teste manual do autor | **Confirmado funcionando** |
| Pasta do projeto aparece no Drive já na criação, sem precisar abrir o Workspace | Teste manual do autor | **Confirmado funcionando** |
| Arquivos `.db-wal`/`.db-shm` somem da sidebar | Teste manual do autor | **Confirmado funcionando** |

## Correção: exclusão noutro dispositivo não era refletida localmente (2026-07-22)

**Bug reportado pelo autor:** excluiu um projeto pelo Inkbound instalado num segundo dispositivo (mesma conta do Drive), o que corretamente removeu a pasta do projeto no Drive (via `excluirProjetoDoDrive`, já existente desde a Slice B). Mas no primeiro dispositivo, o projeto continuou aparecendo no Dashboard normalmente, como se nada tivesse acontecido.

**Causa raiz:** `descobrirProjetosDrive()` (rodada ao carregar o Dashboard, se conectado) só resolve a direção "existe no Drive mas não localmente" — baixa projetos novos. Não existia nenhum código cuidando da direção oposta: "existe localmente mas sumiu do Drive". Um projeto excluído por outro dispositivo nunca era removido do dispositivo que só o via localmente.

**Correção:**
- Novo comando Rust [`drive_pasta_existe`](../src-tauri/src/google_drive.rs) — verifica se uma pasta/arquivo ainda existe no Drive, distinguindo explicitamente um 404 confirmado (ou `trashed: true`) de qualquer outra falha (rede, token expirado, etc.). Essa distinção é deliberada: uma falha transitória nunca pode ser interpretada como "foi excluído", ou o app apagaria dados locais por engano numa simples queda de conexão.
- Nova função [`removerProjetosExcluidosDoDrive`](../src/lib/driveSync.js) — para cada projeto local que já tem um `drive_pasta_id` registrado (ou seja, já foi sincronizado alguma vez), verifica se a pasta ainda existe no Drive. Se não existir mais, exclui o projeto localmente também. Projetos que nunca foram sincronizados (sem `drive_pasta_id`) são ignorados — "sem pasta no Drive" não significa "excluído" para eles, só significa "nunca subiu". Falha ao verificar um projeto específico faz esse projeto ser pulado (mantido), nunca excluído.
- [`Dashboard.jsx`](../src/components/dashboard/Dashboard.jsx) agora chama essa função junto de `descobrirProjetosDrive` na mesma verificação que já rodava ao carregar (se conectado ao Drive), e recarrega a lista de projetos se qualquer uma das duas resultar em mudança.

**Fora do escopo desta correção:** o caso de excluir um projeto noutro dispositivo enquanto ele está *aberto no Workspace* em outro. A sincronização dentro do Workspace (`sincronizarProjeto`) não verifica se a pasta-raiz do próprio projeto ainda existe — hoje ela recriaria a pasta no Drive (por nome) e reenviaria tudo, tratando como se fosse um projeto novo. Esse é um caso mais raro (edição simultânea ativa nos dois dispositivos) e não foi o bug reportado; fica registrado como limitação conhecida, não como pendência.

## Pendências conhecidas (fora do escopo desta entrega)

- Sincronização do `inkbound.db` em si (fichas de personagens/localidades) — continua deliberadamente fora, pelo mesmo motivo de sempre: é um arquivo binário/SQLite, arriscado de sincronizar sem um design próprio para lidar com conexões abertas e merge.
- Resolução assistida de conflitos (hoje só sinaliza na UI; o autor precisa resolver manualmente, ex: renomeando uma das versões).
- A descoberta de projetos (`descobrirProjetosDrive`) casa projetos por **título exato** — um projeto renomeado localmente e outro ainda não sincronizado com o nome antigo poderiam colidir. Caso de borda raro, não tratado.
