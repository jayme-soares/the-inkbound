import { readTextFile, writeTextFile, rename } from "@tauri-apps/plugin-fs";

export async function lerDocumento(caminho) {
  return readTextFile(caminho);
}

// Escreve em um arquivo temporário e só então substitui o original via rename,
// para não deixar o arquivo corrompido se o app crashar no meio da escrita.
export async function escreverDocumentoAtomico(caminho, conteudo) {
  const caminhoTemp = `${caminho}.tmp`;
  await writeTextFile(caminhoTemp, conteudo);
  await rename(caminhoTemp, caminho);
}
