import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { Eye, EyeOff, Maximize2, Minimize2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { lerDocumento, escreverDocumentoAtomico } from "../../lib/documentos";
import { contarPalavras } from "../../lib/palavras";

const ATRASO_AUTOSAVE_MS = 800;

export default function Editor({ caminhoArquivo, onSalvo, focusMode, onAlternarFocusMode }) {
  const { t } = useTranslation();
  const [conteudo, setConteudo] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [mostrarPreview, setMostrarPreview] = useState(true);

  const conteudoRef = useRef("");
  const ultimoSalvoRef = useRef("");
  const timerRef = useRef(null);
  const onSalvoRef = useRef(onSalvo);
  onSalvoRef.current = onSalvo;

  useEffect(() => {
    conteudoRef.current = conteudo;
  }, [conteudo]);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);

    lerDocumento(caminhoArquivo)
      .then((texto) => {
        if (!ativo) return;
        setConteudo(texto);
        conteudoRef.current = texto;
        ultimoSalvoRef.current = texto;
        setCarregando(false);
      })
      .catch((e) => {
        if (!ativo) return;
        setErro(String(e));
        setCarregando(false);
      });

    return () => {
      ativo = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      if (conteudoRef.current !== ultimoSalvoRef.current) {
        escreverDocumentoAtomico(caminhoArquivo, conteudoRef.current).then(() =>
          onSalvoRef.current?.(),
        );
      }
    };
  }, [caminhoArquivo]);

  function handleChange(novoTexto) {
    setConteudo(novoTexto);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => salvar(novoTexto), ATRASO_AUTOSAVE_MS);
  }

  async function salvar(texto) {
    if (texto === ultimoSalvoRef.current) return;
    setSalvando(true);
    try {
      await escreverDocumentoAtomico(caminhoArquivo, texto);
      ultimoSalvoRef.current = texto;
      onSalvoRef.current?.();
    } catch (e) {
      setErro(String(e));
    } finally {
      setSalvando(false);
    }
  }

  const html = useMemo(() => marked.parse(conteudo || ""), [conteudo]);
  const palavras = useMemo(() => contarPalavras(conteudo), [conteudo]);

  if (carregando) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-ink-muted">
        {t("editor.carregando")}
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-ink-muted">
        <span>
          {palavras} {t("editor.palavras")}{salvando && ` · ${t("editor.salvando")}`}
          {erro && <span className="text-danger"> · {erro}</span>}
        </span>
        <div className="flex items-center gap-3">
          {!focusMode && (
            <button
              onClick={() => setMostrarPreview((v) => !v)}
              className="flex items-center gap-1 hover:text-ink"
            >
              {mostrarPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              {t("editor.preview")}
            </button>
          )}
          <button
            onClick={onAlternarFocusMode}
            className="flex items-center gap-1 hover:text-ink"
          >
            {focusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {t("editor.focus")}
          </button>
        </div>
      </div>

      <div className={`flex flex-1 overflow-hidden ${focusMode ? "justify-center" : ""}`}>
        <textarea
          value={conteudo}
          onChange={(e) => handleChange(e.target.value)}
          spellCheck={false}
          className={`h-full resize-none bg-paper p-6 text-sm leading-relaxed text-ink outline-none ${
            focusMode
              ? "w-full max-w-2xl"
              : mostrarPreview
                ? "w-1/2 border-r border-line"
                : "w-full"
          }`}
        />
        {mostrarPreview && !focusMode && (
          <div
            className="prose prose-sm dark:prose-invert w-1/2 max-w-none overflow-y-auto bg-paper p-6"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
}
