import { readDir, mkdir, writeTextFile, remove, rename, exists } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { NOME_BANCO } from "./paths";

export async function listarEntradas(caminhoPasta) {
  const entradas = await readDir(caminhoPasta);
  const comCaminho = await Promise.all(
    entradas
      .filter((e) => !e.name.startsWith(NOME_BANCO) && !e.name.endsWith(".tmp"))
      .map(async (e) => ({
        nome: e.name,
        tipo: e.isDirectory ? "pasta" : "arquivo",
        caminho: await join(caminhoPasta, e.name),
      })),
  );

  return comCaminho.sort((a, b) => {
    if (a.tipo !== b.tipo) return a.tipo === "pasta" ? -1 : 1;
    return a.nome.localeCompare(b.nome, "pt-BR");
  });
}

// Percorre a árvore recursivamente (pais antes dos filhos) para a
// sincronização com o Drive. Reaproveita o mesmo filtro de listarEntradas
// (ignora inkbound.db e .tmp) — a sincronização do banco fica para depois,
// dado o risco de sincronizar um arquivo binário que pode estar com conexão
// aberta durante a sessão de edição.
export async function caminharArvore(caminhoRaiz) {
  const resultado = [];

  async function visitar(caminhoAbsoluto, caminhoRelativo) {
    const entradas = await listarEntradas(caminhoAbsoluto);
    for (const entrada of entradas) {
      const relativo = caminhoRelativo ? `${caminhoRelativo}/${entrada.nome}` : entrada.nome;
      resultado.push({ ...entrada, caminhoRelativo: relativo });
      if (entrada.tipo === "pasta") {
        await visitar(entrada.caminho, relativo);
      }
    }
  }

  await visitar(caminhoRaiz, "");
  return resultado;
}

export async function criarPasta(caminhoPai, nome) {
  const caminho = await join(caminhoPai, nome);
  if (await exists(caminho)) {
    throw new Error(`Já existe um item chamado "${nome}" aqui`);
  }
  await mkdir(caminho);
  return caminho;
}

export async function criarArquivo(caminhoPai, nome) {
  const nomeFinal = nome.endsWith(".md") ? nome : `${nome}.md`;
  const caminho = await join(caminhoPai, nomeFinal);
  if (await exists(caminho)) {
    throw new Error(`Já existe um item chamado "${nomeFinal}" aqui`);
  }
  await writeTextFile(caminho, "");
  return caminho;
}

export async function excluirEntrada(caminho) {
  await remove(caminho, { recursive: true });
}

export async function renomearEntrada(caminhoAntigo, caminhoPai, novoNome) {
  const novoCaminho = await join(caminhoPai, novoNome);
  if (await exists(novoCaminho)) {
    throw new Error(`Já existe um item chamado "${novoNome}" aqui`);
  }
  await rename(caminhoAntigo, novoCaminho);
  return novoCaminho;
}
