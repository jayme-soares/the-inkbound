// Traço da pena da logo do Inkbound, para uso inline (cabeçalhos etc.) —
// mesma geometria usada para gerar o ícone do app (ver Inkbound Logo/icon-source.svg).
export default function LogoMarca({ size = 24, className = "" }) {
  const altura = Math.round(size * (66 / 58));
  return (
    <svg width={size} height={altura} viewBox="0 0 58 66" fill="none" className={className}>
      <path
        d="M46 6C26 8 8 24 5 44C4 49 4 53 9 56"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(0,-1) rotate(-1) scale(0.99,1.48)"
      />
      <path
        d="M46 6C40 22 24 40 9 56"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(1,-1) rotate(2) scale(0.97,1.13)"
      />
      <path
        d="M40 17L28 22M32 29L20 34M24 40L13 45M16 49L8 53"
        stroke="currentColor"
        strokeWidth="0.75"
        strokeLinecap="round"
        transform="rotate(-2) scale(1.04,1.02)"
      />
    </svg>
  );
}
