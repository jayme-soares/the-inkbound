import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/useAppStore";
import { statusLoginGoogle } from "../../lib/googleAuth";
import { descobrirProjetosDrive } from "../../lib/driveSync";
import LogoMarca from "../LogoMarca";
import ToggleTema from "../ToggleTema";
import ToggleIdioma from "../ToggleIdioma";
import NewProjectModal from "./NewProjectModal";
import ContaGoogle from "./ContaGoogle";

function formatarData(iso, idioma) {
  return new Date(iso).toLocaleDateString(idioma);
}

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const projetos = useAppStore((s) => s.projetos);
  const termoBusca = useAppStore((s) => s.termoBusca);
  const carregando = useAppStore((s) => s.carregando);
  const erro = useAppStore((s) => s.erro);
  const setTermoBusca = useAppStore((s) => s.setTermoBusca);
  const carregarProjetos = useAppStore((s) => s.carregarProjetos);
  const abrirProjeto = useAppStore((s) => s.abrirProjeto);
  const excluirProjeto = useAppStore((s) => s.excluirProjeto);

  const [modalAberto, setModalAberto] = useState(false);
  const [verificandoDrive, setVerificandoDrive] = useState(false);
  const [erroDrive, setErroDrive] = useState(null);

  useEffect(() => {
    let ativo = true;

    async function inicializar() {
      // O carregamento inicial já roda em App.jsx (por trás da tela de
      // carregamento) — aqui só falta checar o Drive por projetos novos.
      const conectado = await statusLoginGoogle().catch(() => false);
      if (!ativo || !conectado) return;

      setVerificandoDrive(true);
      try {
        const titulosLocais = new Set(useAppStore.getState().projetos.map((p) => p.titulo));
        const novosProjetos = await descobrirProjetosDrive(titulosLocais);
        if (ativo && novosProjetos.length > 0) {
          await carregarProjetos();
        }
      } catch (e) {
        if (ativo) setErroDrive(e.message || String(e));
      } finally {
        if (ativo) setVerificandoDrive(false);
      }
    }

    inicializar();
    return () => {
      ativo = false;
    };
  }, [carregarProjetos]);

  const projetosFiltrados = useMemo(() => {
    const termo = termoBusca.trim().toLowerCase();
    if (!termo) return projetos;
    return projetos.filter((p) => p.titulo.toLowerCase().includes(termo));
  }, [projetos, termoBusca]);

  return (
    <main className="min-h-screen bg-paper p-8 text-ink">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMarca size={26} className="text-gold" />
            <h1 className="font-display text-2xl font-semibold tracking-tight">{t("app.wordmark")}</h1>
          </div>
          <div className="flex items-center gap-4">
            {verificandoDrive && (
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                <RefreshCw size={12} className="animate-spin" />
                {t("dashboard.verificandoDrive")}
              </span>
            )}
            <ContaGoogle />
            <ToggleIdioma />
            <ToggleTema />
            <button
              onClick={() => setModalAberto(true)}
              className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-gold-fg transition-opacity hover:opacity-90"
            >
              <Plus size={16} />
              {t("dashboard.novoProjeto")}
            </button>
          </div>
        </header>

        <div className="relative mb-6">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder={t("dashboard.buscarPlaceholder")}
            className="w-full rounded-lg border border-line bg-paper-2 py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-gold"
          />
        </div>

        {erro && (
          <p className="mb-4 rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger">
            {t("dashboard.erroDisco")}: {erro}
          </p>
        )}

        {erroDrive && (
          <p className="mb-4 rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger">
            {t("dashboard.erroDrive")}: {erroDrive}
          </p>
        )}

        {carregando ? (
          <p className="text-sm text-ink-muted">{t("dashboard.carregandoProjetos")}</p>
        ) : projetosFiltrados.length === 0 ? (
          <p className="text-sm text-ink-muted">
            {projetos.length === 0
              ? t("dashboard.nenhumProjetoAinda")
              : t("dashboard.nenhumProjetoEncontrado")}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence>
              {projetosFiltrados.map((projeto) => (
                <motion.div
                  key={projeto.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="group relative cursor-pointer rounded-xl border border-line bg-paper-2 p-4 transition-colors hover:border-gold/50"
                  onClick={() => abrirProjeto(projeto.id)}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      excluirProjeto(projeto.id).catch((erroExclusao) =>
                        console.error("Falha ao excluir projeto:", erroExclusao),
                      );
                    }}
                    className="absolute right-3 top-3 text-ink-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                  <h2 className="mb-1 pr-6 font-medium text-ink">{projeto.titulo}</h2>
                  <p className="mb-3 text-xs text-ink-muted">
                    {projeto.genero || t("dashboard.semGenero")}
                  </p>
                  <div className="flex items-center justify-between text-xs text-ink-muted">
                    <span>{projeto.contagemPalavras} {t("dashboard.palavras")}</span>
                    <span>{formatarData(projeto.dataCriacao, i18n.language)}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {modalAberto && <NewProjectModal onClose={() => setModalAberto(false)} />}
    </main>
  );
}
