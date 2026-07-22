import { useCallback, useEffect, useRef, useState } from "react";
import { statusLoginGoogle } from "../lib/googleAuth";
import { sincronizarProjeto, obterUltimaSincronizacao } from "../lib/driveSync";

const ATRASO_DEBOUNCE_MS = 1500;

// Centraliza o estado de sincronização do projeto aberto, para que tanto o
// indicador do cabeçalho quanto a sidebar (ao criar/excluir arquivos) possam
// disparar uma sincronização sem duplicar lógica nem rodar duas em paralelo
// (o que já causou uma corrida real no SQLite — ver docs/fase-3-motor-local.md).
export function useSincronizacaoDrive({ caminho, titulo }) {
  const [conectado, setConectado] = useState(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [resumo, setResumo] = useState(null);
  const [erro, setErro] = useState(null);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState(null);

  const timerRef = useRef(null);
  const emAndamentoRef = useRef(false);
  const pendenteRef = useRef(false);

  const sincronizar = useCallback(async () => {
    if (emAndamentoRef.current) {
      pendenteRef.current = true;
      return;
    }
    emAndamentoRef.current = true;
    setSincronizando(true);
    setErro(null);
    try {
      const resultado = await sincronizarProjeto({ caminho, titulo });
      setResumo(resultado);
      if (resultado.ultimaSincronizacao) setUltimaSincronizacao(resultado.ultimaSincronizacao);
    } catch (e) {
      setErro(e.message || String(e));
    } finally {
      setSincronizando(false);
      emAndamentoRef.current = false;
      if (pendenteRef.current) {
        pendenteRef.current = false;
        sincronizar();
      }
    }
  }, [caminho, titulo]);

  // Debounce: chamado a cada criação/exclusão na sidebar. Várias ações
  // seguidas (ex: criar 3 arquivos rápido) coalescem numa única passada.
  const agendarSincronizacao = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(sincronizar, ATRASO_DEBOUNCE_MS);
  }, [sincronizar]);

  useEffect(() => {
    let ativo = true;
    obterUltimaSincronizacao(caminho).then((valor) => {
      if (ativo) setUltimaSincronizacao(valor);
    });
    statusLoginGoogle().then((ok) => {
      if (!ativo) return;
      setConectado(ok);
      // Verifica/baixa alterações do Drive antes que o autor comece a
      // editar — implementa a estratégia de conflito combinada ("checar
      // antes de abrir" em vez de merge multi-dispositivo).
      if (ok) sincronizar();
    });
    return () => {
      ativo = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [caminho, sincronizar]);

  return {
    conectado,
    sincronizando,
    resumo,
    erro,
    ultimaSincronizacao,
    sincronizar,
    agendarSincronizacao,
  };
}
