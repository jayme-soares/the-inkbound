import { mkdir, remove, exists, readDir } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { getRootDir, gerarSlugUnico, NOME_BANCO, PASTAS_PADRAO } from "./paths";
import { abrirBancoProjeto, fecharBancoProjeto } from "./db";

export async function listarProjetos() {
  const root = await getRootDir();
  if (!(await exists(root))) {
    await mkdir(root, { recursive: true });
    return [];
  }

  const entradas = await readDir(root);
  const projetos = [];

  for (const entrada of entradas) {
    if (!entrada.isDirectory) continue;
    const caminhoProjeto = await join(root, entrada.name);
    const caminhoBanco = await join(caminhoProjeto, NOME_BANCO);
    if (!(await exists(caminhoBanco))) continue;

    const db = await abrirBancoProjeto(caminhoBanco);
    const linhas = await db.select("SELECT * FROM projeto LIMIT 1");
    if (linhas.length === 0) continue;

    const linha = linhas[0];
    projetos.push({
      id: linha.id,
      titulo: linha.titulo,
      genero: linha.genero,
      autor: linha.autor,
      contato: linha.contato,
      dataCriacao: linha.data_criacao,
      contagemPalavras: linha.contagem_palavras,
      metaDiariaPalavras: linha.meta_diaria_palavras,
      caminho: caminhoProjeto,
    });
  }

  return projetos.sort((a, b) => a.dataCriacao.localeCompare(b.dataCriacao));
}

export async function criarProjetoNoDisco({ titulo, genero }) {
  const root = await getRootDir();
  const slug = await gerarSlugUnico(titulo);
  const caminhoProjeto = await join(root, slug);

  try {
    await mkdir(caminhoProjeto, { recursive: true });
    for (const pasta of PASTAS_PADRAO) {
      await mkdir(await join(caminhoProjeto, pasta), { recursive: true });
    }

    const caminhoBanco = await join(caminhoProjeto, NOME_BANCO);
    const db = await abrirBancoProjeto(caminhoBanco);

    const id = crypto.randomUUID();
    const dataCriacao = new Date().toISOString();
    await db.execute(
      "INSERT INTO projeto (id, titulo, genero, data_criacao, contagem_palavras) VALUES ($1, $2, $3, $4, 0)",
      [id, titulo, genero || null, dataCriacao],
    );

    return {
      id,
      titulo,
      genero,
      autor: null,
      contato: null,
      dataCriacao,
      contagemPalavras: 0,
      metaDiariaPalavras: null,
      caminho: caminhoProjeto,
    };
  } catch (erro) {
    if (await exists(caminhoProjeto)) {
      await remove(caminhoProjeto, { recursive: true });
    }
    throw erro;
  }
}

export async function excluirProjetoNoDisco(caminhoProjeto) {
  const caminhoBanco = await join(caminhoProjeto, NOME_BANCO);
  if (await exists(caminhoBanco)) {
    await fecharBancoProjeto(caminhoBanco);
  }
  await remove(caminhoProjeto, { recursive: true });
}

// Usada pela tela de exportação (folha de rosto do manuscrito), que é onde
// esses dois campos passam a ser editáveis — não há uma tela de
// "configurações do projeto" separada, e criar uma só para isto seria
// prematuro.
export async function atualizarAutorContato(caminhoProjeto, { autor, contato }) {
  const caminhoBanco = await join(caminhoProjeto, NOME_BANCO);
  const db = await abrirBancoProjeto(caminhoBanco);
  await db.execute("UPDATE projeto SET autor = $1, contato = $2", [
    autor || null,
    contato || null,
  ]);
}
