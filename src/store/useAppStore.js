import { create } from "zustand";
import { listarProjetos, criarProjetoNoDisco, excluirProjetoNoDisco } from "../lib/projetos";
import { excluirProjetoDoDrive, sincronizarProjeto } from "../lib/driveSync";
import { statusLoginGoogle } from "../lib/googleAuth";

export const useAppStore = create((set, get) => ({
  projetoAtivo: null,
  projetos: [],
  termoBusca: "",
  carregando: false,
  erro: null,

  setTermoBusca: (termo) => set({ termoBusca: termo }),

  carregarProjetos: async () => {
    set({ carregando: true, erro: null });
    try {
      const projetos = await listarProjetos();
      set({ projetos, carregando: false });
    } catch (erro) {
      set({ erro: String(erro), carregando: false });
    }
  },

  criarProjeto: async ({ titulo, genero }) => {
    const novo = await criarProjetoNoDisco({ titulo, genero });
    set((state) => ({ projetos: [...state.projetos, novo] }));

    // Cria a pasta no Drive já na criação do projeto, em vez de esperar o
    // autor abrir o Workspace pela primeira vez (que é quando a sincronização
    // normalmente dispara).
    try {
      if (await statusLoginGoogle()) {
        await sincronizarProjeto(novo);
      }
    } catch (erro) {
      console.error("Falha ao sincronizar projeto novo com o Drive:", erro);
    }

    return novo;
  },

  excluirProjeto: async (id) => {
    const projeto = get().projetos.find((p) => p.id === id);
    if (!projeto) return;
    try {
      await excluirProjetoDoDrive(projeto.caminho);
    } catch (erro) {
      // Segue com a exclusão local mesmo se o Drive falhar (ex: sem conexão)
      // — mas isso deixa a pasta viva no Drive até uma tentativa futura.
      console.error("Falha ao excluir projeto do Drive:", erro);
    }
    await excluirProjetoNoDisco(projeto.caminho);
    set((state) => ({
      projetos: state.projetos.filter((p) => p.id !== id),
      projetoAtivo: state.projetoAtivo?.id === id ? null : state.projetoAtivo,
    }));
  },

  abrirProjeto: (id) =>
    set((state) => ({
      projetoAtivo: state.projetos.find((p) => p.id === id) ?? null,
    })),

  // Não fecha a conexão do banco do projeto aqui: ela fica cacheada (ver
  // src/lib/db.js) e é reaproveitada se o projeto for reaberto. Fechar só é
  // necessário — e só é seguro — imediatamente antes de excluir a pasta do
  // projeto do disco (feito em excluirProjetoNoDisco).
  fecharProjeto: () => set({ projetoAtivo: null }),

  atualizarContagemPalavras: (id, contagemPalavras) =>
    set((state) => ({
      projetos: state.projetos.map((p) =>
        p.id === id ? { ...p, contagemPalavras } : p,
      ),
      projetoAtivo:
        state.projetoAtivo?.id === id
          ? { ...state.projetoAtivo, contagemPalavras }
          : state.projetoAtivo,
    })),

  atualizarMetaDiariaPalavras: (id, metaDiariaPalavras) =>
    set((state) => ({
      projetos: state.projetos.map((p) =>
        p.id === id ? { ...p, metaDiariaPalavras } : p,
      ),
      projetoAtivo:
        state.projetoAtivo?.id === id
          ? { ...state.projetoAtivo, metaDiariaPalavras }
          : state.projetoAtivo,
    })),
}));
