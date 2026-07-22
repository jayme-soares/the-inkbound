import { Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTemaStore } from "../store/useTemaStore";

export default function ToggleTema() {
  const { t } = useTranslation();
  const tema = useTemaStore((s) => s.tema);
  const alternarTema = useTemaStore((s) => s.alternarTema);

  return (
    <button
      onClick={alternarTema}
      title={tema === "escuro" ? t("tema.paraClaro") : t("tema.paraEscuro")}
      className="flex items-center justify-center rounded-lg p-2 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
    >
      {tema === "escuro" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
