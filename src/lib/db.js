import Database from "@tauri-apps/plugin-sql";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS projeto (
    id TEXT PRIMARY KEY,
    titulo TEXT NOT NULL,
    genero TEXT,
    autor TEXT,
    contato TEXT,
    data_criacao TEXT NOT NULL,
    contagem_palavras INTEGER NOT NULL DEFAULT 0,
    meta_diaria_palavras INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS personagens (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    motivacoes TEXT,
    arco_narrativo TEXT,
    criado_em TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS localidades (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    criado_em TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sincronizacao_projeto (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    drive_pasta_id TEXT,
    ultima_sincronizacao TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sincronizacao_arquivo (
    caminho_relativo TEXT PRIMARY KEY,
    tipo TEXT NOT NULL,
    drive_file_id TEXT NOT NULL,
    drive_modified_time TEXT,
    hash_local_ultimo_sync TEXT,
    sincronizado_em TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS versoes_documento (
    id TEXT PRIMARY KEY,
    caminho_relativo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    palavras INTEGER NOT NULL,
    tipo TEXT NOT NULL,
    criado_em TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_versoes_caminho ON versoes_documento(caminho_relativo)`,
  `CREATE TABLE IF NOT EXISTS progresso_diario (
    data TEXT PRIMARY KEY,
    palavras_inicio_dia INTEGER NOT NULL
  )`,
];

// Colunas adicionadas a tabelas já existentes depois do lançamento inicial.
// O CREATE TABLE IF NOT EXISTS acima só cobre bancos novos — bancos de
// projetos criados antes desta mudança continuam sem a coluna até rodarmos
// isto. SQLite não tem "ADD COLUMN IF NOT EXISTS" portátil, então checamos
// via PRAGMA table_info antes de tentar adicionar.
const MIGRACOES_COLUNA = [
  { tabela: "projeto", coluna: "autor", ddl: "ALTER TABLE projeto ADD COLUMN autor TEXT" },
  { tabela: "projeto", coluna: "contato", ddl: "ALTER TABLE projeto ADD COLUMN contato TEXT" },
  {
    tabela: "projeto",
    coluna: "meta_diaria_palavras",
    ddl: "ALTER TABLE projeto ADD COLUMN meta_diaria_palavras INTEGER",
  },
];

async function aplicarMigracoesColuna(db) {
  for (const { tabela, coluna, ddl } of MIGRACOES_COLUNA) {
    const colunas = await db.select(`PRAGMA table_info(${tabela})`);
    if (!colunas.some((c) => c.name === coluna)) {
      await db.execute(ddl);
    }
  }
}

// tauri-plugin-sql sempre abre uma conexão NOVA a cada Database.load() e
// sobrescreve a entrada anterior no mapa interno (por caminho) — ele nunca
// reaproveita uma conexão existente. Se dois trechos de código chamam
// abrirBancoProjeto() para o mesmo arquivo concorrentemente (ex: verificar a
// última sincronização e disparar uma sincronização ao mesmo tempo, ao abrir
// o Workspace), cada um sobrescreve a conexão do outro — e se um deles fechar
// a conexão enquanto o outro ainda está no meio de uma consulta, a consulta
// falha com "attempted to acquire a connection on a closed pool". Por isso
// cacheamos uma única conexão por projeto aqui, para que todo mundo
// compartilhe o mesmo pool em vez de ficar recriando.
const conexoesAbertas = new Map();

export async function abrirBancoProjeto(caminhoBanco) {
  if (!conexoesAbertas.has(caminhoBanco)) {
    conexoesAbertas.set(caminhoBanco, criarConexao(caminhoBanco));
  }
  try {
    return await conexoesAbertas.get(caminhoBanco);
  } catch (erro) {
    conexoesAbertas.delete(caminhoBanco);
    throw erro;
  }
}

async function criarConexao(caminhoBanco) {
  const db = await Database.load(`sqlite:${caminhoBanco}`);
  for (const stmt of SCHEMA) {
    await db.execute(stmt);
  }
  await aplicarMigracoesColuna(db);
  return db;
}

// Só deve ser chamada quando temos certeza de que nada mais vai usar essa
// conexão (hoje, só antes de excluir a pasta do projeto do disco — no
// Windows um arquivo com handle aberto não pode ser removido).
export async function fecharBancoProjeto(caminhoBanco) {
  if (!conexoesAbertas.has(caminhoBanco)) return;
  const dbPromise = conexoesAbertas.get(caminhoBanco);
  conexoesAbertas.delete(caminhoBanco);
  const url = `sqlite:${caminhoBanco}`;
  const db = await dbPromise;
  await db.close(url);
}
