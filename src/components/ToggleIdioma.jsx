import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { useIdiomaStore } from "../store/useIdiomaStore";

export default function ToggleIdioma() {
  const { t } = useTranslation();
  const idioma = useIdiomaStore((s) => s.idioma);
  const alternarIdioma = useIdiomaStore((s) => s.alternarIdioma);

  return (
    <button
      onClick={alternarIdioma}
      title={t("idioma.trocarPara")}
      className="flex items-center gap-1 rounded-lg p-2 text-xs font-medium text-ink-muted transition-colors hover:bg-hover hover:text-ink"
    >
      <Languages size={16} />
      {idioma === "pt-BR" ? "PT" : "EN"}
    </button>
  );
}
