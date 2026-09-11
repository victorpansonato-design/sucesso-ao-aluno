import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import type { Cohort, Modality } from '../../types';
import { useApp } from '../../state/AppContext';
import { coursesFor, periodsFor } from '../../data/institution';
import { PERIODS } from '../../lib/cockpit';
import type { CockpitPeriod } from '../../lib/cockpit';
import { SEMESTERS } from '../../data/catalog';
import { Segmented } from '../ui/Fields';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Overlay';
import { collapseVariants } from '../../lib/motion';

/* ==========================================================================
   Barra de contexto do Dashboard
   --------------------------------------------------------------------------
   O problema que esta barra resolve não é de layout, é de confiança: a versão
   anterior tinha o recorte global "Hoje" no alto e gráficos locais de "7 dias"
   no meio da página, sem nada dizendo qual controle mandava em quê. O usuário
   que troca "Hoje" por "90 dias" e vê um gráfico continuar em 7 conclui, com
   razão, que o filtro não filtra.

   A regra que a barra passa a aplicar, e que é o ponto do redesenho:

     JANELA OPERACIONAL   mora AQUI e afeta a página inteira. Está escrito ao
                          lado do controle.
     INTERVALO DO GRÁFICO mora DENTRO do cartão do gráfico e afeta só ele.
                          Também está escrito.

   Nenhum controle de escopo de módulo sobe para esta barra e nenhum controle
   global desce para um cartão. O lugar do controle passa a ser a informação
   sobre o seu alcance — o que é mais confiável que qualquer legenda, porque não
   depende de o usuário ler.

   Os quatro recortes de POPULAÇÃO (modalidade, curso, período acadêmico, perfil)
   ficam depois de um divisor, porque respondem outra pergunta: janela é "quando",
   população é "quem".

   No desktop a barra é sticky sob o header. No mobile ela vira um `Drawer` — os
   nove controles em 390px de largura ocupariam a primeira dobra inteira, e a
   primeira dobra tem de decidir, não configurar.
   ========================================================================== */

/** Select compacto, com o rótulo dentro do controle. Mesmo padrão do ciclo. */
function InlineSelect({
  label,
  value,
  onChange,
  children,
  title,
  full = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  title?: string;
  full?: boolean;
}) {
  return (
    <label
      title={title}
      className={[
        'flex h-8 min-w-0 items-center gap-1.5 rounded-full bg-surface-2 pr-1.5 pl-3',
        'transition-colors hover:bg-surface-3',
        full ? 'w-full' : '',
      ].join(' ')}
    >
      <span className="shrink-0 text-[11px] font-medium text-ink-4">{label}</span>
      <span className="relative flex min-w-0 flex-1 items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="w-full min-w-0 cursor-pointer appearance-none truncate bg-transparent pr-5 text-[12.5px] font-semibold text-ink focus:outline-none"
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-0.5 h-3.5 w-3.5 text-ink-4"
          aria-hidden="true"
        />
      </span>
    </label>
  );
}

export interface ScopeChip {
  key: string;
  label: string;
  clear: () => void;
}

export function ContextBar({ loading = false }: { loading?: boolean }) {
  const {
    period,
    setPeriod,
    semester,
    setSemester,
    modalityFilter,
    setModalityFilter,
    courseFilter,
    setCourseFilter,
    academicPeriod,
    setAcademicPeriod,
    cohortFilter,
    setCohortFilter,
    filtersActive,
    resetFilters,
  } = useApp();

  const [sheetOpen, setSheetOpen] = useState(false);

  const courses = useMemo(() => coursesFor(modalityFilter), [modalityFilter]);
  const periods = useMemo(
    () => periodsFor(modalityFilter, courseFilter),
    [modalityFilter, courseFilter],
  );

  /* Chips só do que está REALMENTE recortando. A janela operacional não vira
     chip: ela tem sempre um valor, então um chip "Hoje" que não se pode remover
     seria um botão que não faz nada. */
  const chips: ScopeChip[] = useMemo(() => {
    const out: ScopeChip[] = [];
    if (modalityFilter !== 'Todas') {
      out.push({
        key: 'modality',
        label: modalityFilter,
        clear: () => setModalityFilter('Todas'),
      });
    }
    if (courseFilter !== 'Todos') {
      out.push({ key: 'course', label: courseFilter, clear: () => setCourseFilter('Todos') });
    }
    if (academicPeriod !== 0) {
      out.push({
        key: 'academic',
        label: `${academicPeriod}º período`,
        clear: () => setAcademicPeriod(0),
      });
    }
    if (cohortFilter !== 'Todos') {
      out.push({ key: 'cohort', label: `${cohortFilter}s`, clear: () => setCohortFilter('Todos') });
    }
    return out;
  }, [
    modalityFilter,
    courseFilter,
    academicPeriod,
    cohortFilter,
    setModalityFilter,
    setCourseFilter,
    setAcademicPeriod,
    setCohortFilter,
  ]);

  /* -- Os controles, montados uma vez e usados nos dois invólucros -------- */

  const windowControl = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10.5px] font-medium tracking-tight text-ink-4">
        Janela operacional · afeta toda a página
      </span>
      <Segmented<CockpitPeriod>
        layoutId="dashboard-window"
        value={period}
        onChange={setPeriod}
        options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
      />
    </div>
  );

  const populationControls = (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[10.5px] font-medium tracking-tight text-ink-4">
        População · quem está na tela
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <InlineSelect label="Ciclo" value={semester} onChange={setSemester}>
          {SEMESTERS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </InlineSelect>

        <InlineSelect
          label="Modalidade"
          value={modalityFilter}
          onChange={(v) => setModalityFilter(v as 'Todas' | Modality)}
        >
          <option value="Todas">Todas</option>
          <option value="Presencial">Presencial</option>
          <option value="Híbrido">Híbrido</option>
        </InlineSelect>

        <InlineSelect
          label="Curso"
          value={courseFilter}
          onChange={setCourseFilter}
          title={courseFilter === 'Todos' ? undefined : courseFilter}
        >
          <option value="Todos">Todos os cursos</option>
          {courses.map((course) => (
            <option key={course} value={course}>
              {course}
            </option>
          ))}
        </InlineSelect>

        <InlineSelect
          label="Período acadêmico"
          value={String(academicPeriod)}
          onChange={(v) => setAcademicPeriod(Number(v))}
        >
          <option value="0">Todos</option>
          {periods.map((p) => (
            <option key={p} value={String(p)}>
              {p}º período
            </option>
          ))}
        </InlineSelect>

        <InlineSelect
          label="Perfil do aluno"
          value={cohortFilter}
          onChange={(v) => setCohortFilter(v as 'Todos' | Cohort)}
        >
          <option value="Todos">Todos</option>
          <option value="Calouro">Calouros</option>
          <option value="Veterano">Veteranos</option>
        </InlineSelect>
      </div>
    </div>
  );

  return (
    <>
      {/* -- Desktop: sticky sob o header ---------------------------------- */}
      <div className="sticky top-[74px] z-10 -mx-1 hidden px-1 py-1 lg:block">
        <div className="rounded-xl bg-surface/92 px-3.5 py-3 backdrop-blur-xl">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            {windowControl}
            <span className="mb-1 hidden h-8 w-px shrink-0 bg-hairline xl:block" aria-hidden="true" />
            {populationControls}

            <div className="ml-auto flex shrink-0 items-center gap-2 self-end">
              <LoadingNote loading={loading} />
              {filtersActive && (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<RotateCcw className="h-3.5 w-3.5" />}
                  onClick={resetFilters}
                >
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>

          <ChipRow chips={chips} />
        </div>
      </div>

      {/* -- Mobile e tablet: gatilho + drawer ----------------------------- */}
      <div className="lg:hidden">
        <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
          <Segmented<CockpitPeriod>
            layoutId="dashboard-window-compact"
            size="xs"
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
          />
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto"
            icon={<SlidersHorizontal className="h-3.5 w-3.5" />}
            onClick={() => setSheetOpen(true)}
            aria-label="Abrir filtros de população"
          >
            Filtros
            {chips.length > 0 && (
              <span className="ml-1 font-mono text-[11px] font-semibold text-brand-text">
                {chips.length}
              </span>
            )}
          </Button>
        </div>
        <ChipRow chips={chips} />
      </div>

      <Drawer open={sheetOpen} onClose={() => setSheetOpen(false)} width="md" label="Filtros">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 className="text-[15px] font-semibold text-ink">Filtros do Dashboard</h2>
          <Button
            size="sm"
            variant="ghost"
            square
            onClick={() => setSheetOpen(false)}
            aria-label="Fechar filtros"
            icon={<X className="h-4 w-4" />}
          />
        </div>

        <div className="scroll-slim flex-1 space-y-5 overflow-y-auto p-5">
          {windowControl}
          <span className="block h-px bg-hairline" aria-hidden="true" />
          {populationControls}
          {filtersActive && (
            <Button
              variant="secondary"
              full
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={resetFilters}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </Drawer>
    </>
  );
}

/**
 * Os chips do recorte ativo.
 *
 * Entram e saem com `collapseVariants` em vez de aparecer e desaparecer: uma
 * fileira que surge de repente empurra a página inteira para baixo, e o
 * requisito é trocar filtro sem layout shift. Colapsando a altura, o empurrão
 * acontece em 260ms e o olho acompanha.
 */
function ChipRow({ chips }: { chips: ScopeChip[] }) {
  return (
    <AnimatePresence initial={false}>
      {chips.length > 0 && (
        <motion.div
          variants={collapseVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="overflow-hidden"
        >
          <ul className="flex flex-wrap items-center gap-1.5 pt-2.5">
            <li className="text-[11px] font-medium text-ink-4">Recorte ativo:</li>
            {chips.map((chip) => (
              <li key={chip.key}>
                <button
                  type="button"
                  onClick={chip.clear}
                  className="group flex h-6 items-center gap-1.5 rounded-full bg-surface-2 pr-1.5 pl-2.5 transition-colors hover:bg-surface-3"
                  aria-label={`Remover recorte ${chip.label}`}
                >
                  <span className="max-w-42 truncate text-[11.5px] font-medium text-ink-2">
                    {chip.label}
                  </span>
                  <X className="h-3 w-3 shrink-0 text-ink-4 group-hover:text-ink-2" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * O aviso de recálculo.
 *
 * Ocupa espaço reservado (`w-24`) mesmo quando invisível, porque o requisito é
 * "anunciar carregamento SEM layout shift". Um aviso que aparece e empurra os
 * botões ao lado é pior que nenhum aviso. `aria-live="polite"` faz o leitor de
 * tela anunciar a troca sem interromper o que estiver lendo.
 */
function LoadingNote({ loading }: { loading: boolean }) {
  return (
    <span
      aria-live="polite"
      className="flex w-24 shrink-0 items-center justify-end gap-1.5 text-[11px] text-ink-4"
    >
      {loading && (
        <>
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-2"
            aria-hidden="true"
          />
          recalculando
        </>
      )}
    </span>
  );
}
