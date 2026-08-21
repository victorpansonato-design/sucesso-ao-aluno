import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronUp, Layers, School, Shuffle } from 'lucide-react';
import type { Modality, Specialist, Specialty } from '../../types';
import { useApp, useQueueStats } from '../../state/AppContext';
import { Avatar } from '../ui/Badges';
import { isTransversal, roleLabel } from '../../lib/routing';
import { popoverVariants, press } from '../../lib/motion';

/* ==========================================================================
   Seletor de função
   --------------------------------------------------------------------------
   A operação não tem um perfil de atendente, tem oito: cada especialidade
   existe em Presencial e em Híbrido, mais a camada transversal de Retenção,
   Onboarding e Experiência.

   Trocar aqui não é trocar de "visão" — é trocar de OPERAÇÃO. A fila muda, o
   pool de casos sem dono muda (especialidade × modalidade, `lib/routing.ts`),
   os quatro números do turno mudam e a lista "precisam de mim agora" muda. Por
   isso a troca mostra a carga de cada função na própria lista: escolher entre
   funções sem saber quantos casos existem em cada uma é escolher no escuro.
   ========================================================================== */

const MODALITY_ICON: Record<Modality | 'Todas', typeof School> = {
  Presencial: School,
  'Híbrido': Layers,
  EaD: Layers,
  Todas: Shuffle,
};

/** A ordem canônica das especialidades. Vale para os dois grupos de modalidade. */
const SPECIALTY_ORDER: Specialty[] = [
  'Acadêmico',
  'Financeiro',
  'Engajamento',
  'Retenção',
  'Onboarding',
  'Experiência',
];

/** Grupos na ordem em que a equipe é descrita: por modalidade, depois transversal. */
const GROUPS: { key: 'Presencial' | 'Híbrido' | 'Todas'; label: string; hint: string }[] = [
  { key: 'Presencial', label: 'Presencial', hint: 'frequência, sala de aula, calendário' },
  { key: 'Híbrido', label: 'Híbrido', hint: 'AVA, acessos, encontros' },
  { key: 'Todas', label: 'Transversal', hint: 'atende as duas modalidades' },
];

export function RoleSwitcher() {
  const { currentUser, setCurrentUser, specialists, cases, getStudent, caseLoadOf } = useApp();
  const stats = useQueueStats();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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

  /** Carga real de cada função, para a escolha não ser às cegas. */
  const loadOf = useMemo(() => {
    const map = new Map<string, { mine: number; pool: number }>();
    for (const specialist of specialists) {
      const mine = caseLoadOf(specialist.id);
      const pool = cases.filter(
        (c) =>
          c.assigneeId === null &&
          c.specialty === specialist.specialty &&
          (isTransversal(specialist) ||
            getStudent(c.studentId)?.modality === specialist.modality),
      ).length;
      map.set(specialist.id, { mine, pool });
    }
    return map;
  }, [specialists, cases, getStudent, caseLoadOf]);

  const grouped = useMemo(
    () =>
      GROUPS.map((group) => ({
        ...group,
        /* Mesma ordem de especialidade nos dois grupos de modalidade. Sem isto
           a lista sai na ordem em que as pessoas foram cadastradas, e Presencial
           começa em Acadêmico enquanto Híbrido começa em Engajamento — o olho
           tem de reler o rótulo em vez de contar na posição. */
        people: specialists
          .filter((s) => s.modality === group.key)
          .sort(
            (a, b) =>
              SPECIALTY_ORDER.indexOf(a.specialty) - SPECIALTY_ORDER.indexOf(b.specialty) ||
              a.name.localeCompare(b.name, 'pt-BR'),
          ),
      })).filter((g) => g.people.length > 0),
    [specialists],
  );

  const CurrentIcon = MODALITY_ICON[currentUser.modality];

  const pick = (specialist: Specialist) => {
    setCurrentUser(specialist.id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <motion.button
        whileTap={press}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        title="Trocar de função — a fila e os números mudam com ela"
        className="flex w-full items-center gap-2.5 rounded-lg bg-surface-2 p-2.5 text-left transition-colors hover:bg-surface-3"
      >
        <Avatar initials={currentUser.initials} size="sm" tone="brand" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-semibold text-ink">
            {currentUser.name}
          </span>
          <span className="flex items-center gap-1 truncate text-[11px] text-ink-3">
            <CurrentIcon className="h-3 w-3 shrink-0" />
            {roleLabel(currentUser)}
          </span>
        </span>
        <ChevronUp
          className={`h-3.5 w-3.5 shrink-0 text-ink-4 transition-transform ${open ? '' : 'rotate-180'}`}
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={popoverVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            role="listbox"
            className="absolute bottom-full left-0 z-50 mb-2 w-71.5 origin-bottom-left overflow-hidden rounded-xl bg-surface shadow-overlay"
          >
            <div className="border-b border-hairline bg-surface-2 px-3.5 py-2.5">
              <p className="text-[12.5px] font-semibold text-ink">Trocar de função</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">
                Cada função é uma fila diferente. Você tem{' '}
                <span className="font-mono font-medium text-ink-2">{stats.mineCount}</span> casos e{' '}
                <span className="font-mono font-medium text-ink-2">{stats.unownedMineCount}</span> sem
                dono na atual.
              </p>
            </div>

            <div className="scroll-slim max-h-[min(520px,60vh)] overflow-y-auto py-1">
              {grouped.map((group) => (
                <div key={group.key} className="py-1">
                  <p className="flex items-baseline gap-1.5 px-3.5 pt-1 pb-1.5">
                    <span className="text-[11px] font-semibold text-ink-2">{group.label}</span>
                    <span className="truncate text-[10.5px] text-ink-4">{group.hint}</span>
                  </p>

                  {group.people.map((specialist) => {
                    const active = specialist.id === currentUser.id;
                    const load = loadOf.get(specialist.id) ?? { mine: 0, pool: 0 };

                    return (
                      <button
                        key={specialist.id}
                        role="option"
                        aria-selected={active}
                        onClick={() => pick(specialist)}
                        className={[
                          'flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors',
                          active ? 'bg-brand-soft' : 'hover:bg-surface-2',
                        ].join(' ')}
                      >
                        <Avatar
                          initials={specialist.initials}
                          size="sm"
                          tone={active ? 'brand' : 'neutral'}
                        />
                        <span className="min-w-0 flex-1">
                          <span
                            className={[
                              'block truncate text-[12.5px]',
                              active ? 'font-semibold text-ink' : 'font-medium text-ink-2',
                            ].join(' ')}
                          >
                            {specialist.specialty}
                          </span>
                          <span className="block truncate text-[11px] text-ink-4">
                            {specialist.name}
                          </span>
                        </span>

                        {/* A carga da função, para a escolha não ser às cegas. */}
                        <span className="shrink-0 text-right">
                          <span className="block font-mono text-[11.5px] font-medium text-ink-2">
                            {load.mine}
                          </span>
                          {load.pool > 0 && (
                            <span
                              className="block font-mono text-[10px] text-warn-ink"
                              title={`${load.pool} caso(s) sem dono nesta função`}
                            >
                              +{load.pool}
                            </span>
                          )}
                        </span>

                        {active && <Check className="h-3.5 w-3.5 shrink-0 text-brand-text" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <p className="border-t border-hairline px-3.5 py-2 text-[10.5px] leading-relaxed text-ink-4">
              A coluna da direita é a sua carga; o número em âmbar são casos sem dono que aquela
              função pode assumir.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
