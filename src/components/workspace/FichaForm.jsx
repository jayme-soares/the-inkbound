import { useState } from "react";
import { useTranslation } from "react-i18next";

export const CAMPOS_POR_TIPO = {
  personagem: [
    { chave: "nome", labelChave: "fichas.campos.nome" },
    { chave: "motivacoes", labelChave: "fichas.campos.motivacoes", area: true },
    { chave: "arcoNarrativo", labelChave: "fichas.campos.arcoNarrativo", area: true },
  ],
  localidade: [
    { chave: "nome", labelChave: "fichas.campos.nome" },
    { chave: "descricao", labelChave: "fichas.campos.descricao", area: true },
  ],
};

export default function FichaForm({ tipo, inicial, onSalvar, onCancelar }) {
  const { t } = useTranslation();
  const campos = CAMPOS_POR_TIPO[tipo];
  const [valores, setValores] = useState(() => {
    const base = {};
    for (const campo of campos) base[campo.chave] = inicial?.[campo.chave] ?? "";
    return base;
  });
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valores.nome?.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await onSalvar(valores);
    } catch (e) {
      setErro(String(e));
      setSalvando(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-4 rounded-xl border border-line bg-paper-2 p-4"
    >
      {campos.map((campo) => (
        <label key={campo.chave} className="mb-3 block text-xs text-ink-muted">
          {t(campo.labelChave)}
          {campo.area ? (
            <textarea
              rows={3}
              value={valores[campo.chave]}
              onChange={(e) => setValores((v) => ({ ...v, [campo.chave]: e.target.value }))}
              className="mt-1 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          ) : (
            <input
              autoFocus={campo.chave === "nome"}
              value={valores[campo.chave]}
              onChange={(e) => setValores((v) => ({ ...v, [campo.chave]: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          )}
        </label>
      ))}

      {erro && <p className="mb-3 text-xs text-danger">{erro}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={salvando}
          className="rounded-lg bg-gold px-4 py-1.5 text-sm font-medium text-gold-fg transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {salvando ? t("fichas.salvando") : t("fichas.salvar")}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-lg px-4 py-1.5 text-sm text-ink-muted hover:text-ink"
        >
          {t("fichas.cancelar")}
        </button>
      </div>
    </form>
  );
}
