import { RefreshCw, CloudOff, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatarRelativo } from "../../lib/tempo";

export default function SincronizacaoDrive({
  conectado,
  sincronizando,
  resumo,
  erro,
  ultimaSincronizacao,
  onSincronizar,
}) {
  const { t, i18n } = useTranslation();

  if (conectado === null) return null;

  if (!conectado) {
    return (
      <span
        className="flex items-center gap-1.5 text-xs text-ink-muted"
        title={t("sincronizacao.conecteNoDashboard")}
      >
        <CloudOff size={14} />
        {t("sincronizacao.driveDesconectado")}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs">
      {erro && (
        <span className="max-w-xs truncate text-danger" title={erro}>
          {erro}
        </span>
      )}
      {!erro && resumo?.conflitos?.length > 0 && (
        <span
          className="flex items-center gap-1 text-gold"
          title={t("sincronizacao.conflitosTitle", { lista: resumo.conflitos.join(", ") })}
        >
          <AlertTriangle size={14} />
          {t("sincronizacao.conflitos", { count: resumo.conflitos.length })}
        </span>
      )}
      {!erro && resumo && resumo.conflitos?.length === 0 && (
        <span className="text-ink-muted">
          {t("sincronizacao.resumo", {
            enviados: resumo.enviados,
            baixados: resumo.baixados,
            excluidos: resumo.excluidos,
          })}
        </span>
      )}
      {!sincronizando && ultimaSincronizacao && (
        <span
          className="text-ink-muted"
          title={new Date(ultimaSincronizacao).toLocaleString(i18n.language)}
        >
          {t("sincronizacao.ultimaSincronizacao", { tempo: formatarRelativo(ultimaSincronizacao, t) })}
        </span>
      )}
      <button
        onClick={onSincronizar}
        disabled={sincronizando}
        className="flex items-center gap-1.5 text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
      >
        <RefreshCw size={14} className={sincronizando ? "animate-spin" : ""} />
        {sincronizando ? t("sincronizacao.sincronizando") : t("sincronizacao.sincronizar")}
      </button>
    </div>
  );
}
