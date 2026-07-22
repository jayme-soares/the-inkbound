import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { NOME_BANCO } from "./paths";
import { abrirBancoProjeto } from "./db";

export function contarPalavras(texto) {
  const trimado = texto.trim();
  if (!trimado) return 0;
  return trimado.split(/\s+/).length;
}

async function somarPalavrasDaPasta(caminhoPasta) {
  const entradas = await readDir(caminhoPasta);
  let total = 0;

  for (const entrada of entradas) {
    if (entrada.name === NOME_BANCO || entrada.name.endsWith(".tmp")) continue;
    const caminho = await join(caminhoPasta, entrada.name);
    if (entrada.isDirectory) {
      total += await somarPalavrasDaPasta(caminho);
    } else if (entrada.name.endsWith(".md")) {
      const conteudo = await readTextFile(caminho);
      total += contarPalavras(conteudo);
    }
  }

  return total;
}

export async function recalcularContagemProjeto(caminhoProjeto) {
  const total = await somarPalavrasDaPasta(caminhoProjeto);
  const caminhoBanco = await join(caminhoProjeto, NOME_BANCO);
  const db = await abrirBancoProjeto(caminhoBanco);
  await db.execute("UPDATE projeto SET contagem_palavras = $1", [total]);
  return total;
}
