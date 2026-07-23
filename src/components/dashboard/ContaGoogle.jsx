import { useEffect } from "react";
import { Cloud, CloudOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useContaGoogleStore } from "../../store/useContaGoogleStore";

// Só conecta por aqui — desconectar mora nas Configurações agora, de
// propósito, pra evitar que um clique acidental neste botão do cabeçalho
// derrube a conexão sem querer.
export default function ContaGoogle() {
  const { t } = useTranslation();
  const conectado = useContaGoogleStore((s) => s.conectado);
  const carregando = useContaGoogleStore((s) => s.carregando);
  const erro = useContaGoogleStore((s) => s.erro);
  const conectar = useContaGoogleStore((s) => s.conectar);
  const verificarStatus = useContaGoogleStore((s) => s.verificarStatus);

  useEffect(() => {
    verificarStatus();
  }, [verificarStatus]);

  if (conectado === null) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      {erro && <span className="max-w-xs truncate text-danger" title={erro}>{erro}</span>}
      {conectado ? (
        <span className="flex items-center gap-1.5 text-ink-muted">
          <Cloud size={14} className="text-gold" />
          {t("contaGoogle.conectadoAoDrive")}
        </span>
      ) : (
        <button
          onClick={conectar}
          disabled={carregando}
          className="flex items-center gap-1.5 text-ink-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          <CloudOff size={14} />
          {carregando ? t("contaGoogle.conectando") : t("contaGoogle.conectarAoDrive")}
        </button>
      )}
    </div>
  );
}
