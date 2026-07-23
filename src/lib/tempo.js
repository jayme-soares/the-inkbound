// Extraído de SincronizacaoDrive.jsx para ser reaproveitado também pelo
// histórico de versões — mesma necessidade ("há quanto tempo foi isso"),
// mesmas chaves de tradução (sincronizacao.*, que já eram genéricas o
// suficiente para não precisar de um namespace próprio).
export function formatarRelativo(iso, t) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutos = Math.round(diffMs / 60000);
  if (minutos < 1) return t("sincronizacao.agoraMesmo");
  if (minutos < 60) return t("sincronizacao.haMinutos", { n: minutos });
  const horas = Math.round(minutos / 60);
  if (horas < 24) return t("sincronizacao.haHoras", { n: horas });
  const dias = Math.round(horas / 24);
  return t("sincronizacao.haDias", { n: dias });
}
