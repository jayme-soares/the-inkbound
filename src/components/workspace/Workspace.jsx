import { useState } from "react";
import { ArrowLeft, FileText, PenLine, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/useAppStore";
import { recalcularContagemProjeto } from "../../lib/palavras";
import { useSincronizacaoDrive } from "../../hooks/useSincronizacaoDrive";
import ToggleTema from "../ToggleTema";
import ToggleIdioma from "../ToggleIdioma";
import Sidebar from "./Sidebar";
import Editor from "./Editor";
import Fichas from "./Fichas";
import SincronizacaoDrive from "./SincronizacaoDrive";

export default function Workspace() {
  const { t } = useTranslation();
  const projetoAtivo = useAppStore((s) => s.projetoAtivo);
  const fecharProjeto = useAppStore((s) => s.fecharProjeto);
  const atualizarContagemPalavras = useAppStore((s) => s.atualizarContagemPalavras);

  const [aba, setAba] = useState("escrita");
  const [arquivoAtivo, setArquivoAtivo] = useState(null);
  const [focusMode, setFocusMode] = useState(false);

  const sincronizacao = useSincronizacaoDrive({
    caminho: projetoAtivo?.caminho,
    titulo: projetoAtivo?.titulo,
  });

  if (!projetoAtivo) return null;

  async function aoSalvarDocumento() {
    try {
      const total = await recalcularContagemProjeto(projetoAtivo.caminho);
      atualizarContagemPalavras(projetoAtivo.id, total);
    } catch (e) {
      console.error("Falha ao recalcular contagem de palavras:", e);
    }
  }

  return (
    <div className="flex h-screen w-screen bg-paper text-ink">
      {!focusMode && (
        <Sidebar
          projeto={projetoAtivo}
          onAbrirArquivo={(caminho) => {
            setArquivoAtivo(caminho);
            setAba("escrita");
          }}
          arquivoAtivo={arquivoAtivo}
          onAlteracaoArquivos={sincronizacao.agendarSincronizacao}
        />
      )}
      <main className="flex flex-1 flex-col">
        {!focusMode && (
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <button
              onClick={fecharProjeto}
              className="flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft size={16} />
              {t("workspace.projetos")}
            </button>
            <span className="text-ink-muted">/</span>
            <h1 className="text-sm font-medium text-ink">{projetoAtivo.titulo}</h1>

            <div className="ml-auto flex items-center gap-4">
              <SincronizacaoDrive
                conectado={sincronizacao.conectado}
                sincronizando={sincronizacao.sincronizando}
                resumo={sincronizacao.resumo}
                erro={sincronizacao.erro}
                ultimaSincronizacao={sincronizacao.ultimaSincronizacao}
                onSincronizar={sincronizacao.sincronizar}
              />
              <div className="flex gap-1">
                <button
                  onClick={() => setAba("escrita")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs transition-colors ${
                    aba === "escrita"
                      ? "bg-hover text-ink"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <PenLine size={14} />
                  {t("workspace.abaEscrita")}
                </button>
                <button
                  onClick={() => setAba("fichas")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs transition-colors ${
                    aba === "fichas"
                      ? "bg-hover text-ink"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  <Users size={14} />
                  {t("workspace.abaFichas")}
                </button>
              </div>
              <ToggleIdioma />
              <ToggleTema />
            </div>
          </header>
        )}

        {aba === "fichas" ? (
          <Fichas caminhoProjeto={projetoAtivo.caminho} />
        ) : arquivoAtivo ? (
          <Editor
            caminhoArquivo={arquivoAtivo}
            onSalvo={aoSalvarDocumento}
            focusMode={focusMode}
            onAlternarFocusMode={() => setFocusMode((v) => !v)}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">
            <div className="flex flex-col items-center gap-2">
              <FileText size={28} className="text-ink-muted/60" />
              {t("workspace.selecioneArquivo")}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
