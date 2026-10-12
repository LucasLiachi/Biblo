/**
 * Coruja do Biblo (estilo "02 · Sólido" de .docs/design-system/brand).
 * Cores vêm dos tokens --brand-*; os arquivos SVG estáticos ficam em public/brand.
 */
interface BrandMarkProps {
  variant?: "solid" | "tile";
  title?: string;
}

const BODY = "M13 9 L25.5 17.5 C29.5 16.2 34.5 16.2 38.5 17.5 L51 9 L51 37 C51 49 42.5 57.5 32 58 C21.5 57.5 13 49 13 37 Z";

export function BrandMark({ variant = "tile", title = "Biblo" }: BrandMarkProps) {
  const tile = variant === "tile";
  const body = tile ? "var(--brand-amber)" : "var(--brand-ink)";
  const eye = tile ? "var(--brand-ink)" : "var(--on-accent)";
  const pupil = tile ? "var(--brand-amber)" : "var(--brand-ink)";
  const beak = tile ? "var(--brand-ink)" : "var(--brand-amber)";
  const owl = (
    <>
      <path d={BODY} fill={body} />
      <circle cx="24.5" cy="31" r="7" fill={eye} />
      <circle cx="39.5" cy="31" r="7" fill={eye} />
      <circle cx="24.5" cy="31" r="3.2" fill={pupil} />
      <circle cx="39.5" cy="31" r="3.2" fill={pupil} />
      <path d="M29 40 L35 40 L32 45.5 Z" fill={beak} />
    </>
  );
  return (
    <svg viewBox="0 0 64 64" role="img" aria-label={title}>
      {tile ? (
        <>
          <rect width="64" height="64" rx="14" fill="var(--brand-ink)" />
          <g transform="translate(8.96 7.88) scale(0.72)">{owl}</g>
        </>
      ) : (
        owl
      )}
    </svg>
  );
}
