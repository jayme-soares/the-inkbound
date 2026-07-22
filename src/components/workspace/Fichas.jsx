import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Users, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  listarPersonagens,
  criarPersonagem,
  atualizarPersonagem,
  excluirPersonagem,
  listarLocalidades,
  criarLocalidade,
  atualizarLocalidade,
  excluirLocalidade,
} from "../../lib/fichas";
import FichaForm, { CAMPOS_POR_TIPO } from "./FichaForm";

const CONFIG = {
  personagem: {
    tituloChave: "fichas.personagens",
    Icone: Users,
    listar: listarPersonagens,
    criar: criarPersonagem,
    atualizar: atualizarPersonagem,
    excluir: excluirPersonagem,
  },
  localidade: {
    tituloChave: "fichas.localidades",
    Icone: MapPin,
    listar: listarLocalidades,
    criar: criarLocalidade,
    atualizar: atualizarLocalidade,
    excluir: excluirLocalidade,
  },
};

function PainelFicha({ tipo, caminhoProjeto }) {
  const { t } = useTranslation();
  const config = CONFIG[tipo];
  const titulo = t(config.tituloChave);
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState(null);
  const [formAberto, setFormAberto] = useState(false);
  const [editando, setEditando] = useState(null);

  const carregar = useCallback(async () => {
    try {
      setItens(await config.listar(caminhoProjeto));
      setErro(null);
    } catch (e) {
      setErro(String(e));
    }
  }, [caminhoProjeto, config]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar(valores) {
    if (editando) {
      await config.atualizar(caminhoProjeto, editando.id, valores);
    } else {
      await config.criar(caminhoProjeto, valores);
    }
    setFormAberto(false);
    setEditando(null);
    await carregar();
  }

  async function excluir(id) {
    try {
      await config.excluir(caminhoProjeto, id);
      await carregar();
    } catch (e) {
      setErro(String(e));
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
          <config.Icone size={16} className="text-gold" />
          {titulo}
        </h2>
        {!formAberto && (
          <button
            onClick={() => {
              setEditando(null);
              setFormAberto(true);
            }}
            className="flex items-center gap-1 rounded-lg bg-gold px-3 py-1.5 text-xs font-medium text-gold-fg hover:opacity-90"
          >
            <Plus size={14} />
            {t("fichas.novo")}
          </button>
        )}
      </div>

      {formAberto && (
        <FichaForm
          tipo={tipo}
          inicial={editando}
          onSalvar={salvar}
          onCancelar={() => {
            setFormAberto(false);
            setEditando(null);
          }}
        />
      )}

      {erro && <p className="mb-3 text-xs text-danger">{erro}</p>}

      {itens === null ? (
        <p className="text-sm text-ink-muted">{t("fichas.carregando")}</p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-ink-muted">{t("fichas.nenhumAinda", { tipo: titulo.toLowerCase() })}</p>
      ) : (
        <ul className="space-y-2">
          {itens.map((item) => (
            <li
              key={item.id}
              className="group rounded-xl border border-line bg-paper-2 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink">{item.nome}</span>
                <div className="hidden items-center gap-2 group-hover:flex">
                  <button
                    onClick={() => {
                      setEditando(item);
                      setFormAberto(true);
                    }}
                    className="text-ink-muted hover:text-gold"
                  >
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => excluir(item.id)} className="text-ink-muted hover:text-danger">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {CAMPOS_POR_TIPO[tipo]
                .filter((campo) => campo.chave !== "nome" && item[campo.chave])
                .map((campo) => (
                  <p key={campo.chave} className="mt-1 text-xs text-ink-muted">
                    <span className="text-ink-muted/80">{t(campo.labelChave)}: </span>
                    {item[campo.chave]}
                  </p>
                ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Fichas({ caminhoProjeto }) {
  const { t } = useTranslation();
  const [aba, setAba] = useState("personagem");

  return (
    <div className="flex-1 overflow-y-auto bg-paper p-8">
      <div className="mx-auto mb-6 flex max-w-2xl gap-2">
        {Object.entries(CONFIG).map(([chave, { tituloChave, Icone }]) => (
          <button
            key={chave}
            onClick={() => setAba(chave)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
              aba === chave
                ? "bg-hover text-ink"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            <Icone size={14} />
            {t(tituloChave)}
          </button>
        ))}
      </div>

      <PainelFicha tipo={aba} caminhoProjeto={caminhoProjeto} />
    </div>
  );
}
