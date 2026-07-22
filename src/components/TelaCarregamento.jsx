import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import LogoMarcaAnimada from "./LogoMarcaAnimada";

const INTERVALO_MS = 850;

export default function TelaCarregamento() {
  const { t } = useTranslation();
  const frases = t("carregamento.frases", { returnObjects: true });
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setIndice((i) => (i + 1) % frases.length);
    }, INTERVALO_MS);
    return () => clearInterval(id);
  }, [frases.length]);

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-paper">
      <LogoMarcaAnimada size={64} className="text-gold" />
      <motion.h1
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="font-display text-4xl font-semibold tracking-tight text-ink"
      >
        Inkbound
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8, duration: 0.6 }}
        className="text-[11px] uppercase tracking-[0.22em] text-ink-muted"
      >
        from writers to writers
      </motion.p>

      <div className="mt-4 h-4">
        <AnimatePresence mode="wait">
          <motion.p
            key={indice}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
            className="text-xs italic text-ink-muted"
          >
            {frases[indice]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
