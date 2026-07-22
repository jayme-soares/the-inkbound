import { join } from "@tauri-apps/api/path";
import { NOME_BANCO } from "./paths";
import { abrirBancoProjeto } from "./db";

async function abrirBanco(caminhoProjeto) {
  const caminhoBanco = await join(caminhoProjeto, NOME_BANCO);
  return abrirBancoProjeto(caminhoBanco);
}

function paraPersonagem(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    motivacoes: linha.motivacoes,
    arcoNarrativo: linha.arco_narrativo,
    criadoEm: linha.criado_em,
  };
}

function paraLocalidade(linha) {
  return {
    id: linha.id,
    nome: linha.nome,
    descricao: linha.descricao,
    criadoEm: linha.criado_em,
  };
}

export async function listarPersonagens(caminhoProjeto) {
  const db = await abrirBanco(caminhoProjeto);
  const linhas = await db.select("SELECT * FROM personagens ORDER BY nome COLLATE NOCASE");
  return linhas.map(paraPersonagem);
}

export async function criarPersonagem(caminhoProjeto, { nome, motivacoes, arcoNarrativo }) {
  const db = await abrirBanco(caminhoProjeto);
  const id = crypto.randomUUID();
  const criadoEm = new Date().toISOString();
  await db.execute(
    "INSERT INTO personagens (id, nome, motivacoes, arco_narrativo, criado_em) VALUES ($1, $2, $3, $4, $5)",
    [id, nome, motivacoes || null, arcoNarrativo || null, criadoEm],
  );
  return { id, nome, motivacoes, arcoNarrativo, criadoEm };
}

export async function atualizarPersonagem(caminhoProjeto, id, { nome, motivacoes, arcoNarrativo }) {
  const db = await abrirBanco(caminhoProjeto);
  await db.execute(
    "UPDATE personagens SET nome = $1, motivacoes = $2, arco_narrativo = $3 WHERE id = $4",
    [nome, motivacoes || null, arcoNarrativo || null, id],
  );
}

export async function excluirPersonagem(caminhoProjeto, id) {
  const db = await abrirBanco(caminhoProjeto);
  await db.execute("DELETE FROM personagens WHERE id = $1", [id]);
}

export async function listarLocalidades(caminhoProjeto) {
  const db = await abrirBanco(caminhoProjeto);
  const linhas = await db.select("SELECT * FROM localidades ORDER BY nome COLLATE NOCASE");
  return linhas.map(paraLocalidade);
}

export async function criarLocalidade(caminhoProjeto, { nome, descricao }) {
  const db = await abrirBanco(caminhoProjeto);
  const id = crypto.randomUUID();
  const criadoEm = new Date().toISOString();
  await db.execute(
    "INSERT INTO localidades (id, nome, descricao, criado_em) VALUES ($1, $2, $3, $4)",
    [id, nome, descricao || null, criadoEm],
  );
  return { id, nome, descricao, criadoEm };
}

export async function atualizarLocalidade(caminhoProjeto, id, { nome, descricao }) {
  const db = await abrirBanco(caminhoProjeto);
  await db.execute("UPDATE localidades SET nome = $1, descricao = $2 WHERE id = $3", [
    nome,
    descricao || null,
    id,
  ]);
}

export async function excluirLocalidade(caminhoProjeto, id) {
  const db = await abrirBanco(caminhoProjeto);
  await db.execute("DELETE FROM localidades WHERE id = $1", [id]);
}
