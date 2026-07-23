import { create } from "zustand";
import { statusLoginGoogle, logoutGoogle, iniciarLoginGoogle } from "../lib/googleAuth";

// Levantado de ContaGoogle.jsx para uma store compartilhada: o botão do
// cabeçalho do Dashboard (conectar/status) e a tela de Configurações
// (desconectar) precisam refletir o mesmo estado em tempo real — desconectar
// em Configurações deve atualizar o botão do cabeçalho na hora, sem precisar
// recarregar o app.
export const useContaGoogleStore = create((set) => ({
  conectado: null,
  carregando: false,
  erro: null,

  verificarStatus: async () => {
    try {
      const status = await statusLoginGoogle();
      set({ conectado: status });
    } catch {
      set({ conectado: false });
    }
  },

  conectar: async () => {
    set({ carregando: true, erro: null });
    try {
      await iniciarLoginGoogle();
      set({ conectado: true });
    } catch (e) {
      set({ erro: e.message || String(e) });
    } finally {
      set({ carregando: false });
    }
  },

  desconectar: async () => {
    try {
      await logoutGoogle();
      set({ conectado: false });
    } catch (e) {
      set({ erro: e.message || String(e) });
    }
  },
}));
