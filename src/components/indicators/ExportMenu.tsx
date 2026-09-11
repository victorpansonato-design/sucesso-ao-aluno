import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { Button } from '../ui/Button';
import { popoverVariants } from '../../lib/motion';

/* ==========================================================================
   Exportar — um botão, um menu, o recorte declarado
   --------------------------------------------------------------------------
   A tela tinha exportações espalhadas: dois botões no cabeçalho, um "CSV" em
   três cartões diferentes e quatro tiles num bloco no pé. Nove gatilhos para
   uma ação, e nenhum deles dizia se exportava o que estava na tela ou a base
   inteira.

   Aqui é um menu, agrupado por contexto, e cada item carrega DUAS informações
   obrigatórias:

     · o volume que vai sair (`126 registros`);
     · o RECORTE — "recorte atual" ou "base completa".

   O segundo é o que faltava e o que causa retrabalho de verdade: alguém filtra
   por Híbrido, exporta "casos", manda para a reitoria e o arquivo tinha a base
   toda. Um exportador que não declara o seu escopo é uma armadilha, não uma
   funcionalidade.

   As funções de exportação em si não mudaram — `lib/exporters` continua gerando
   CSV com ponto-e-vírgula e BOM UTF-8, que é o que abre no Excel em português
   sem quebrar acentuação.
   ========================================================================== */

export interface ExportItem {
  key: string;
  label: string;
  /** Quantos registros saem, já formatado. */
  volume: string;
  /** O recorte real do arquivo. Nunca omitido. */
  scope: 'recorte' | 'completa';
  run: () => void;
}

export interface ExportGroup {
  label: string;
  items: ExportItem[];
}

export function ExportMenu({
  groups,
  onPrint,
}: {
  groups: ExportGroup[];
  onPrint: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative print:hidden">
      <Button
        variant="secondary"
        size="sm"
        icon={<Download className="h-3.5 w-3.5" />}
        iconRight={
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        }
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        Exportar
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            variants={popoverVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute right-0 z-50 mt-2 w-[336px] origin-top-right overflow-hidden rounded-xl bg-surface shadow-overlay"
          >
            <div className="scroll-slim max-h-[440px] overflow-y-auto">
              {groups.map((group) => (
                <div key={group.label}>
                  <p className="border-b border-hairline bg-surface-2 px-4 py-2 text-[11px] font-semibold text-ink-3">
                    {group.label}
                  </p>
                  <ul className="divide-y divide-hairline">
                    {group.items.map((item) => (
                      <li key={item.key}>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            item.run();
                            setOpen(false);
                          }}
                          className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                        >
                          <FileSpreadsheet
                            className="mt-0.5 h-4 w-4 shrink-0 text-ink-4"
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[12.5px] font-semibold text-ink">
                              {item.label}
                            </span>
                            <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[11px] text-ink-3">
                              <span className="font-mono tabular">{item.volume}</span>
                              <span className="text-ink-4">·</span>
                              <ScopeTag scope={item.scope} />
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="border-t border-hairline">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onPrint();
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-hover"
                >
                  <Printer className="mt-0.5 h-4 w-4 shrink-0 text-ink-4" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-ink">
                      Imprimir / salvar em PDF
                    </span>
                    <span className="mt-0.5 block text-[11px] text-ink-3">
                      Abre o diálogo do navegador com a aba visível
                    </span>
                  </span>
                </button>
              </div>
            </div>

            <p className="border-t border-hairline bg-surface-2 px-4 py-2.5 text-[10.5px] leading-relaxed text-ink-4">
              CSV com separador ponto-e-vírgula e BOM UTF-8 — abre direto no Excel em português sem
              quebrar acentuação.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * O rótulo de escopo. Duas palavras que evitam um arquivo errado numa
 * apresentação — e por isso ele nunca é opcional no tipo `ExportItem`.
 */
function ScopeTag({ scope }: { scope: ExportItem['scope'] }) {
  return scope === 'recorte' ? (
    <span className="font-medium text-ink-2">recorte atual</span>
  ) : (
    <span className="font-medium text-warn-ink">base completa</span>
  );
}
