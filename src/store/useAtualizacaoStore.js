import { create } from "zustand";
import { verificarAtualizacao } from "../lib/atualizacoes";

// estado: "ocioso" | "verificando" | "atualizado" | "disponivel" | "erro"
export const useAtualizacaoStore = create((set) => ({
  estado: "ocioso",
  versaoAtual: null,
  versaoMaisNova: null,
  urlRelease: null,

  verificar: async () => {
    set({ estado: "verificando" });
    try {
      const resultado = await verificarAtualizacao();
      set({
        estado: resultado.temNova ? "disponivel" : "atualizado",
        versaoAtual: resultado.versaoAtual,
        versaoMaisNova: resultado.versaoMaisNova,
        urlRelease: resultado.urlRelease,
      });
    } catch (e) {
      console.error("Falha ao verificar atualizações:", e);
      set({ estado: "erro" });
    }
  },
}));
