import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./locales/pt-BR.json";
import en from "./locales/en.json";

const CHAVE_ARMAZENAMENTO = "inkbound-idioma";
const idiomaInicial = localStorage.getItem(CHAVE_ARMAZENAMENTO) || "pt-BR";

i18n.use(initReactI18next).init({
  resources: {
    "pt-BR": { translation: ptBR },
    en: { translation: en },
  },
  lng: idiomaInicial,
  fallbackLng: "pt-BR",
  interpolation: { escapeValue: false },
});

export default i18n;
