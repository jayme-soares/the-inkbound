import { useState } from "react";
import { Settings, X } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useConfiguracoesStore } from "../store/useConfiguracoesStore";
import { useContaGoogleStore } from "../store/useContaGoogleStore";
import { useAtualizacaoStore } from "../store/useAtualizacaoStore";

function PainelConfiguracoes({ onClose }) {
  const { t } = useTranslation();
  const telaCheiaAoIniciar = useConfiguracoesStore((s) => s.telaCheiaAoIniciar);
  const definirTelaCheiaAoIniciar = useConfiguracoesStore((s) => s.definirTelaCheiaAoIniciar);

  const conectado = useContaGoogleStore((s) => s.conectado);
  const desconectar = useContaGoogleStore((s) => s.desconectar);

  const estadoAtualizacao = useAtualizacaoStore((s) => s.estado);
  const versaoAtual = useAtualizacaoStore((s) => s.versaoAtual);
  const versaoMaisNova = useAtualizacaoStore((s) => s.versaoMaisNova);
  const urlRelease = useAtualizacaoStore((s) => s.urlRelease);
  const verificar = useAtualizacaoStore((s) => s.verificar);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-xl border border-line bg-paper-2 p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-medium text-ink">{t("configuracoes.titulo")}</h2>
          <button type="button" onClick={onClose} className="text-ink-muted hover:text-ink">
            <X size={16} />
          </button>
        </div>

        <label className="mb-4 flex items-center justify-between text-sm text-ink">
          {t("configuracoes.telaCheia")}
          <input
            type="checkbox"
            checked={telaCheiaAoIniciar}
            onChange={(e) => definirTelaCheiaAoIniciar(e.target.checked)}
          />
        </label>

        <div className="mb-4 border-t border-line pt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-ink-muted">{t("configuracoes.conta")}</p>
          {conectado ? (
            <div className="flex items-center justify-between text-sm">
              <span className="text-ink-muted">{t("contaGoogle.conectadoAoDrive")}</span>
              <button onClick={desconectar} className="text-danger hover:opacity-80">
                {t("configuracoes.desconectar")}
              </button>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">{t("configuracoes.desconectado")}</p>
          )}
        </div>

        <div className="border-t border-line pt-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-ink-muted">{t("configuracoes.atualizacoes")}</p>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="text-ink-muted">
              {estadoAtualizacao === "verificando" && t("configuracoes.verificando")}
              {estadoAtualizacao === "atualizado" && t("configuracoes.atualizado", { versao: versaoAtual })}
              {estadoAtualizacao === "disponivel" &&
                t("configuracoes.novaVersao", { versao: versaoMaisNova })}
              {estadoAtualizacao === "erro" && t("configuracoes.erroVerificar")}
              {estadoAtualizacao === "ocioso" && versaoAtual && t("configuracoes.versaoAtual", { versao: versaoAtual })}
            </span>
            <button onClick={verificar} className="shrink-0 text-xs text-ink-muted hover:text-ink">
              {t("configuracoes.verificar")}
            </button>
          </div>
          {estadoAtualizacao === "disponivel" && urlRelease && (
            <button
              onClick={() => openUrl(urlRelease)}
              className="mt-2 w-full rounded-lg bg-gold py-1.5 text-xs font-medium text-gold-fg transition-opacity hover:opacity-90"
            >
              {t("configuracoes.baixar")}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default function Configuracoes() {
  const { t } = useTranslation();
  const [aberto, setAberto] = useState(false);
  const estadoAtualizacao = useAtualizacaoStore((s) => s.estado);

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        title={t("configuracoes.titulo")}
        className="relative flex items-center justify-center rounded-lg p-2 text-ink-muted transition-colors hover:bg-hover hover:text-ink"
      >
        <Settings size={16} />
        {estadoAtualizacao === "disponivel" && (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-gold" />
        )}
      </button>
      {aberto && <PainelConfiguracoes onClose={() => setAberto(false)} />}
    </>
  );
}
