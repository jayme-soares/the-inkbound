import { motion } from "framer-motion";

// Mesma geometria de LogoMarca, mas com o traço "desenhado" via animação de
// pathLength — usada só na tela de carregamento (chamar toda vez que a
// marca aparece na tela seria exagero).
export default function LogoMarcaAnimada({ size = 64, className = "" }) {
  const altura = Math.round(size * (66 / 58));
  return (
    <svg width={size} height={altura} viewBox="0 0 58 66" fill="none" className={className}>
      <motion.path
        d="M46 6C26 8 8 24 5 44C4 49 4 53 9 56"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0,-1) rotate(-1) scale(0.99,1.48)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />
      <motion.path
        d="M46 6C40 22 24 40 9 56"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(1,-1) rotate(2) scale(0.97,1.13)"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, delay: 0.15, ease: "easeInOut" }}
      />
      <motion.path
        d="M40 17L28 22M32 29L20 34M24 40L13 45M16 49L8 53"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeLinecap="round"
        transform="rotate(-2) scale(1.04,1.02)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1 }}
      />
    </svg>
  );
}
