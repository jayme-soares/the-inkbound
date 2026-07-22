import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  FolderPlus,
  FilePlus,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  listarEntradas,
  criarPasta,
  criarArquivo,
  excluirEntrada,
  renomearEntrada,
} from "../../lib/arvoreArquivos";

function NovaEntradaInput({ tipo, nivel, onConfirmar, onCancelar }) {
  const { t } = useTranslation();
  const [nome, setNome] = useState("");

  function confirmar() {
    if (nome.trim()) onConfirmar(nome.trim());
    else onCancelar();
  }

  return (
    <form
      style={{ paddingLeft: `${nivel * 14 + 22}px` }}
      onSubmit={(e) => {
        e.preventDefault();
        confirmar();
      }}
      className="pr-2 py-0.5"
    >
      <input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={confirmar}
        onKeyDown={(e) => e.key === "Escape" && onCancelar()}
        placeholder={tipo === "pasta" ? t("sidebar.placeholderPasta") : t("sidebar.placeholderArquivo")}
        className="w-full rounded border border-gold/60 bg-paper px-2 py-0.5 text-xs text-ink outline-none"
      />
    </form>
  );
}

function Nodo({ item, caminhoPai, nivel, onMudou, onAbrirArquivo, arquivoAtivo, onAlteracaoArquivos }) {
  const { t } = useTranslation();
  const [aberto, setAberto] = useState(false);
  const [filhos, setFilhos] = useState(null);
  const [renomeando, setRenomeando] = useState(false);
  const [novoNome, setNovoNome] = useState(item.nome);
  const [criando, setCriando] = useState(null);
  const [erro, setErro] = useState(null);

  const ehPasta = item.tipo === "pasta";

  const carregarFilhos = useCallback(async () => {
    setFilhos(await listarEntradas(item.caminho));
  }, [item.caminho]);

  async function alternar() {
    if (!ehPasta) {
      onAbrirArquivo(item.caminho);
      return;
    }
    if (!aberto && filhos === null) {
      try {
        await carregarFilhos();
      } catch (e) {
        setErro(String(e));
        return;
      }
    }
    setAberto((v) => !v);
  }

  async function confirmarRenomeio() {
    setRenomeando(false);
    const nome = novoNome.trim();
    if (!nome || nome === item.nome) {
      setNovoNome(item.nome);
      return;
    }
    try {
      await renomearEntrada(item.caminho, caminhoPai, nome);
      await onMudou();
      onAlteracaoArquivos?.();
    } catch (e) {
      setErro(String(e));
      setNovoNome(item.nome);
    }
  }

  async function excluir(e) {
    e.stopPropagation();
    try {
      await excluirEntrada(item.caminho);
      await onMudou();
      onAlteracaoArquivos?.();
    } catch (e) {
      setErro(String(e));
    }
  }

  async function criarFilho(nome) {
    try {
      if (criando === "pasta") await criarPasta(item.caminho, nome);
      else await criarArquivo(item.caminho, nome);
      setCriando(null);
      await carregarFilhos();
      setAberto(true);
      onAlteracaoArquivos?.();
    } catch (e) {
      setErro(String(e));
      setCriando(null);
    }
  }

  return (
    <div>
      <div
        style={{ paddingLeft: `${nivel * 14}px` }}
        onClick={alternar}
        className={`group flex items-center gap-1.5 rounded px-2 py-1 text-sm cursor-pointer hover:bg-hover ${
          !ehPasta && item.caminho === arquivoAtivo
            ? "bg-hover text-gold"
            : "text-ink"
        }`}
      >
        {ehPasta ? (
          aberto ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        ) : (
          <span className="w-3.5" />
        )}
        {ehPasta ? (
          <Folder size={14} className="text-gold/80" />
        ) : (
          <FileText size={14} className="text-ink-muted" />
        )}

        {renomeando ? (
          <input
            autoFocus
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={confirmarRenomeio}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmarRenomeio();
              if (e.key === "Escape") {
                setRenomeando(false);
                setNovoNome(item.nome);
              }
            }}
            className="flex-1 rounded border border-gold bg-paper px-1 text-xs text-ink outline-none"
          />
        ) : (
          <span
            className="flex-1 truncate"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenomeando(true);
            }}
          >
            {item.nome}
          </span>
        )}

        <span className="hidden items-center gap-1 group-hover:flex">
          {ehPasta && (
            <>
              <button
                title={t("sidebar.novaPasta")}
                onClick={(e) => {
                  e.stopPropagation();
                  setAberto(true);
                  setCriando("pasta");
                }}
                className="text-ink-muted hover:text-gold"
              >
                <FolderPlus size={12} />
              </button>
              <button
                title={t("sidebar.novoArquivo")}
                onClick={(e) => {
                  e.stopPropagation();
                  setAberto(true);
                  setCriando("arquivo");
                }}
                className="text-ink-muted hover:text-gold"
              >
                <FilePlus size={12} />
              </button>
            </>
          )}
          <button
            title={t("sidebar.excluir")}
            onClick={excluir}
            className="text-ink-muted hover:text-danger"
          >
            <Trash2 size={12} />
          </button>
        </span>
      </div>

      {erro && (
        <p
          style={{ paddingLeft: `${nivel * 14 + 22}px` }}
          className="pr-2 text-xs text-danger"
        >
          {erro}
        </p>
      )}

      {criando && (
        <NovaEntradaInput
          tipo={criando}
          nivel={nivel + 1}
          onConfirmar={criarFilho}
          onCancelar={() => setCriando(null)}
        />
      )}

      {ehPasta &&
        aberto &&
        filhos?.map((filho) => (
          <Nodo
            key={filho.caminho}
            item={filho}
            caminhoPai={item.caminho}
            nivel={nivel + 1}
            onMudou={carregarFilhos}
            onAbrirArquivo={onAbrirArquivo}
            arquivoAtivo={arquivoAtivo}
            onAlteracaoArquivos={onAlteracaoArquivos}
          />
        ))}
    </div>
  );
}

export default function Sidebar({ projeto, onAbrirArquivo, arquivoAtivo, onAlteracaoArquivos }) {
  const { t } = useTranslation();
  const [raiz, setRaiz] = useState(null);
  const [erro, setErro] = useState(null);
  const [criando, setCriando] = useState(null);

  const carregarRaiz = useCallback(async () => {
    try {
      setRaiz(await listarEntradas(projeto.caminho));
      setErro(null);
    } catch (e) {
      setErro(String(e));
    }
  }, [projeto.caminho]);

  useEffect(() => {
    carregarRaiz();
  }, [carregarRaiz]);

  async function criarNaRaiz(nome) {
    try {
      if (criando === "pasta") await criarPasta(projeto.caminho, nome);
      else await criarArquivo(projeto.caminho, nome);
      setCriando(null);
      await carregarRaiz();
      onAlteracaoArquivos?.();
    } catch (e) {
      setErro(String(e));
      setCriando(null);
    }
  }

  return (
    <aside className="w-60 overflow-y-auto border-r border-line bg-paper-2 p-3">
      <div className="mb-2 flex items-center justify-between px-2">
        <p className="truncate text-xs uppercase tracking-wide text-ink-muted">
          {projeto.titulo}
        </p>
        <div className="flex gap-1 text-ink-muted">
          <button
            title={t("sidebar.novaPasta")}
            onClick={() => setCriando("pasta")}
            className="hover:text-gold"
          >
            <FolderPlus size={14} />
          </button>
          <button
            title={t("sidebar.novoArquivo")}
            onClick={() => setCriando("arquivo")}
            className="hover:text-gold"
          >
            <FilePlus size={14} />
          </button>
        </div>
      </div>

      {criando && (
        <NovaEntradaInput
          tipo={criando}
          nivel={0}
          onConfirmar={criarNaRaiz}
          onCancelar={() => setCriando(null)}
        />
      )}

      {erro && <p className="px-2 text-xs text-danger">{erro}</p>}

      {raiz === null ? (
        <p className="px-2 text-xs text-ink-muted">{t("sidebar.carregando")}</p>
      ) : (
        raiz.map((item) => (
          <Nodo
            key={item.caminho}
            item={item}
            caminhoPai={projeto.caminho}
            nivel={0}
            onMudou={carregarRaiz}
            onAbrirArquivo={onAbrirArquivo}
            arquivoAtivo={arquivoAtivo}
            onAlteracaoArquivos={onAlteracaoArquivos}
          />
        ))
      )}
    </aside>
  );
}
