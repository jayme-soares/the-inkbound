import { Download, ChevronUp, ChevronDown, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useExportarManuscrito } from "../../hooks/useExportarManuscrito";

export default function ExportarManuscrito({ projeto }) {
  const { t } = useTranslation();
  const {
    arquivos,
    erroLista,
    autor,
    setAutor,
    contato,
    setContato,
    salvarAutorContato,
    alternarInclusao,
    mover,
    exportando,
    erroExportacao,
    sucesso,
    exportar,
  } = useExportarManuscrito(projeto);

  const temIncluidos = (arquivos ?? []).some((a) => a.incluido);

  return (
    <div className="mx-auto max-w-2xl overflow-y-auto p-8">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
        <Download size={16} className="text-gold" />
        {t("exportar.titulo")}
      </h2>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="block text-xs text-ink-muted">
          {t("exportar.autor")}
          <input
            value={autor}
            onChange={(e) => setAutor(e.target.value)}
            onBlur={salvarAutorContato}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </label>
        <label className="block text-xs text-ink-muted">
          {t("exportar.contato")}
          <input
            value={contato}
            onChange={(e) => setContato(e.target.value)}
            onBlur={salvarAutorContato}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-gold"
          />
        </label>
      </div>

      {erroLista && <p className="mb-3 text-xs text-danger">{erroLista}</p>}

      {arquivos === null ? (
        <p className="text-sm text-ink-muted">{t("exportar.carregando")}</p>
      ) : arquivos.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("exportar.semCapitulos")}</p>
      ) : (
        <ul className="mb-4 space-y-1">
          {arquivos.map((arquivo, indice) => (
            <li
              key={arquivo.caminhoRelativo}
              className="flex items-center gap-2 rounded-lg border border-line bg-paper-2 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={arquivo.incluido}
                onChange={() => alternarInclusao(arquivo.caminhoRelativo)}
              />
              <FileText size={14} className="text-ink-muted" />
              <span className="flex-1 truncate text-sm text-ink" title={arquivo.caminhoRelativo}>
                {arquivo.nome}
              </span>
              <button
                onClick={() => mover(indice, -1)}
                disabled={indice === 0}
                title={t("exportar.moverCima")}
                className="text-ink-muted hover:text-gold disabled:opacity-30"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={() => mover(indice, 1)}
                disabled={indice === arquivos.length - 1}
                title={t("exportar.moverBaixo")}
                className="text-ink-muted hover:text-gold disabled:opacity-30"
              >
                <ChevronDown size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {erroExportacao && (
        <p className="mb-3 text-xs text-danger">
          {t("exportar.erro")}: {erroExportacao}
        </p>
      )}
      {sucesso && <p className="mb-3 text-xs text-ink-muted">{t("exportar.sucesso", { caminho: sucesso })}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => exportar("pdf")}
          disabled={exportando || !temIncluidos}
          className="flex items-center gap-1.5 rounded-lg bg-gold px-4 py-2 text-sm font-medium text-gold-fg transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {exportando ? t("exportar.exportando") : t("exportar.exportarPdf")}
        </button>
        <button
          onClick={() => exportar("docx")}
          disabled={exportando || !temIncluidos}
          className="flex items-center gap-1.5 rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-hover disabled:opacity-60"
        >
          {exportando ? t("exportar.exportando") : t("exportar.exportarDocx")}
        </button>
      </div>
    </div>
  );
}
