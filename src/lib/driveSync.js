import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { mkdir, exists } from "@tauri-apps/plugin-fs";
import { caminharArvore } from "./arvoreArquivos";
import { abrirBancoProjeto } from "./db";
import { NOME_BANCO } from "./paths";
import { criarProjetoNoDisco } from "./projetos";

const NOME_RAIZ_DRIVE = "The Inkbound";

async function obterOuCriarPastaProjetoDrive(db, tituloProjeto) {
  const linhas = await db.select(
    "SELECT drive_pasta_id FROM sincronizacao_projeto WHERE id = 1",
  );
  if (linhas.length > 0 && linhas[0].drive_pasta_id) {
    return linhas[0].drive_pasta_id;
  }

  const raizId = await invoke("drive_obter_ou_criar_pasta", {
    nome: NOME_RAIZ_DRIVE,
    pastaPaiId: null,
  });
  const pastaId = await invoke("drive_obter_ou_criar_pasta", {
    nome: tituloProjeto,
    pastaPaiId: raizId,
  });

  await db.execute(
    `INSERT INTO sincronizacao_projeto (id, drive_pasta_id) VALUES (1, $1)
     ON CONFLICT(id) DO UPDATE SET drive_pasta_id = $1`,
    [pastaId],
  );

  return pastaId;
}

// Sincroniza uma entrada (pasta ou arquivo) contra o Drive.
// Pastas: cria/reaproveita e retorna o id do Drive (usado como pai dos filhos).
// Arquivos: compara hash local e modifiedTime remoto contra o que foi
// registrado no último sync — envia, baixa, ignora (nada mudou) ou sinaliza
// conflito (os dois lados mudaram desde o último sync, o que não pode ser
// resolvido automaticamente para um arquivo binário/texto sem merge real).
async function sincronizarEntrada(db, entrada, pastaPaiDriveId) {
  const linhas = await db.select(
    "SELECT * FROM sincronizacao_arquivo WHERE caminho_relativo = $1",
    [entrada.caminhoRelativo],
  );
  const mapeamento = linhas[0];
  const agora = new Date().toISOString();

  if (entrada.tipo === "pasta") {
    if (mapeamento) return mapeamento.drive_file_id;
    const driveId = await invoke("drive_obter_ou_criar_pasta", {
      nome: entrada.nome,
      pastaPaiId: pastaPaiDriveId,
    });
    await db.execute(
      `INSERT INTO sincronizacao_arquivo (caminho_relativo, tipo, drive_file_id, sincronizado_em)
       VALUES ($1, 'pasta', $2, $3)`,
      [entrada.caminhoRelativo, driveId, agora],
    );
    return driveId;
  }

  const hashAtual = await invoke("hash_arquivo_local", { caminhoLocal: entrada.caminho });

  if (!mapeamento) {
    const resultado = await invoke("drive_enviar_arquivo", {
      caminhoLocal: entrada.caminho,
      nomeRemoto: entrada.nome,
      pastaPaiId: pastaPaiDriveId,
      fileIdExistente: null,
    });
    await db.execute(
      `INSERT INTO sincronizacao_arquivo
         (caminho_relativo, tipo, drive_file_id, drive_modified_time, hash_local_ultimo_sync, sincronizado_em)
       VALUES ($1, 'arquivo', $2, $3, $4, $5)`,
      [entrada.caminhoRelativo, resultado.id, resultado.modifiedTime, hashAtual, agora],
    );
    return { status: "enviado" };
  }

  const modificadoRemoto = await invoke("drive_obter_metadados", {
    fileId: mapeamento.drive_file_id,
  });
  const remotoMudou = mapeamento.drive_modified_time !== modificadoRemoto;
  const localMudou = mapeamento.hash_local_ultimo_sync !== hashAtual;

  if (!remotoMudou && !localMudou) {
    return { status: "inalterado" };
  }

  if (remotoMudou && localMudou) {
    return { status: "conflito", caminhoRelativo: entrada.caminhoRelativo };
  }

  if (remotoMudou) {
    await invoke("drive_baixar_arquivo", {
      fileId: mapeamento.drive_file_id,
      caminhoLocal: entrada.caminho,
    });
    const novoHash = await invoke("hash_arquivo_local", { caminhoLocal: entrada.caminho });
    await db.execute(
      `UPDATE sincronizacao_arquivo
       SET drive_modified_time = $1, hash_local_ultimo_sync = $2, sincronizado_em = $3
       WHERE caminho_relativo = $4`,
      [modificadoRemoto, novoHash, agora, entrada.caminhoRelativo],
    );
    return { status: "baixado" };
  }

  const resultado = await invoke("drive_enviar_arquivo", {
    caminhoLocal: entrada.caminho,
    nomeRemoto: entrada.nome,
    pastaPaiId: pastaPaiDriveId,
    fileIdExistente: mapeamento.drive_file_id,
  });
  await db.execute(
    `UPDATE sincronizacao_arquivo
     SET drive_modified_time = $1, hash_local_ultimo_sync = $2, sincronizado_em = $3
     WHERE caminho_relativo = $4`,
    [resultado.modifiedTime, hashAtual, agora, entrada.caminhoRelativo],
  );
  return { status: "enviado" };
}

function caminhoRelativoPai(caminhoRelativo) {
  const indice = caminhoRelativo.lastIndexOf("/");
  return indice === -1 ? "" : caminhoRelativo.slice(0, indice);
}

// Espelha exclusões locais no Drive: qualquer mapeamento registrado que não
// corresponda mais a um arquivo/pasta local foi removido desde o último sync.
// Excluir uma pasta no Drive já em cascata remove seus filhos, então pulamos
// a chamada para qualquer órfão cujo ancestral já tenha sido excluído nesta
// mesma passada (evita chamadas redundantes / 404s desnecessários).
async function excluirOrfaosDrive(db, caminhosRelativosLocais) {
  const todos = await db.select("SELECT * FROM sincronizacao_arquivo");
  const orfaos = todos
    .filter((linha) => !caminhosRelativosLocais.has(linha.caminho_relativo))
    .sort((a, b) => a.caminho_relativo.split("/").length - b.caminho_relativo.split("/").length);

  const prefixosJaExcluidos = [];
  let total = 0;

  for (const linha of orfaos) {
    const cobertoPorAncestral = prefixosJaExcluidos.some((prefixo) =>
      linha.caminho_relativo.startsWith(`${prefixo}/`),
    );
    if (!cobertoPorAncestral) {
      await invoke("drive_excluir_arquivo", { fileId: linha.drive_file_id });
    }
    prefixosJaExcluidos.push(linha.caminho_relativo);
    await db.execute("DELETE FROM sincronizacao_arquivo WHERE caminho_relativo = $1", [
      linha.caminho_relativo,
    ]);
    total += 1;
  }

  return total;
}

// Sincroniza os documentos de texto (.md) do projeto com o Drive. O
// inkbound.db (fichas de personagens/localidades) fica fora desta primeira
// versão — é um arquivo binário que pode estar com conexão aberta durante a
// edição, e sincronizá-lo com segurança merece uma passada própria.
export async function sincronizarProjeto(projeto) {
  const caminhoBanco = await join(projeto.caminho, NOME_BANCO);
  const db = await abrirBancoProjeto(caminhoBanco);
  const resumo = { enviados: 0, baixados: 0, excluidos: 0, inalterados: 0, conflitos: [] };

  const pastaProjetoDriveId = await obterOuCriarPastaProjetoDrive(db, projeto.titulo);
  const entradas = await caminharArvore(projeto.caminho);
  const idsPorCaminhoRelativo = new Map([["", pastaProjetoDriveId]]);

  for (const entrada of entradas) {
    const pastaPaiDriveId = idsPorCaminhoRelativo.get(caminhoRelativoPai(entrada.caminhoRelativo));
    const resultado = await sincronizarEntrada(db, entrada, pastaPaiDriveId);

    if (entrada.tipo === "pasta") {
      idsPorCaminhoRelativo.set(entrada.caminhoRelativo, resultado);
      continue;
    }

    if (resultado.status === "conflito") resumo.conflitos.push(resultado.caminhoRelativo);
    else if (resultado.status === "enviado") resumo.enviados += 1;
    else if (resultado.status === "baixado") resumo.baixados += 1;
    else resumo.inalterados += 1;
  }

  const caminhosRelativosLocais = new Set(entradas.map((e) => e.caminhoRelativo));
  resumo.excluidos = await excluirOrfaosDrive(db, caminhosRelativosLocais);

  const agora = new Date().toISOString();
  await db.execute("UPDATE sincronizacao_projeto SET ultima_sincronizacao = $1 WHERE id = 1", [
    agora,
  ]);
  resumo.ultimaSincronizacao = agora;

  return resumo;
}

// Exclui a pasta do projeto no Drive (se ele já foi sincronizado alguma
// vez). Sem isso, excluir um projeto só localmente deixava a pasta viva no
// Drive — e pior, a próxima verificação de "projetos novos" (descobrirProjetosDrive)
// via a encontrava lá e a baixava de volta, "reanimando" o projeto excluído.
// Falha aqui (ex: sem conexão com o Drive) não deve impedir a exclusão local.
export async function excluirProjetoDoDrive(caminhoProjeto) {
  const caminhoBanco = await join(caminhoProjeto, NOME_BANCO);
  if (!(await exists(caminhoBanco))) return;

  const db = await abrirBancoProjeto(caminhoBanco);
  const linhas = await db.select(
    "SELECT drive_pasta_id FROM sincronizacao_projeto WHERE id = 1",
  );
  const drivePastaId = linhas[0]?.drive_pasta_id;
  if (drivePastaId) {
    await invoke("drive_excluir_arquivo", { fileId: drivePastaId });
  }
}

export async function obterUltimaSincronizacao(caminhoProjeto) {
  const caminhoBanco = await join(caminhoProjeto, NOME_BANCO);
  const db = await abrirBancoProjeto(caminhoBanco);
  const linhas = await db.select(
    "SELECT ultima_sincronizacao FROM sincronizacao_projeto WHERE id = 1",
  );
  return linhas[0]?.ultima_sincronizacao ?? null;
}

// Baixa recursivamente o conteúdo de uma pasta do Drive para dentro de uma
// pasta local, registrando cada arquivo/pasta em sincronizacao_arquivo à
// medida que desce — assim a próxima sincronização normal já reconhece tudo
// como "já mapeado" em vez de tentar reenviar o que acabou de baixar.
async function baixarArvoreDrive(db, pastaDriveId, caminhoLocalPai, caminhoRelativoPai) {
  const filhos = await invoke("drive_listar_filhos", { pastaId: pastaDriveId });

  for (const filho of filhos) {
    const caminhoRelativo = caminhoRelativoPai ? `${caminhoRelativoPai}/${filho.nome}` : filho.nome;
    const caminhoLocal = await join(caminhoLocalPai, filho.nome);
    const agora = new Date().toISOString();

    if (filho.tipo === "pasta") {
      await mkdir(caminhoLocal, { recursive: true });
      await db.execute(
        `INSERT INTO sincronizacao_arquivo (caminho_relativo, tipo, drive_file_id, sincronizado_em)
         VALUES ($1, 'pasta', $2, $3)`,
        [caminhoRelativo, filho.id, agora],
      );
      await baixarArvoreDrive(db, filho.id, caminhoLocal, caminhoRelativo);
    } else {
      await invoke("drive_baixar_arquivo", { fileId: filho.id, caminhoLocal });
      const hash = await invoke("hash_arquivo_local", { caminhoLocal });
      await db.execute(
        `INSERT INTO sincronizacao_arquivo
           (caminho_relativo, tipo, drive_file_id, drive_modified_time, hash_local_ultimo_sync, sincronizado_em)
         VALUES ($1, 'arquivo', $2, $3, $4, $5)`,
        [caminhoRelativo, filho.id, filho.modifiedTime, hash, agora],
      );
    }
  }
}

// Descobre projetos que já existem na pasta "The Inkbound" do Drive mas
// ainda não têm pasta local (ex: primeiro uso num dispositivo novo, ou o
// dispositivo original nunca chegou a sincronizar de volta). Cria a pasta
// local + inkbound.db para cada um e baixa todo o conteúdo. Retorna os
// projetos recém-criados para o Dashboard atualizar a lista sem esperar
// um reload completo.
export async function descobrirProjetosDrive(titulosLocaisExistentes) {
  const raizId = await invoke("drive_obter_ou_criar_pasta", {
    nome: NOME_RAIZ_DRIVE,
    pastaPaiId: null,
  });
  const filhosRaiz = await invoke("drive_listar_filhos", { pastaId: raizId });
  const pastasDeProjeto = filhosRaiz.filter((item) => item.tipo === "pasta");

  const novosProjetos = [];

  for (const pastaProjeto of pastasDeProjeto) {
    if (titulosLocaisExistentes.has(pastaProjeto.nome)) continue;

    const novoProjeto = await criarProjetoNoDisco({ titulo: pastaProjeto.nome, genero: null });
    const caminhoBanco = await join(novoProjeto.caminho, NOME_BANCO);
    const db = await abrirBancoProjeto(caminhoBanco);
    const agora = new Date().toISOString();

    await db.execute(
      `INSERT INTO sincronizacao_projeto (id, drive_pasta_id, ultima_sincronizacao) VALUES (1, $1, $2)
       ON CONFLICT(id) DO UPDATE SET drive_pasta_id = $1, ultima_sincronizacao = $2`,
      [pastaProjeto.id, agora],
    );
    await baixarArvoreDrive(db, pastaProjeto.id, novoProjeto.caminho, "");

    novosProjetos.push(novoProjeto);
  }

  return novosProjetos;
}
