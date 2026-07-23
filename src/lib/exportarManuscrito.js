import { marked } from "marked";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { contarPalavras } from "./palavras";

// Achata os tokens inline do marked (strong/em aninhados) numa lista plana de
// "runs" com os estilos já resolvidos — é o formato que os geradores de
// DOCX/PDF em Rust esperam (um run por trecho de texto com o mesmo
// negrito/itálico), evitando reimplementar a árvore de tokens do lado deles.
function achatarInline(tokens, negrito = false, italico = false) {
  const runs = [];
  for (const token of tokens ?? []) {
    if (token.type === "strong") {
      runs.push(...achatarInline(token.tokens, true, italico));
    } else if (token.type === "em") {
      runs.push(...achatarInline(token.tokens, negrito, true));
    } else if (token.type === "text" || token.type === "codespan" || token.type === "escape") {
      const texto = token.text ?? token.raw ?? "";
      if (texto) runs.push({ texto, negrito, italico });
    } else if (token.tokens) {
      runs.push(...achatarInline(token.tokens, negrito, italico));
    } else if (token.raw) {
      runs.push({ texto: token.raw, negrito, italico });
    }
  }
  return runs;
}

// Manuscritos de ficção são, na prática, só parágrafos + *itálico*/**negrito**
// + quebras de cena (---/***) — não há motivo pra suportar toda a superfície
// do Markdown (tabelas, imagens, código). Tipos de bloco não tratados
// explicitamente caem no fallback de vira-parágrafo, pra nunca sumir
// conteúdo silenciosamente da exportação só porque o usuário usou uma lista
// ou uma citação em algum lugar.
function montarBlocos(textoMarkdown) {
  const tokens = marked.lexer(textoMarkdown);
  const blocos = [];

  for (const token of tokens) {
    if (token.type === "heading") {
      blocos.push({ tipo: "titulo", runs: achatarInline(token.tokens) });
    } else if (token.type === "paragraph") {
      blocos.push({ tipo: "paragrafo", runs: achatarInline(token.tokens) });
    } else if (token.type === "hr") {
      blocos.push({ tipo: "quebraCena", runs: [] });
    } else if (token.type === "space") {
      continue;
    } else if (token.type === "list") {
      for (const item of token.items ?? []) {
        blocos.push({ tipo: "paragrafo", runs: achatarInline(item.tokens) });
      }
    } else if (token.tokens) {
      blocos.push({ tipo: "paragrafo", runs: achatarInline(token.tokens) });
    } else if (token.text) {
      blocos.push({ tipo: "paragrafo", runs: [{ texto: token.text, negrito: false, italico: false }] });
    }
  }

  return blocos;
}

function nomeCapitulo(nomeArquivo) {
  return nomeArquivo.replace(/\.md$/i, "");
}

// Monta o payload estruturado enviado ao comando Rust de exportação. A
// contagem de palavras é recalculada aqui a partir só dos arquivos
// incluídos/ordenados pelo usuário na tela de exportação — não usa
// projeto.contagemPalavras porque esse contador reflete o projeto inteiro
// (inclusive notas de pesquisa excluídas da exportação).
export async function montarPayloadExportacao({ arquivos, titulo, autor, contato }) {
  const capitulos = [];
  let contagemPalavras = 0;

  for (const arquivo of arquivos) {
    const texto = await readTextFile(arquivo.caminho);
    contagemPalavras += contarPalavras(texto);
    capitulos.push({
      titulo: nomeCapitulo(arquivo.nome),
      blocos: montarBlocos(texto),
    });
  }

  return {
    titulo,
    autor: autor || "",
    contato: contato || "",
    contagemPalavras,
    capitulos,
  };
}
