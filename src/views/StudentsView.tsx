import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Download,
  FilterX,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react';
import type { HealthStatus, Student } from '../types';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import { Card, EmptyState, PageHeader, Row, StatTile } from '../components/ui/Surfaces';
import { Button } from '../components/ui/Button';
import { Chip, SearchInput, Select } from '../components/ui/Fields';
import {
  Avatar,
  CohortBadge,
  HealthBadge,
  RadarBadge,
  TrendIndicator,
} from '../components/ui/Badges';
import { Sparkline } from '../components/ui/Charts';
import { COURSE_NAMES } from '../data/catalog';
import { scoreDistribution } from '../lib/healthScore';
import { accessDropPercent } from '../lib/radars';
import { exportStudents } from '../lib/exporters';
import { decimal, int, percent, searchKey } from '../lib/format';

/* ==========================================================================
   Base de Alunos
   --------------------------------------------------------------------------
   A directory that behaves like a real operational table: sortable columns,
   working filters that compose, pagination, and a CSV export of exactly what is
   on screen. Rows carry the three numbers that decide whether to intervene —
   score, attendance and AVA recency — so the attendant rarely needs to open a
   dossier just to triage.
   ========================================================================== */

type SortKey = 'score' | 'nome' | 'frequencia' | 'ava' | 'media' | 'periodo';
const PAGE_SIZE = 12;

export function StudentsView({ actions }: { actions: ShellActions }) {
  const { scopedStudents, radarsOf, resetFilters, filtersActive, students } = useApp();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<HealthStatus | 'todos'>('todos');
  const [course, setCourse] = useState('todos');
  const [scoreBand, setScoreBand] = useState<'todos' | '0-40' | '41-60' | '61-80' | '81-100'>('todos');
  const [sort, setSort] = useState<SortKey>('score');
  const [asc, setAsc] = useState(true);
  const [page, setPage] = useState(0);

  const distribution = useMemo(() => scoreDistribution(scopedStudents), [scopedStudents]);

  const filtered = useMemo(() => {
    const list = scopedStudents.filter((s) => {
      if (status !== 'todos' && s.status !== status) return false;
      if (course !== 'todos' && s.course !== course) return false;
      if (scoreBand !== 'todos') {
        const [min, max] = scoreBand.split('-').map(Number);
        if (s.healthScore < min || s.healthScore > max) return false;
      }
      if (query.trim()) {
        const q = searchKey(query.trim());
        const hit =
          searchKey(s.name).includes(q) ||
          s.ra.includes(query.trim()) ||
          searchKey(s.course).includes(q) ||
          searchKey(s.email).includes(q);
        if (!hit) return false;
      }
      return true;
    });

    const dir = asc ? 1 : -1;
    const value = (s: Student) => {
      switch (sort) {
        case 'nome':
          return s.name;
        case 'frequencia':
          return s.academic.attendancePercent;
        case 'ava':
          return s.engagement.lastAccessDaysAgo;
        case 'media':
          return s.academic.gpa;
        case 'periodo':
          return s.period;
        default:
          return s.healthScore;
      }
    };

    return [...list].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb, 'pt-BR') * dir;
      return ((va as number) - (vb as number)) * dir;
    });
  }, [scopedStudents, status, course, scoreBand, query, sort, asc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const localFilters = status !== 'todos' || course !== 'todos' || scoreBand !== 'todos' || query.trim() !== '';

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc((v) => !v);
    else {
      setSort(key);
      // Score and AVA recency are most useful ascending (worst first);
      // names and grades read better the other way round.
      setAsc(key === 'score' || key === 'nome' || key === 'frequencia' || key === 'media' ? true : false);
    }
    setPage(0);
  };

  const SortHeader = ({ label, k, className = '' }: { label: string; k: SortKey; className?: string }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1 text-[11px] font-medium  transition-colors ${
        sort === k ? 'text-ink' : 'text-ink-4 hover:text-ink-2'
      } ${className}`}
    >
      {label}
      {sort === k &&
        (asc ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />)}
    </button>
  );

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-5"
    >
      <PageHeader
        eyebrow="Cadastro único · visão 360°"
        title="Base de Alunos"
        description="Todos os alunos do escopo com Health Score recalculado pelo perfil de peso da sua modalidade. Clique em qualquer linha para abrir o dossiê completo."
        actions={
          <Button
            variant="secondary"
            icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => exportStudents(filtered)}
            title="Exporta exatamente os alunos filtrados"
          >
            Exportar {filtered.length} alunos
          </Button>
        }
      />

      {/* Distribution strip — clickable score bands */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile
          label="No escopo"
          value={int(scopedStudents.length)}
          detail={`de ${int(students.length)}`}
          icon={<Users className="h-3.5 w-3.5" />}
          footer={<span>{filtersActive ? 'filtros globais ativos' : 'base completa'}</span>}
        />
        {distribution.map((band) => (
          <StatTile
            key={band.status}
            label={band.label}
            value={int(band.count)}
            detail={percent(band.percent, 1)}
            accent={band.hex(false)}
            onClick={() => {
              setStatus(band.status);
              setScoreBand('todos');
              setPage(0);
            }}
            footer={
              <>
                <span className="font-mono">
                  {band.range[0]}–{band.range[1]} pts
                </span>
                {status === band.status && (
                  <span className="font-mono font-semibold text-brand-text">filtrado</span>
                )}
              </>
            }
          />
        ))}
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onValueChange={(v) => {
              setQuery(v);
              setPage(0);
            }}
            placeholder="Nome, RA, curso ou e-mail…"
            className="min-w-[240px] flex-1"
          />

          <Select
            value={course}
            onChange={(e) => {
              setCourse(e.target.value);
              setPage(0);
            }}
            aria-label="Curso"
            className="w-[220px]"
          >
            <option value="todos">Todos os cursos</option>
            {COURSE_NAMES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>

          <Select
            value={scoreBand}
            onChange={(e) => {
              setScoreBand(e.target.value as typeof scoreBand);
              setStatus('todos');
              setPage(0);
            }}
            aria-label="Faixa de Health Score"
            className="w-[180px]"
          >
            <option value="todos">Qualquer score</option>
            <option value="81-100">81–100 · Estável</option>
            <option value="61-80">61–80 · Atenção</option>
            <option value="41-60">41–60 · Risco</option>
            <option value="0-40">0–40 · Crítico</option>
          </Select>

          {(localFilters || filtersActive) && (
            <Button
              variant="ghost"
              icon={<FilterX className="h-3.5 w-3.5" />}
              onClick={() => {
                setQuery('');
                setStatus('todos');
                setCourse('todos');
                setScoreBand('todos');
                setPage(0);
                resetFilters();
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>

        {status !== 'todos' && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-hairline pt-3">
            <span className="text-[11px] font-medium text-ink-4">
              Classificação
            </span>
            {(['Estável', 'Atenção', 'Risco', 'Crítico'] as HealthStatus[]).map((s) => (
              <Chip
                key={s}
                active={status === s}
                onClick={() => {
                  setStatus(status === s ? 'todos' : s);
                  setPage(0);
                }}
                tone={s === 'Crítico' ? 'crit' : 'neutral'}
                count={scopedStudents.filter((x) => x.status === s).length}
              >
                {s}
              </Chip>
            ))}
          </div>
        )}
      </Card>

      {/* Table */}
      <Card padded={false} className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-hairline bg-surface-2 px-4 py-2.5">
          <span className="text-[11px] font-medium text-ink-3">
            {filtered.length} {filtered.length === 1 ? 'aluno' : 'alunos'}
          </span>
          <div className="flex items-center gap-4">
            <SortHeader label="Nome" k="nome" />
            <SortHeader label="Período" k="periodo" />
            <SortHeader label="Média" k="media" />
            <SortHeader label="Frequência" k="frequencia" />
            <SortHeader label="AVA" k="ava" />
            <SortHeader label="Score" k="score" />
          </div>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="Nenhum aluno encontrado"
            message="Os filtros aplicados não retornaram resultados. Limpe-os para ver a base completa."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setQuery('');
                  setStatus('todos');
                  setCourse('todos');
                  setScoreBand('todos');
                }}
              >
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-hairline">
            {rows.map((s) => {
              const radars = radarsOf(s.id);
              const drop = accessDropPercent(s);

              return (
                <Row
                  key={s.id}
                  tone={s.status === 'Crítico' ? 'crit' : 'plain'}
                  className="group"
                >
                  <div className="flex flex-col gap-2.5 px-5 py-3 xl:flex-row xl:items-center xl:gap-5">
                    {/* Identity — two lines. The RA and the radars live on the
                        second line rather than earning a third. */}
                    <button
                      onClick={() => actions.openStudent(s.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <Avatar initials={s.initials} size="sm" tone={s.status} />
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                          <span className="truncate text-[13.5px] font-semibold text-ink group-hover:underline">
                            {s.name}
                          </span>
                          <HealthBadge status={s.status} />
                          {s.cohort === 'Calouro' && (
                            <CohortBadge cohort="Calouro" days={s.journey.daysSinceEnrollment} />
                          )}
                          {radars.slice(0, 2).map((r) => (
                            <RadarBadge key={r} radar={r} />
                          ))}
                          {radars.length > 2 && (
                            <span
                              className="text-[11px] text-ink-4"
                              title={radars.join(' · ')}
                            >
                              +{radars.length - 2}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                          <span className="font-mono">{s.ra}</span> · {s.course} · {s.period}º ·{' '}
                          {s.modality === 'EaD' ? 'EaD 100%' : s.modality}
                        </span>
                      </span>
                    </button>

                    {/* Metrics — values only. The column header names them. */}
                    <div className="flex shrink-0 items-center gap-5">
                      <span
                        className={[
                          'w-10 text-right font-mono text-[13px]',
                          s.academic.gpa < 6 ? 'font-semibold text-crit-ink' : 'text-ink-2',
                        ].join(' ')}
                        title="Média do período"
                      >
                        {s.academic.gpa > 0 ? decimal(s.academic.gpa, 1) : '—'}
                      </span>

                      <span
                        className={[
                          'w-12 text-right font-mono text-[13px]',
                          s.academic.attendancePercent < 75
                            ? 'font-semibold text-crit-ink'
                            : 'text-ink-2',
                        ].join(' ')}
                        title="Frequência"
                      >
                        {percent(s.academic.attendancePercent)}
                      </span>

                      <span
                        className="hidden w-[86px] items-center justify-end gap-1.5 sm:flex"
                        title="Acessos ao AVA nas últimas 8 semanas"
                      >
                        <Sparkline
                          data={s.engagement.accessTrend}
                          width={48}
                          height={16}
                          color={drop >= 40 ? 'var(--crit)' : 'var(--ink-4)'}
                        />
                        <span
                          className={[
                            'font-mono text-[11px]',
                            s.engagement.lastAccessDaysAgo >= 7
                              ? 'font-semibold text-crit-ink'
                              : 'text-ink-3',
                          ].join(' ')}
                        >
                          {s.engagement.lastAccessDaysAgo === 0
                            ? 'hoje'
                            : `${s.engagement.lastAccessDaysAgo}d`}
                        </span>
                      </span>

                      <span className="flex w-20 items-center justify-end gap-1.5" title="Health Score">
                        <TrendIndicator trend={s.trend} />
                        <span className="font-mono text-[15px] font-medium text-ink">
                          {s.healthScore}
                        </span>
                      </span>

                      <span className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          square
                          title="Copiloto de abordagem"
                          onClick={() => actions.copilot(s.id)}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          square
                          title="Registrar contato"
                          onClick={() => actions.register({ studentId: s.id })}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          iconRight={<ChevronRight className="h-3.5 w-3.5" />}
                          onClick={() => actions.openStudent(s.id)}
                        >
                          Dossiê
                        </Button>
                      </span>
                    </div>
                  </div>
                </Row>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {pageCount > 1 && (
          <div className="flex items-center justify-between border-t border-hairline bg-surface-2 px-4 py-2.5">
            <span className="font-mono text-[10.5px] text-ink-4">
              {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} de{' '}
              {filtered.length}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="xs"
                variant="ghost"
                square
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                title="Página anterior"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              {Array.from({ length: pageCount }, (_, i) => i)
                .filter((i) => i === 0 || i === pageCount - 1 || Math.abs(i - safePage) <= 1)
                .map((i, idx, arr) => (
                  <span key={i} className="flex items-center gap-1.5">
                    {idx > 0 && arr[idx - 1] !== i - 1 && (
                      <span className="font-mono text-[10.5px] text-ink-4">…</span>
                    )}
                    <button
                      onClick={() => setPage(i)}
                      className={[
                        'h-7 min-w-7 rounded-md px-2 font-mono text-[11px] font-semibold transition-colors',
                        i === safePage
                          ? 'bg-brand text-on-brand'
                          : 'bg-surface text-ink-3 hover:text-ink',
                      ].join(' ')}
                    >
                      {i + 1}
                    </button>
                  </span>
                ))}
              <Button
                size="xs"
                variant="ghost"
                square
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
                title="Próxima página"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
