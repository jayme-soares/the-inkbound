import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import {
  Bold,
  Eye,
  EyeOff,
  History,
  Italic,
  Maximize2,
  Minimize2,
  SeparatorHorizontal,
  Underline,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { lerDocumento, escreverDocumentoAtomico } from "../../lib/documentos";
import { contarCaracteres, contarPalavras } from "../../lib/palavras";
import { caminhoRelativoDoArquivo, talvezCriarVersaoAutomatica } from "../../lib/versoes";
import HistoricoVersoes from "./HistoricoVersoes";

const ATRASO_AUTOSAVE_MS = 800;

// Botões da toolbar de formatação: envolvem a seleção atual com a sintaxe
// Markdown correspondente (ou inserem um marcador de texto se nada estiver
// selecionado). "sublinhado" não tem sintaxe nativa em Markdown — usa a tag
// HTML <u>, que o `marked` já renderiza sem configuração extra.
const BOTOES_FORMATACAO = [
  { chave: "negrito", Icone: Bold, prefixo: "**", sufixo: "**" },
  { chave: "italico", Icone: Italic, prefixo: "*", sufixo: "*" },
  { chave: "sublinhado", Icone: Underline, prefixo: "<u>", sufixo: "</u>" },
];

export default function Editor({ projeto, caminhoArquivo, onSalvo, focusMode, onAlternarFocusMode }) {
  const { t } = useTranslation();
  const [conteudo, setConteudo] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const [mostrarPreview, setMostrarPreview] = useState(true);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const caminhoRelativo = caminhoRelativoDoArquivo(projeto.caminho, caminhoArquivo);

  const conteudoRef = useRef("");
  const ultimoSalvoRef = useRef("");
  const timerRef = useRef(null);
  const textareaRef = useRef(null);
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
        // Marco do estado "antes de eu começar a mexer agora" — melhor
        // esforço, não deve travar a abertura do arquivo se falhar.
        talvezCriarVersaoAutomatica(projeto.caminho, caminhoRelativo, texto).catch((e) =>
          console.error("Falha ao registrar versão automática:", e),
        );
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
  }, [caminhoArquivo, projeto.caminho, caminhoRelativo]);

  function handleChange(novoTexto) {
    setConteudo(novoTexto);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => salvar(novoTexto), ATRASO_AUTOSAVE_MS);
  }

  // Envolve a seleção atual do textarea com prefixo/sufixo (ou insere um
  // marcador de texto no lugar do cursor, se nada estiver selecionado), e
  // reposiciona a seleção para o trecho recém-formatado depois do
  // re-render — sem isso o cursor pularia para o fim do texto a cada clique.
  function aplicarFormatacao(prefixo, sufixo) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const inicio = textarea.selectionStart;
    const fim = textarea.selectionEnd;
    const selecionado = conteudo.slice(inicio, fim) || t("editor.textoPadrao");
    const novoConteudo = conteudo.slice(0, inicio) + prefixo + selecionado + sufixo + conteudo.slice(fim);
    handleChange(novoConteudo);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(inicio + prefixo.length, inicio + prefixo.length + selecionado.length);
    });
  }

  function inserirQuebraCena() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const inicio = textarea.selectionStart;
    const marcador = "\n\n***\n\n";
    const novoConteudo = conteudo.slice(0, inicio) + marcador + conteudo.slice(inicio);
    handleChange(novoConteudo);
    requestAnimationFrame(() => {
      textarea.focus();
      const posicao = inicio + marcador.length;
      textarea.setSelectionRange(posicao, posicao);
    });
  }

  async function aoRestaurarVersao(conteudoRestaurado) {
    await escreverDocumentoAtomico(caminhoArquivo, conteudoRestaurado);
    setConteudo(conteudoRestaurado);
    conteudoRef.current = conteudoRestaurado;
    ultimoSalvoRef.current = conteudoRestaurado;
    onSalvoRef.current?.();
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
  const caracteres = useMemo(() => contarCaracteres(conteudo), [conteudo]);

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
          {palavras} {t("editor.palavras")} · {caracteres} {t("editor.caracteres")}
          {salvando && ` · ${t("editor.salvando")}`}
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

      {!focusMode && (
        <div className="flex items-center gap-1 border-b border-line px-4 py-1.5">
          {BOTOES_FORMATACAO.map(({ chave, Icone, prefixo, sufixo }) => (
            <button
              key={chave}
              onClick={() => aplicarFormatacao(prefixo, sufixo)}
              title={t(`editor.${chave}`)}
              className="rounded p-1.5 text-ink-muted hover:bg-hover hover:text-ink"
            >
              <Icone size={14} />
            </button>
          ))}
          <button
            onClick={inserirQuebraCena}
            title={t("editor.quebraCena")}
            className="rounded p-1.5 text-ink-muted hover:bg-hover hover:text-ink"
          >
            <SeparatorHorizontal size={14} />
          </button>
          <button
            onClick={() => setHistoricoAberto(true)}
            title={t("historico.titulo")}
            className="ml-auto rounded p-1.5 text-ink-muted hover:bg-hover hover:text-ink"
          >
            <History size={14} />
          </button>
        </div>
      )}

      <div className={`flex flex-1 overflow-hidden ${focusMode ? "justify-center" : ""}`}>
        <textarea
          ref={textareaRef}
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

      {historicoAberto && (
        <HistoricoVersoes
          caminhoProjeto={projeto.caminho}
          caminhoRelativo={caminhoRelativo}
          conteudoAtual={conteudo}
          onClose={() => setHistoricoAberto(false)}
          onRestaurar={aoRestaurarVersao}
        />
      )}
    </div>
  );
}
