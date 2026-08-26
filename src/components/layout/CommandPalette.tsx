import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  CornerDownLeft,
  FileText,
  GraduationCap,
  Radar as RadarIcon,
  Search,
} from 'lucide-react';
import type { RouteName } from '../../lib/router';
import { useApp } from '../../state/AppContext';
import { Avatar, HealthBadge, PriorityBadge, RadarBadge } from '../ui/Badges';
import { modalVariants, scrimVariants } from '../../lib/motion';
import { digits, searchKey } from '../../lib/format';
import { RADARS, RADAR_ORDER } from '../../lib/radars';

/* ==========================================================================
   Command palette (⌘K)
   --------------------------------------------------------------------------
   Search by name, RA, CPF, course, campus, protocol or radar. Keyboard-first:
   arrows move, Enter opens, Escape closes — because the fastest path from
   "aluno me ligou agora" to their dossier is typing the RA, and a search box
   that requires the mouse to pick a result breaks that.
   ========================================================================== */

type Result =
  | { type: 'student'; id: string; label: string; sub: string }
  | { type: 'case'; id: string; label: string; sub: string }
  | { type: 'route'; id: RouteName; param?: string; label: string; sub: string };

/** As doze telas, buscáveis por nome. O `sub` também entra na busca. */
const SCREENS: { id: RouteName; label: string; sub: string }[] = [
  { id: 'cockpit', label: 'Cockpit', sub: 'O seu turno e quem precisa de você agora' },
  { id: 'dashboard', label: 'Dashboard', sub: 'Índices, evolução e resultado da operação' },
  { id: 'fila', label: 'Fila de Atendimento', sub: 'Casos abertos ordenados por SLA' },
  { id: 'alunos', label: 'Base de Alunos', sub: 'Diretório completo com filtros e exportação' },
  { id: 'radares', label: 'Radares', sub: 'Os cinco sensores, gatilhos e diretrizes' },
  { id: 'onboarding', label: 'Onboarding 90 dias', sub: 'Régua de acolhimento dos calouros' },
  { id: 'push', label: 'Gestão de PUSH', sub: 'Calendário acadêmico, réguas de aviso e histórico por aluno' },
  { id: 'jornada', label: 'Jornada por Modalidade', sub: 'Funis de presencial e híbrido' },
  { id: 'indicadores', label: 'Indicadores', sub: 'Tabelas executivas e exportações em CSV' },
  { id: 'equipe', label: 'Equipe', sub: 'Carga real e roteamento por especialidade' },
  { id: 'playbook', label: 'Playbook', sub: 'Protocolos de atendimento por radar' },
  { id: 'governanca', label: 'Governança', sub: 'Pesos, SLAs, janela de onboarding e LGPD' },
];

export function CommandPalette({
  open,
  onClose,
  onOpenStudent,
  onOpenCase,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onOpenStudent: (id: string) => void;
  onOpenCase: (id: string) => void;
  onNavigate: (route: RouteName, param?: string) => void;
}) {
  const { students, cases, getStudent } = useApp();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = searchKey(query.trim());
    const qDigits = digits(query);

    if (!q) {
      // Empty state offers the most-used destinations rather than nothing.
      return [
        { type: 'route', id: 'fila', label: 'Fila de Atendimento', sub: 'Casos abertos ordenados por SLA' },
        { type: 'route', id: 'cockpit', label: 'Cockpit', sub: 'O seu turno e quem precisa de você agora' },
        { type: 'route', id: 'dashboard', label: 'Dashboard', sub: 'Índices, evolução e resultado da operação' },
        { type: 'route', id: 'onboarding', label: 'Onboarding 90 dias', sub: 'Régua de acolhimento dos calouros' },
      ];
    }

    const out: Result[] = [];

    /* Telas por nome. A paleta buscava aluno, caso e radar mas não tela, então
       digitar "dashboard" ou "governança" não encontrava nada — e uma paleta de
       comandos que não acha um destino pelo nome é meio caminho de uma paleta. */
    for (const screen of SCREENS) {
      if (searchKey(screen.label).includes(q) || searchKey(screen.sub).includes(q)) {
        out.push({ type: 'route', id: screen.id, label: screen.label, sub: screen.sub });
      }
    }

    for (const s of students) {
      const hit =
        searchKey(s.name).includes(q) ||
        (qDigits.length >= 3 && s.ra.includes(qDigits)) ||
        (qDigits.length >= 3 && digits(s.cpfMasked).includes(qDigits)) ||
        searchKey(s.course).includes(q) ||
        searchKey(s.campus).includes(q);
      if (hit) {
        out.push({
          type: 'student',
          id: s.id,
          label: s.name,
          sub: `RA ${s.ra} · ${s.course} · ${s.period}º período · ${s.modality}`,
        });
      }
      if (out.length >= 8) break;
    }

    for (const c of cases) {
      const student = getStudent(c.studentId);
      const hit =
        searchKey(c.protocol).includes(q) ||
        searchKey(c.title).includes(q) ||
        (student ? searchKey(student.name).includes(q) : false) ||
        (qDigits.length >= 3 && student?.ra.includes(qDigits));
      if (hit) {
        out.push({
          type: 'case',
          id: c.id,
          label: c.title,
          sub: `${c.protocol} · ${student?.name ?? 'aluno'} · ${c.status}`,
        });
      }
      if (out.length >= 14) break;
    }

    for (const key of RADAR_ORDER) {
      if (searchKey(RADARS[key].label).includes(q) || searchKey(key).includes(q)) {
        out.push({
          type: 'route',
          id: 'radares',
          param: key,
          label: RADARS[key].label,
          sub: `Abrir radar · SLA ${RADARS[key].defaultSlaHours}h`,
        });
      }
    }

    return out.slice(0, 16);
  }, [query, students, cases, getStudent]);

  useEffect(() => setCursor(0), [query]);

  const run = (result: Result) => {
    onClose();
    if (result.type === 'student') onOpenStudent(result.id);
    else if (result.type === 'case') onOpenCase(result.id);
    else onNavigate(result.id, result.param);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[cursor];
      if (hit) run(hit);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="scrim fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]"
          variants={scrimVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Busca global"
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onKeyDown={onKeyDown}
            className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-surface shadow-overlay"
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-hairline bg-surface-2 px-4 py-3.5">
              <Search className="h-4 w-4 shrink-0 text-brand-2" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nome, RA (ex.: 2607454), CPF, curso, campus, protocolo ou radar…"
                className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-4 focus:outline-none"
              />
              <kbd className="shrink-0 rounded bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-4">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="scroll-slim max-h-[52vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-[12.5px] text-ink-4">
                  Nenhum resultado para “{query}”.
                </p>
              ) : (
                results.map((r, index) => {
                  const active = index === cursor;
                  const student = r.type === 'student' ? getStudent(r.id) : undefined;
                  const kase = r.type === 'case' ? cases.find((c) => c.id === r.id) : undefined;

                  return (
                    <button
                      key={`${r.type}-${r.id}-${index}`}
                      data-index={index}
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => run(r)}
                      className={[
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                        active ? 'bg-brand-soft' : 'hover:bg-surface-hover',
                      ].join(' ')}
                    >
                      {student ? (
                        <Avatar initials={student.initials} size="sm" tone={student.status} />
                      ) : (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-4">
                          {r.type === 'case' ? (
                            <FileText className="h-3.5 w-3.5" />
                          ) : r.type === 'route' && r.param ? (
                            <RadarIcon className="h-3.5 w-3.5" />
                          ) : (
                            <GraduationCap className="h-3.5 w-3.5" />
                          )}
                        </span>
                      )}

                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={`truncate text-[12.5px] font-semibold ${active ? 'text-brand-text' : 'text-ink'}`}
                          >
                            {r.label}
                          </span>
                          {student && <HealthBadge status={student.status} />}
                          {kase && <PriorityBadge priority={kase.priority} />}
                          {kase && <RadarBadge radar={kase.radar} />}
                        </span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-ink-3">{r.sub}</span>
                      </span>

                      {active ? (
                        <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-brand-text" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-4" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex shrink-0 items-center gap-4 border-t border-hairline bg-surface-2 px-4 py-2">
              {[
                ['↑ ↓', 'navegar'],
                ['↵', 'abrir'],
                ['esc', 'fechar'],
              ].map(([key, label]) => (
                <span key={key} className="flex items-center gap-1.5 text-[10.5px] text-ink-4">
                  <kbd className="rounded bg-surface px-1 py-px font-mono text-[9.5px] font-semibold">
                    {key}
                  </kbd>
                  {label}
                </span>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
