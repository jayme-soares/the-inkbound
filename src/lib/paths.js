import { documentDir, join } from "@tauri-apps/api/path";
import { exists } from "@tauri-apps/plugin-fs";

export const RAIZ_NOME = "The Inkbound";
export const NOME_BANCO = "inkbound.db";
export const PASTAS_PADRAO = ["Rascunhos", "Pesquisa"];

export async function getRootDir() {
  const doc = await documentDir();
  return join(doc, RAIZ_NOME);
}

const REGEX_DIACRITICOS = new RegExp("[̀-ͯ]", "g");

export function slugify(titulo) {
  const base = titulo
    .toLowerCase()
    .normalize("NFD")
    .replace(REGEX_DIACRITICOS, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "projeto";
}

export async function gerarSlugUnico(titulo) {
  const root = await getRootDir();
  const base = slugify(titulo);
  let slug = base;
  let contador = 2;
  while (await exists(await join(root, slug))) {
    slug = `${base}-${contador}`;
    contador += 1;
  }
  return slug;
}
