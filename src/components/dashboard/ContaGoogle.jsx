import { useEffect, useState } from "react";
import { Cloud, CloudOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { statusLoginGoogle, logoutGoogle, iniciarLoginGoogle } from "../../lib/googleAuth";

export default function ContaGoogle() {
  const { t } = useTranslation();
  const [conectado, setConectado] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    statusLoginGoogle()
      .then(setConectado)
      .catch(() => setConectado(false));
  }, []);

  async function conectar() {
    setCarregando(true);
    setErro(null);
    try {
      await iniciarLoginGoogle();
      setConectado(true);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setCarregando(false);
    }
  }

  async function desconectar() {
    try {
      await logoutGoogle();
      setConectado(false);
    } catch (e) {
      setErro(e.message || String(e));
    }
  }

  if (conectado === null) return null;

  return (
    <div className="flex items-center gap-2 text-xs">
      {erro && <span className="max-w-xs truncate text-danger" title={erro}>{erro}</span>}
      {conectado ? (
        <button
          onClick={desconectar}
          title={t("contaGoogle.cliqueDesconectar")}
          className="flex items-center gap-1.5 text-ink-muted transition-colors hover:text-danger"
        >
          <Cloud size={14} className="text-gold" />
          {t("contaGoogle.conectadoAoDrive")}
        </button>
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
