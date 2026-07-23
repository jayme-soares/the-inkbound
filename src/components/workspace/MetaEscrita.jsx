import { useEffect, useState } from "react";
import { Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../../store/useAppStore";
import { obterPalavrasHoje, definirMetaDiaria } from "../../lib/metas";

export default function MetaEscrita({ projeto }) {
  const { t } = useTranslation();
  const atualizarMetaDiariaPalavras = useAppStore((s) => s.atualizarMetaDiariaPalavras);

  const [palavrasHoje, setPalavrasHoje] = useState(0);
  const [popoverAberto, setPopoverAberto] = useState(false);
  const [valorInput, setValorInput] = useState(projeto.metaDiariaPalavras ?? "");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    obterPalavrasHoje(projeto.caminho, projeto.contagemPalavras)
      .then((valor) => {
        if (ativo) setPalavrasHoje(valor);
      })
      .catch((e) => console.error("Falha ao calcular progresso do dia:", e));
    return () => {
      ativo = false;
    };
  }, [projeto.caminho, projeto.contagemPalavras]);

  useEffect(() => {
    setValorInput(projeto.metaDiariaPalavras ?? "");
  }, [projeto.metaDiariaPalavras]);

  async function salvar(e) {
    e.preventDefault();
    const meta = valorInput === "" ? null : Math.max(0, Number(valorInput));
    setSalvando(true);
    try {
      await definirMetaDiaria(projeto.caminho, meta);
      atualizarMetaDiariaPalavras(projeto.id, meta);
      setPopoverAberto(false);
    } catch (erro) {
      console.error("Falha ao salvar meta diária:", erro);
    } finally {
      setSalvando(false);
    }
  }

  const meta = projeto.metaDiariaPalavras;
  const progresso = meta ? Math.min(1, palavrasHoje / meta) : 0;

  return (
    <div className="relative">
      <button
        onClick={() => setPopoverAberto((v) => !v)}
        title={meta ? t("metas.progresso", { atual: palavrasHoje, meta }) : t("metas.titulo")}
        className="flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
      >
        <Target size={14} />
        {meta ? (
          <>
            <span>
              {palavrasHoje}/{meta}
            </span>
            <span className="h-1 w-10 overflow-hidden rounded-full bg-line">
              <span
                className="block h-full bg-gold"
                style={{ width: `${Math.round(progresso * 100)}%` }}
              />
            </span>
          </>
        ) : (
          <span>{t("metas.definir")}</span>
        )}
      </button>

      {popoverAberto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPopoverAberto(false)} />
          <form
            onSubmit={salvar}
            className="absolute right-0 top-full z-50 mt-2 w-52 rounded-lg border border-line bg-paper-2 p-3 shadow-lg"
          >
            <label className="mb-2 block text-xs text-ink-muted">{t("metas.metaDiaria")}</label>
            <input
              type="number"
              min="0"
              step="1"
              value={valorInput}
              onChange={(e) => setValorInput(e.target.value)}
              placeholder="500"
              autoFocus
              className="mb-2 w-full rounded-lg border border-line bg-paper px-2 py-1 text-sm text-ink outline-none focus:border-gold"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={salvando}
                className="rounded-lg bg-gold px-3 py-1 text-xs font-medium text-gold-fg transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {salvando ? t("metas.salvando") : t("metas.salvar")}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
