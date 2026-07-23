import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { caminharArvore } from "../lib/arvoreArquivos";
import { montarPayloadExportacao } from "../lib/exportarManuscrito";
import { atualizarAutorContato } from "../lib/projetos";

// Não persiste a ordem/seleção entre sessões (recalcula do zero toda vez que
// a aba abre) — não existe hoje nenhuma infraestrutura de reconciliação de
// identidade de arquivo (renomear/mover/excluir) que tornaria um estado
// persistido confiável, e a tela só é usada ocasionalmente (na hora de
// submeter), não durante a escrita do dia a dia. Ver docs/ para o registro
// dessa decisão.
export function useExportarManuscrito(projeto) {
  const [arquivos, setArquivos] = useState(null);
  const [erroLista, setErroLista] = useState(null);
  const [autor, setAutor] = useState(projeto.autor ?? "");
  const [contato, setContato] = useState(projeto.contato ?? "");
  const [exportando, setExportando] = useState(false);
  const [erroExportacao, setErroExportacao] = useState(null);
  const [sucesso, setSucesso] = useState(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const entradas = await caminharArvore(projeto.caminho);
        const arquivosMd = entradas.filter(
          (e) => e.tipo === "arquivo" && e.nome.toLowerCase().endsWith(".md"),
        );
        if (!ativo) return;
        setArquivos(
          arquivosMd.map((a) => ({
            ...a,
            incluido: !a.caminhoRelativo.startsWith("Pesquisa/"),
          })),
        );
      } catch (e) {
        if (ativo) setErroLista(e.message || String(e));
      }
    }
    carregar();
    return () => {
      ativo = false;
    };
  }, [projeto.caminho]);

  const alternarInclusao = useCallback((caminhoRelativo) => {
    setArquivos((lista) =>
      lista.map((a) =>
        a.caminhoRelativo === caminhoRelativo ? { ...a, incluido: !a.incluido } : a,
      ),
    );
  }, []);

  const mover = useCallback((indice, direcao) => {
    setArquivos((lista) => {
      const destino = indice + direcao;
      if (destino < 0 || destino >= lista.length) return lista;
      const nova = [...lista];
      [nova[indice], nova[destino]] = [nova[destino], nova[indice]];
      return nova;
    });
  }, []);

  const salvarAutorContato = useCallback(async () => {
    try {
      await atualizarAutorContato(projeto.caminho, { autor, contato });
    } catch (e) {
      console.error("Falha ao salvar autor/contato do projeto:", e);
    }
  }, [projeto.caminho, autor, contato]);

  const exportar = useCallback(
    async (formato) => {
      const incluidos = (arquivos ?? []).filter((a) => a.incluido);
      if (incluidos.length === 0) return;

      setExportando(true);
      setErroExportacao(null);
      setSucesso(null);
      try {
        const extensao = formato === "docx" ? "docx" : "pdf";
        const filtros =
          formato === "docx"
            ? [{ name: "Word", extensions: ["docx"] }]
            : [{ name: "PDF", extensions: ["pdf"] }];

        const destino = await save({
          defaultPath: `${projeto.titulo}.${extensao}`,
          filters: filtros,
        });
        if (!destino) return;

        const payload = await montarPayloadExportacao({
          arquivos: incluidos,
          titulo: projeto.titulo,
          autor,
          contato,
        });

        const comando = formato === "docx" ? "exportar_manuscrito_docx" : "exportar_manuscrito_pdf";
        await invoke(comando, { destino, manuscrito: payload });
        setSucesso(destino);
      } catch (e) {
        setErroExportacao(e.message || String(e));
      } finally {
        setExportando(false);
      }
    },
    [arquivos, projeto.titulo, autor, contato],
  );

  return {
    arquivos,
    erroLista,
    autor,
    setAutor,
    contato,
    setContato,
    salvarAutorContato,
    alternarInclusao,
    mover,
    exportando,
    erroExportacao,
    sucesso,
    exportar,
  };
}
