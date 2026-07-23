import { join } from "@tauri-apps/api/path";
import { abrirBancoProjeto } from "./db";
import { NOME_BANCO } from "./paths";
import { contarPalavras } from "./palavras";

const MAX_VERSOES_AUTOMATICAS = 20;
const JANELA_THROTTLE_MS = 10 * 60 * 1000; // 10 min

export function caminhoRelativoDoArquivo(caminhoProjeto, caminhoArquivo) {
  return caminhoArquivo.slice(caminhoProjeto.length + 1).replace(/\\/g, "/");
}

async function abrirBanco(caminhoProjeto) {
  const caminhoBanco = await join(caminhoProjeto, NOME_BANCO);
  return abrirBancoProjeto(caminhoBanco);
}

export async function criarVersao(caminhoProjeto, caminhoRelativo, conteudo, tipo) {
  const db = await abrirBanco(caminhoProjeto);
  const id = crypto.randomUUID();
  const agora = new Date().toISOString();
  await db.execute(
    `INSERT INTO versoes_documento (id, caminho_relativo, conteudo, palavras, tipo, criado_em)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, caminhoRelativo, conteudo, contarPalavras(conteudo), tipo, agora],
  );

  if (tipo === "automatica") {
    // Mantém só as N mais recentes por arquivo — versões manuais nunca são
    // podadas automaticamente, é o autor quem decide se ainda quer aquele
    // marco.
    await db.execute(
      `DELETE FROM versoes_documento
       WHERE caminho_relativo = $1 AND tipo = 'automatica'
         AND id NOT IN (
           SELECT id FROM versoes_documento
           WHERE caminho_relativo = $2 AND tipo = 'automatica'
           ORDER BY criado_em DESC LIMIT $3
         )`,
      [caminhoRelativo, caminhoRelativo, MAX_VERSOES_AUTOMATICAS],
    );
  }

  return id;
}

// Chamada ao abrir um arquivo no editor: registra um marco automático do
// estado "antes de eu começar a mexer agora", mas só se a última versão
// automática desse arquivo tiver mais de 10 minutos — evita empilhar uma
// versão idêntica a cada vez que o autor só passa o olho num capítulo e
// fecha de novo.
export async function talvezCriarVersaoAutomatica(caminhoProjeto, caminhoRelativo, conteudo) {
  const db = await abrirBanco(caminhoProjeto);
  const linhas = await db.select(
    `SELECT criado_em FROM versoes_documento
     WHERE caminho_relativo = $1 AND tipo = 'automatica'
     ORDER BY criado_em DESC LIMIT 1`,
    [caminhoRelativo],
  );
  const ultima = linhas[0]?.criado_em;
  if (ultima && Date.now() - new Date(ultima).getTime() < JANELA_THROTTLE_MS) return;

  await criarVersao(caminhoProjeto, caminhoRelativo, conteudo, "automatica");
}

export async function listarVersoes(caminhoProjeto, caminhoRelativo) {
  const db = await abrirBanco(caminhoProjeto);
  return db.select(
    `SELECT id, palavras, tipo, criado_em FROM versoes_documento
     WHERE caminho_relativo = $1
     ORDER BY criado_em DESC`,
    [caminhoRelativo],
  );
}

export async function obterConteudoVersao(caminhoProjeto, id) {
  const db = await abrirBanco(caminhoProjeto);
  const linhas = await db.select("SELECT conteudo FROM versoes_documento WHERE id = $1", [id]);
  return linhas[0]?.conteudo ?? null;
}
