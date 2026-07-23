import { useCallback, useEffect, useState } from "react";
import { X, RotateCcw, Save } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { formatarRelativo } from "../../lib/tempo";
import { listarVersoes, obterConteudoVersao, criarVersao } from "../../lib/versoes";

export default function HistoricoVersoes({
  caminhoProjeto,
  caminhoRelativo,
  conteudoAtual,
  onClose,
  onRestaurar,
}) {
  const { t } = useTranslation();
  const [versoes, setVersoes] = useState(null);
  const [erro, setErro] = useState(null);
  const [restaurando, setRestaurando] = useState(null);
  const [salvandoCheckpoint, setSalvandoCheckpoint] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setVersoes(await listarVersoes(caminhoProjeto, caminhoRelativo));
      setErro(null);
    } catch (e) {
      setErro(e.message || String(e));
    }
  }, [caminhoProjeto, caminhoRelativo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarCheckpoint() {
    setSalvandoCheckpoint(true);
    try {
      await criarVersao(caminhoProjeto, caminhoRelativo, conteudoAtual, "manual");
      await carregar();
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setSalvandoCheckpoint(false);
    }
  }

  async function restaurar(id) {
    setRestaurando(id);
    try {
      const conteudo = await obterConteudoVersao(caminhoProjeto, id);
      if (conteudo === null) return;
      // Guarda o estado atual antes de sobrescrever — restaurar nunca deve
      // ser uma operação sem volta.
      await criarVersao(caminhoProjeto, caminhoRelativo, conteudoAtual, "manual");
      await onRestaurar(conteudo);
      onClose();
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setRestaurando(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border border-line bg-paper-2 p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">{t("historico.titulo")}</h2>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <button
          onClick={salvarCheckpoint}
          disabled={salvandoCheckpoint}
          className="mb-4 flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-hover disabled:opacity-60"
        >
          <Save size={14} />
          {salvandoCheckpoint ? t("historico.salvando") : t("historico.salvarAgora")}
        </button>

        {erro && <p className="mb-3 text-xs text-danger">{erro}</p>}

        <div className="flex-1 overflow-y-auto">
          {versoes === null ? (
            <p className="text-sm text-ink-muted">{t("historico.carregando")}</p>
          ) : versoes.length === 0 ? (
            <p className="text-sm text-ink-muted">{t("historico.nenhumaVersao")}</p>
          ) : (
            <ul className="space-y-2">
              {versoes.map((versao) => (
                <li
                  key={versao.id}
                  className="flex items-center justify-between rounded-lg border border-line bg-paper px-3 py-2"
                >
                  <div>
                    <p className="text-sm text-ink">{formatarRelativo(versao.criado_em, t)}</p>
                    <p className="text-xs text-ink-muted">
                      {versao.palavras} {t("editor.palavras")} ·{" "}
                      {versao.tipo === "manual" ? t("historico.manual") : t("historico.automatica")}
                    </p>
                  </div>
                  <button
                    onClick={() => restaurar(versao.id)}
                    disabled={restaurando !== null}
                    title={t("historico.restaurar")}
                    className="flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-gold disabled:opacity-60"
                  >
                    <RotateCcw size={14} />
                    {restaurando === versao.id ? t("historico.restaurando") : t("historico.restaurar")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
}
