import { useState } from "react";
import { X } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/useAppStore";

export default function NewProjectModal({ onClose }) {
  const { t } = useTranslation();
  const criarProjeto = useAppStore((s) => s.criarProjeto);
  const [titulo, setTitulo] = useState("");
  const [genero, setGenero] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!titulo.trim() || salvando) return;
    setSalvando(true);
    setErro(null);
    try {
      await criarProjeto({ titulo: titulo.trim(), genero: genero.trim() });
      onClose();
    } catch (e) {
      setErro(String(e));
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <motion.form
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-xl border border-line bg-paper-2 p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">{t("novoProjetoModal.titulo")}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-muted hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <label className="mb-3 block text-xs text-ink-muted">
          {t("novoProjetoModal.campoTitulo")}
          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </label>

        <label className="mb-4 block text-xs text-ink-muted">
          {t("novoProjetoModal.campoGenero")}
          <input
            value={genero}
            onChange={(e) => setGenero(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </label>

        {erro && (
          <p className="mb-3 text-xs text-danger">{t("novoProjetoModal.erroCriar")}: {erro}</p>
        )}

        <button
          type="submit"
          disabled={salvando}
          className="w-full rounded-lg bg-gold py-2 text-sm font-medium text-gold-fg transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {salvando ? t("novoProjetoModal.criando") : t("novoProjetoModal.criar")}
        </button>
      </motion.form>
    </div>
  );
}
