import { getVersion } from "@tauri-apps/api/app";

// Repositório é privado por enquanto — a API pública do GitHub não enxerga
// releases de repositórios privados sem autenticação, então a checagem
// falha com 404 até o repositório ficar público. Esperado, não é um erro de
// verdade: verificarAtualizacao() propaga o erro, e quem chama decide como
// tratar isso silenciosamente (ver useAtualizacaoStore).
const URL_RELEASES = "https://api.github.com/repos/jayme-soares/the-inkbound/releases/latest";

function compararVersoes(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function verificarAtualizacao() {
  const versaoAtual = await getVersion();
  const resposta = await fetch(URL_RELEASES);
  if (!resposta.ok) {
    throw new Error(`Não foi possível verificar atualizações (${resposta.status})`);
  }
  const dados = await resposta.json();
  const versaoMaisNova = String(dados.tag_name || "").replace(/^v/, "");

  return {
    versaoAtual,
    versaoMaisNova,
    urlRelease: dados.html_url,
    temNova: Boolean(versaoMaisNova) && compararVersoes(versaoMaisNova, versaoAtual) > 0,
  };
}
