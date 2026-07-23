import { create } from "zustand";

const CHAVE_ARMAZENAMENTO = "inkbound-tela-cheia";

const telaCheiaInicial = localStorage.getItem(CHAVE_ARMAZENAMENTO) === "true";

export const useConfiguracoesStore = create((set) => ({
  telaCheiaAoIniciar: telaCheiaInicial,
  definirTelaCheiaAoIniciar: (valor) => {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, String(valor));
    set({ telaCheiaAoIniciar: valor });
  },
}));
