import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import Dashboard from "./components/dashboard/Dashboard";
import Workspace from "./components/workspace/Workspace";
import TelaCarregamento from "./components/TelaCarregamento";
import { useAppStore } from "./store/useAppStore";
import { useConfiguracoesStore } from "./store/useConfiguracoesStore";
import { useAtualizacaoStore } from "./store/useAtualizacaoStore";

function App() {
  const [pronto, setPronto] = useState(false);
  const projetoAtivo = useAppStore((s) => s.projetoAtivo);
  const carregarProjetos = useAppStore((s) => s.carregarProjetos);

  useEffect(() => {
    // Carregamento local costuma ser quase instantâneo — sem um piso de
    // tempo, a tela de carregamento (com a animação da pena e as frases
    // rotativas) mal chega a aparecer. 2.8s dá espaço para a animação e
    // algumas frases, e ainda respeita um carregamento real mais lento
    // (o maior dos dois vence).
    const tempoMinimo = new Promise((resolve) => setTimeout(resolve, 2800));
    Promise.all([carregarProjetos(), tempoMinimo]).finally(() => setPronto(true));

    if (useConfiguracoesStore.getState().telaCheiaAoIniciar) {
      getCurrentWindow()
        .setFullscreen(true)
        .catch((e) => console.error("Falha ao iniciar em tela cheia:", e));
    }

    // Melhor esforço, em segundo plano — não deve atrasar o carregamento
    // nem incomodar o autor se falhar (ex: sem internet, ou repositório
    // ainda privado sem acesso anônimo à API do GitHub).
    useAtualizacaoStore.getState().verificar();
  }, [carregarProjetos]);

  if (!pronto) return <TelaCarregamento />;
  return projetoAtivo ? <Workspace /> : <Dashboard />;
}

export default App;
