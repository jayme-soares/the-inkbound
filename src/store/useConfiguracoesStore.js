import { create } from "zustand";

const CHAVE_ARMAZENAMENTO = "inkbound-tela-cheia";
const CHAVE_FONTE_EDITOR = "inkbound-fonte-editor";
const CHAVE_TAMANHO_FONTE_EDITOR = "inkbound-tamanho-fonte-editor";

export const FONTES_EDITOR = {
  sans: '"Inter", ui-sans-serif, system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, "Cascadia Code", Consolas, monospace',
};

const TAMANHO_FONTE_MIN = 12;
const TAMANHO_FONTE_MAX = 24;
const TAMANHO_FONTE_PADRAO = 14;

const telaCheiaInicial = localStorage.getItem(CHAVE_ARMAZENAMENTO) === "true";

const fonteEditorInicial = localStorage.getItem(CHAVE_FONTE_EDITOR);
const tamanhoFonteEditorInicial = Number(localStorage.getItem(CHAVE_TAMANHO_FONTE_EDITOR));

export const useConfiguracoesStore = create((set) => ({
  telaCheiaAoIniciar: telaCheiaInicial,
  definirTelaCheiaAoIniciar: (valor) => {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, String(valor));
    set({ telaCheiaAoIniciar: valor });
  },

  fonteEditor: fonteEditorInicial in FONTES_EDITOR ? fonteEditorInicial : "sans",
  definirFonteEditor: (valor) => {
    localStorage.setItem(CHAVE_FONTE_EDITOR, valor);
    set({ fonteEditor: valor });
  },

  tamanhoFonteEditor:
    tamanhoFonteEditorInicial >= TAMANHO_FONTE_MIN && tamanhoFonteEditorInicial <= TAMANHO_FONTE_MAX
      ? tamanhoFonteEditorInicial
      : TAMANHO_FONTE_PADRAO,
  ajustarTamanhoFonteEditor: (delta) =>
    set((estado) => {
      const novoTamanho = Math.min(
        TAMANHO_FONTE_MAX,
        Math.max(TAMANHO_FONTE_MIN, estado.tamanhoFonteEditor + delta),
      );
      localStorage.setItem(CHAVE_TAMANHO_FONTE_EDITOR, String(novoTamanho));
      return { tamanhoFonteEditor: novoTamanho };
    }),
}));
