import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import type { Cohort, Modality } from '../../types';
import { useApp } from '../../state/AppContext';
import { coursesFor, periodsFor } from '../../data/institution';
import { PERIODS } from '../../lib/cockpit';
import type { CockpitPeriod } from '../../lib/cockpit';
import { Segmented } from '../ui/Fields';
import { Button } from '../ui/Button';

/* ==========================================================================
   Barra de filtros do Cockpit
   --------------------------------------------------------------------------
   Os cinco recortes que a pergunta "como estamos?" sempre carrega. Três coisas
   que a barra faz e que separam um filtro real de um filtro decorativo:

     1. TODO CONTROLE ESTÁ LIGADO NO ESTADO GLOBAL. Não há cópia local: o valor
        que a barra mostra é o valor que o censo leu.
     2. AS OPÇÕES SÃO DERIVADAS DO CENSO, NÃO DIGITADAS. A lista de cursos vem
        da modalidade escolhida, e a de períodos vem do curso. Nunca é possível
        montar uma combinação que zere a tela por engano — Logística não aparece
        como opção quando a modalidade é Presencial, porque ela não existe lá.
     3. UM CONTROLE, UMA PERGUNTA. Período é fluxo (o que aconteceu na janela);
        os outros quatro são população (quem está na tela). Por isso período fica
        separado por um divisor, e não misturado com os demais.
   ========================================================================== */

/** Select compacto com o rótulo dentro do controle, como o seletor de ciclo. */
function InlineSelect({
  label,
  value,
  onChange,
  children,
  title,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: ReactNode;
  title?: string;
}) {
  return (
    <label
      title={title}
      className="flex h-8 min-w-0 items-center gap-1.5 rounded-full bg-surface-2 pr-1.5 pl-3 transition-colors hover:bg-surface-3"
    >
      <span className="shrink-0 text-[11px] font-medium text-ink-4">{label}</span>
      <span className="relative flex min-w-0 items-center">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="max-w-47.5 cursor-pointer appearance-none truncate bg-transparent pr-5 text-[12.5px] font-semibold text-ink focus:outline-none"
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0.5 h-3.5 w-3.5 text-ink-4" />
      </span>
    </label>
  );
}

export function CockpitFilters() {
  const {
    period,
    setPeriod,
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

  const courses = useMemo(() => coursesFor(modalityFilter), [modalityFilter]);
  const periods = useMemo(
    () => periodsFor(modalityFilter, courseFilter),
    [modalityFilter, courseFilter],
  );

  const dirty = filtersActive || period !== 'hoje';

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl bg-surface px-3 py-2.5">
      <Segmented<CockpitPeriod>
        layoutId="cockpit-period"
        value={period}
        onChange={setPeriod}
        options={PERIODS.map((p) => ({ value: p.key, label: p.label }))}
      />

      <span className="mx-1 hidden h-6 w-px bg-hairline lg:block" />

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

      {/* "Período acadêmico" por extenso: ao lado de um controle de janela
          temporal que também tem "Semestre", um rótulo só "Período" faz o
          usuário parar para descobrir qual dos dois é qual. */}
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

      <Segmented<'Todos' | Cohort>
        layoutId="cockpit-cohort"
        value={cohortFilter}
        onChange={setCohortFilter}
        options={[
          { value: 'Todos', label: 'Todos' },
          { value: 'Calouro', label: 'Calouros' },
          { value: 'Veterano', label: 'Veteranos' },
        ]}
      />

      {dirty && (
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          icon={<RotateCcw className="h-3.5 w-3.5" />}
          onClick={resetFilters}
        >
          Limpar
        </Button>
      )}
    </div>
  );
}
