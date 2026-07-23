import { join } from "@tauri-apps/api/path";
import { NOME_BANCO } from "./paths";
import { abrirBancoProjeto } from "./db";

// Data local (não UTC) no formato YYYY-MM-DD, para o "dia de escrita" bater
// com o fuso horário do autor, não com o fuso do servidor/UTC.
function dataDeHoje() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

// Garante uma "foto" da contagem total de palavras no início do dia de hoje,
// criada na primeira vez que alguém pede o progresso do dia (mesmo padrão de
// snapshot sob demanda já usado no histórico de versões automáticas). Dias
// anteriores continuam guardados na tabela, mas não são limpos — o volume é
// desprezível (uma linha por dia) e podem virar uma futura visão de
// histórico/sequência de dias escrevendo.
async function garantirSnapshotDoDia(db, contagemAtual) {
  const hoje = dataDeHoje();
  const linhas = await db.select("SELECT palavras_inicio_dia FROM progresso_diario WHERE data = $1", [
    hoje,
  ]);
  if (linhas.length > 0) return linhas[0].palavras_inicio_dia;

  await db.execute("INSERT INTO progresso_diario (data, palavras_inicio_dia) VALUES ($1, $2)", [
    hoje,
    contagemAtual,
  ]);
  return contagemAtual;
}

// `contagemAtual` é a contagem total já conhecida em memória
// (projeto.contagemPalavras) — evita reler o disco só para calcular o
// progresso. A meta em si já está disponível em projeto.metaDiariaPalavras,
// então não é reconsultada aqui.
export async function obterPalavrasHoje(caminhoProjeto, contagemAtual) {
  const caminhoBanco = await join(caminhoProjeto, NOME_BANCO);
  const db = await abrirBancoProjeto(caminhoBanco);
  const palavrasInicioDia = await garantirSnapshotDoDia(db, contagemAtual);
  return Math.max(0, contagemAtual - palavrasInicioDia);
}

export async function definirMetaDiaria(caminhoProjeto, meta) {
  const caminhoBanco = await join(caminhoProjeto, NOME_BANCO);
  const db = await abrirBancoProjeto(caminhoBanco);
  await db.execute("UPDATE projeto SET meta_diaria_palavras = $1", [meta || null]);
}
