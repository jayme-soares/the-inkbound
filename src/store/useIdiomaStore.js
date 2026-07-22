import { create } from "zustand";
import i18n from "../i18n";

const CHAVE_ARMAZENAMENTO = "inkbound-idioma";

function aplicarIdioma(idioma) {
  i18n.changeLanguage(idioma);
  localStorage.setItem(CHAVE_ARMAZENAMENTO, idioma);
}

const idiomaInicial = localStorage.getItem(CHAVE_ARMAZENAMENTO) || "pt-BR";

export const useIdiomaStore = create((set) => ({
  idioma: idiomaInicial,
  alternarIdioma: () =>
    set((state) => {
      const novoIdioma = state.idioma === "pt-BR" ? "en" : "pt-BR";
      aplicarIdioma(novoIdioma);
      return { idioma: novoIdioma };
    }),
}));
