/* ==========================================================================
   Grupo Anchieta wordmark
   --------------------------------------------------------------------------
   Vector reconstruction of the institutional mark: the "GRUPO" tab sitting on
   the heavy italic "ANCHIETA" plaque. Drawn with SVG text and an outlined
   paint order so the white keyline around each glyph survives at every size,
   plus a skew transform so the slant is identical regardless of which font in
   the stack the OS resolves.
   ========================================================================== */

const WORDMARK_STACK =
  "'Archivo Black','Arial Black','Helvetica Neue Black','Inter',system-ui,sans-serif";

export function AnchietaLogo({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 74"
      className={className}
      role="img"
      aria-label="Grupo Anchieta"
      fill="none"
    >
      {/* GRUPO — small tab, reversed out of the brand blue */}
      <g transform="skewX(-9)">
        <rect x="30" y="2" width="70" height="20" rx="5" fill="var(--brand-mark, #1567b8)" />
        <text
          x="65"
          y="16.6"
          textAnchor="middle"
          fill="#ffffff"
          style={{
            fontFamily: WORDMARK_STACK,
            fontSize: '13.5px',
            fontWeight: 900,
            letterSpacing: '1.6px',
          }}
        >
          GRUPO
        </text>
      </g>

      {/* ANCHIETA — the plaque */}
      <g transform="skewX(-9)">
        <rect
          x="14"
          y="24"
          width="182"
          height="44"
          rx="11"
          fill="var(--brand-mark, #1567b8)"
        />
        <text
          x="105"
          y="57.5"
          textAnchor="middle"
          fill="#ffffff"
          stroke="var(--brand-mark, #1567b8)"
          strokeWidth="0.5"
          paintOrder="stroke fill"
          style={{
            fontFamily: WORDMARK_STACK,
            fontSize: '31px',
            fontWeight: 900,
            letterSpacing: '0.4px',
          }}
        >
          ANCHIETA
        </text>
      </g>
    </svg>
  );
}

/**
 * Full lockup used in the sidebar: the wordmark plus the unit that actually
 * owns this system. Keeping the unit name attached is what makes an internal
 * tool feel institutional rather than generic.
 */
export function BrandLockup({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--brand-mark,#1567b8)]"
        title="Grupo Anchieta · Centro de Sucesso ao Aluno"
      >
        <span
          className="text-[15px] font-black text-white italic"
          style={{ fontFamily: WORDMARK_STACK }}
        >
          A
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AnchietaLogo className="h-[38px] w-auto" />
      <div className="flex items-center gap-2 pl-0.5">
        <span className="h-3 w-[2px] rounded-full bg-brand-2" />
        <span className="text-[10.5px] leading-none font-semibold tracking-[0.1em] text-ink-3 uppercase">
          Centro de Sucesso ao Aluno
        </span>
      </div>
    </div>
  );
}
