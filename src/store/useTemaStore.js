import { create } from "zustand";

const CHAVE_ARMAZENAMENTO = "inkbound-tema";

function aplicarTema(tema) {
  document.documentElement.classList.toggle("dark", tema === "escuro");
  localStorage.setItem(CHAVE_ARMAZENAMENTO, tema);
}

const temaInicial = localStorage.getItem(CHAVE_ARMAZENAMENTO) || "escuro";
aplicarTema(temaInicial);

export const useTemaStore = create((set) => ({
  tema: temaInicial,
  alternarTema: () =>
    set((state) => {
      const novoTema = state.tema === "escuro" ? "claro" : "escuro";
      aplicarTema(novoTema);
      return { tema: novoTema };
    }),
}));
