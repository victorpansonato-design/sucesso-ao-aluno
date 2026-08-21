import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BellOff,
  CalendarClock,
  CheckCircle2,
  Forward,
  Hand,
  MessageSquare,
  Phone,
  RotateCcw,
  Sparkles,
  UserRound,
} from 'lucide-react';
import type { Case } from '../../types';
import { useApp } from '../../state/AppContext';
import { Button, LinkButton } from '../ui/Button';
import { Callout, DataList, Tabs } from '../ui/Surfaces';
import {
  Avatar,
  CaseStatusBadge,
  CohortBadge,
  ModalityBadge,
  PriorityBadge,
  RadarBadge,
} from '../ui/Badges';
import { TextArea } from '../ui/Fields';
import { MeterBar } from '../ui/Charts';
import { SlaBanner } from './SlaPill';
import { Timeline } from './Timeline';
import { RADARS } from '../../lib/radars';
import { isTerminal, nextStatuses } from '../../lib/caseFlow';
import { SCORE_BANDS } from '../../lib/healthScore';
import { stamp } from '../../lib/format';

/* ==========================================================================
   O caso — a única tela de um aluno em atendimento
   --------------------------------------------------------------------------
   Este painel É o dossiê. Não existe mais uma "visualização rápida" aqui e uma
   ficha completa em outra rota: os dois mostravam identidade, sinais, score e
   linha do tempo, o atendente lia tudo duas vezes e nunca sabia qual dos dois
   estava atualizado. O que a ficha tinha a mais virou aba aqui dentro
   (Jornada, Protocolo, Histórico), e a fila abre este painel em tela cheia.

   An attendant about to pick up the phone needs six things, and the old panel
   made them scroll through seven stacked sections to collect them. Scrolling
   inside a box to find what matters is the failure this rewrite fixes.

   The first screen — "Resumo" — carries exactly those six and nothing else:

     1. who this is            (name, RA, course, period, modality, cohort)
     2. why they surfaced      (the detected signals)
     3. what to do about it    (the recommended action)
     4. the score and the ONE dimension dragging it down
     5. how much SLA is left
     6. how to reach them      (phone, WhatsApp)

   Everything else — the full timeline, the protocol record, team notes, the
   status history, the radar's standing guidance — is real and still one click
   away, on its own tab. It stopped competing with the six.

   Identity, SLA and the action row are outside the tabs, because they are true
   no matter which tab is open.

   Two rules still govern the action row:
     · Only transitions the state machine permits are rendered. No button here
       can fail or surprise.
     · The primary action follows the case state. A pending case wants to be
       claimed; a case in contact wants its outcome recorded.
   ========================================================================== */

export interface CaseActions {
  onRegister: (caseId: string) => void;
  onCopilot: (studentId: string, caseId: string) => void;
  onForward: (caseId: string) => void;
  onClose: (caseId: string, mode: 'retido' | 'perdido' | 'descartar') => void;
  onReopen: (caseId: string) => void;
  onFollowUp: (studentId: string, caseId: string) => void;
}

type Tab = 'resumo' | 'jornada' | 'protocolo' | 'notas' | 'historico';

/** Mini pizza do health score: uma olhada mais rápida que ler "66/100" e
    procurar o rótulo do status ao lado — a cor da faixa já carrega o veredito. */
function ScorePie({
  value,
  color,
  trackColor = 'var(--track)',
  size = 52,
  thickness = 6,
  valueClassName = 'text-ink',
}: {
  value: number;
  color: string;
  trackColor?: string;
  size?: number;
  thickness?: number;
  valueClassName?: string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circumference;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className={['font-mono text-[13px] font-semibold', valueClassName].join(' ')}>{value}</span>
      </div>
    </div>
  );
}

export function CaseWorkflow({ kase, actions }: { kase: Case; actions: CaseActions }) {
  const {
    getStudent,
    getSpecialist,
    claimCase,
    setHold,
    addCaseNote,
    currentUser,
    transitionCase,
    scoreOf,
    theme,
  } = useApp();
  const student = getStudent(kase.studentId);
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<Tab>('resumo');

  const score = scoreOf(kase.studentId);
  const dark = theme === 'dark';
  const scoreColor = score
    ? SCORE_BANDS.find((band) => band.status === score.status)?.hex(dark) ?? 'var(--brand)'
    : 'var(--brand)';

  /* The single dimension dragging the score down. Five meters side by side is
     a chart; one named weakness is a talking point for the call. */
  const weakest = useMemo(() => {
    if (!score) return null;
    return [...score.factors]
      .filter((f) => f.weight > 0)
      .sort((a, b) => a.earned / a.weight - b.earned / b.weight)[0];
  }, [score]);

  if (!student) return null;

  const owner = getSpecialist(kase.assigneeId);
  const radar = RADARS[kase.radar];
  const mine = kase.assigneeId === currentUser.id;
  const closed = isTerminal(kase.status);
  const allowed = nextStatuses(kase.status);
  const digits = student.phone.replace(/\D/g, '');

  return (
    <div className="flex flex-col">
      {/* ---- 1 · Quem é. O único elemento em azul preenchido desta tela ---
              A faixa é o âncora: quando ela está na tela, você está tratando
              UMA pessoa, e não navegando uma lista. É o que sobrou da antiga
              divisão entre "visualização rápida" e "dossiê 360°" — os dois
              mostravam identidade, sinais, score e timeline, e o segundo era uma
              página inteira para repetir a primeira. Agora é um lugar só, e o
              que era o dossiê virou as abas Jornada e Histórico aqui embaixo.

              Só a identidade fica no azul. SLA e badges carregam a sua própria
              semântica de cor (âmbar, vermelho) e sobre azul brigariam com ela,
              então ficam na superfície neutra logo abaixo. */}
      <div className="shrink-0 bg-brand px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 items-center gap-3.5">
            <Avatar initials={student.initials} size="md" tone="onBrand" />
            <div className="min-w-0">
              <p className="font-mono text-[11.5px] font-medium text-on-brand/70">
                {kase.protocol}
              </p>
              <h2 className="mt-0.5 truncate text-[21px] leading-tight font-semibold text-on-brand">
                {student.name}
              </h2>
              <p className="mt-0.5 truncate text-[12.5px] text-on-brand/75">
                RA <span className="font-mono">{student.ra}</span> · {student.course} ·{' '}
                {student.modality} · {student.period}º período
              </p>
            </div>
          </div>

          {score && (
            <div className="flex shrink-0 items-center gap-2.5">
              <ScorePie
                value={score.total}
                color={scoreColor}
                trackColor="rgba(255,255,255,0.28)"
                valueClassName="text-on-brand"
              />
              <p className="text-[11.5px] font-semibold tracking-wide text-on-brand/85 uppercase">
                {score.status}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ---- 5 · SLA, dono e a classificação do caso -------------------- */}
      <div className="shrink-0 px-5 pt-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityBadge priority={kase.priority} />
            <CaseStatusBadge status={kase.status} />
            <RadarBadge radar={kase.radar} full />
            <ModalityBadge modality={student.modality} />
            <CohortBadge cohort={student.cohort} days={student.journey.daysSinceEnrollment} />
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
            <span className="flex items-center gap-1.5 text-[12px] text-ink-3">
              <UserRound className="h-3.5 w-3.5" />
              {owner ? (
                <span>
                  {owner.name}
                  {mine && <span className="ml-1 font-semibold text-ink">· você</span>}
                </span>
              ) : (
                <span className="font-semibold text-crit-ink">Sem responsável</span>
              )}
            </span>
            <SlaBanner kase={kase} />
          </div>
        </div>

        <div className="mt-4">
          <Tabs
            layoutId="case-tabs"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'resumo', label: 'Resumo' },
              { value: 'jornada', label: 'Jornada' },
              { value: 'protocolo', label: 'Protocolo' },
              { value: 'notas', label: 'Observações', count: kase.notes.length },
              { value: 'historico', label: 'Histórico' },
            ]}
          />
        </div>
      </div>

      {/* ---- O corpo da aba.
              Sem scroll interno: o caso ocupa a tela inteira agora, então quem
              rola é a PÁGINA. Enquanto o painel vivia numa coluna de 400px, esta
              área era um scroller com altura limitada — e rolar dentro de uma
              caixa que já está dentro de uma página com barra própria é a
              sensação de estar preso numa janelinha. --------------------- */}
      <div className="p-5 sm:p-6">
        {tab === 'resumo' && (
          <div className="space-y-4">
            {!owner && (
              <Callout tone="crit" icon={<Hand className="h-3.5 w-3.5" />} title="Caso sem dono">
                Ninguém assumiu este caso. O SLA continua correndo e o aluno não está sendo
                contatado.
              </Callout>
            )}

            {/* 2 · Why they surfaced */}
            <div>
              <h3 className="text-[12px] font-semibold text-ink-3">Por que apareceu</h3>
              <ul className="mt-2 space-y-1.5">
                {kase.signals.map((signal) => (
                  <li key={signal} className="flex gap-2.5">
                    <span
                      className={[
                        'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                        kase.priority === 'Crítico' ? 'bg-crit' : 'bg-warn',
                      ].join(' ')}
                    />
                    <span className="text-[13px] leading-relaxed text-ink-2">{signal}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 text-[12px] leading-relaxed text-ink-3">{kase.diagnosis}</p>
            </div>

            {/* 3 · What to do */}
            <div className="rounded-lg bg-surface-2 p-3.5">
              <h3 className="text-[12px] font-semibold text-ink-3">Ação recomendada</h3>
              <p className="mt-1 text-[13px] leading-relaxed font-medium text-ink">
                {kase.recommendedAction}
              </p>
            </div>

            {/* 4 · Score and the one dimension pulling it down */}
            {score && weakest && (
              <div className="flex items-center gap-5">
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                  <ScorePie value={score.total} color={scoreColor} size={64} thickness={7} />
                  <span className="text-[11px] font-medium text-ink-3">Health Score</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-[13px] font-medium text-ink">
                      {weakest.label} é o que mais pesa
                    </span>
                    <span className="shrink-0 font-mono text-[12px] text-ink-3">
                      {weakest.earned}/{weakest.weight}
                    </span>
                  </div>
                  <div className="mt-2">
                    <MeterBar
                      value={(weakest.earned / weakest.weight) * 100}
                      color={weakest.impact === 'negative' ? 'var(--crit)' : 'var(--warn)'}
                      height={4}
                    />
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-3">{weakest.rationale}</p>
                </div>
              </div>
            )}

            {/* 6 · How to reach them, plus the one switch to flip first */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-3">
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href={`tel:${digits}`}
                  className="inline-flex items-center gap-2 font-mono text-[13px] font-medium text-ink transition-colors hover:text-brand-text"
                >
                  <Phone className="h-3.5 w-3.5 text-ink-4" />
                  {student.phone}
                </a>
                <a
                  href={`https://wa.me/55${digits}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:text-ink"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-ink-4" />
                  WhatsApp
                </a>
              </div>

              {!closed && (
                <button
                  onClick={() => setHold(kase.id, !kase.hold.active)}
                  title="Suspende cobrança, marketing e push automático enquanto o contato humano está aberto"
                  className="inline-flex items-center gap-2 text-[12px] font-medium text-ink-3 transition-colors hover:text-ink"
                >
                  {kase.hold.active ? (
                    <BellOff className="h-3.5 w-3.5 text-ink-2" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5 text-warn" />
                  )}
                  Freio Concorrente {kase.hold.active ? 'ativo' : 'desligado'}
                  {kase.hold.active && kase.hold.blockedCount > 0 && (
                    <span className="font-mono text-ink-4">
                      · {kase.hold.blockedCount} bloqueios
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'jornada' && <Timeline events={student.timeline} />}

        {tab === 'protocolo' && (
          <div className="space-y-5">
            <DataList
              columns={4}
              items={[
                { label: 'Abertura', value: stamp(kase.openedAt) },
                {
                  label: 'Primeiro contato',
                  value: kase.firstContactAt ? stamp(kase.firstContactAt) : '—',
                  tone: kase.firstContactAt ? 'plain' : 'crit',
                },
                { label: 'SLA definido', value: `${kase.slaHours} h úteis` },
                { label: 'Especialidade', value: kase.specialty },
                { label: 'Vencimento', value: stamp(kase.slaDueAt) },
                {
                  label: 'Reaberturas',
                  value: kase.reopenCount,
                  tone: kase.reopenCount > 0 ? 'crit' : 'plain',
                },
                { label: 'Encerramento', value: kase.closedAt ? stamp(kase.closedAt) : '—' },
                { label: 'Motivo', value: kase.closingReason ?? '—' },
              ]}
            />
            <Callout tone="info" title={`Diretriz do ${radar.label}`}>
              {radar.guidance}
            </Callout>
          </div>
        )}

        {tab === 'notas' && (
          <div className="space-y-4">
            {!closed && (
              <div className="space-y-2">
                <TextArea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Contexto para quem abrir este caso depois de você."
                />
                <div className="flex justify-end">
                  <Button
                    size="xs"
                    variant="primary"
                    disabled={note.trim().length < 3}
                    onClick={() => {
                      addCaseNote(kase.id, note.trim());
                      setNote('');
                    }}
                  >
                    Salvar observação
                  </Button>
                </div>
              </div>
            )}

            {kase.notes.length === 0 ? (
              <p className="text-[12px] text-ink-4">Nenhuma observação registrada.</p>
            ) : (
              <ul className="space-y-2.5">
                {[...kase.notes].reverse().map((n) => (
                  <li key={n.id} className="rounded-lg bg-surface-2 p-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12px] font-semibold text-ink">{n.author}</span>
                      <span className="shrink-0 font-mono text-[11px] text-ink-4">
                        {stamp(n.at)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">{n.text}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === 'historico' && (
          <ol className="space-y-2">
            {kase.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2.5 text-[12px]">
                <span className="font-mono text-[11px] text-ink-4">{stamp(h.at)}</span>
                {h.from && (
                  <>
                    <span className="text-ink-3">{h.from}</span>
                    <ArrowRight className="h-3 w-3 text-ink-4" />
                  </>
                )}
                <CaseStatusBadge status={h.to} />
                <span className="text-ink-4">por {h.by}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* ---- The four actions, plus the one that matters most ------------ */}
      <div className="shrink-0 bg-surface-2 p-4">
        {closed ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto flex items-center gap-1.5 text-[12.5px] text-ink-3">
              <CheckCircle2 className="h-3.5 w-3.5 text-ink-4" />
              Encerrado como <span className="font-semibold text-ink">{kase.status}</span>
              {kase.closingReason && ` · ${kase.closingReason}`}
            </span>
            <Button
              size="sm"
              variant="secondary"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => actions.onReopen(kase.id)}
            >
              Reabrir
            </Button>
            {/* "Ver dossiê" saiu daqui: o dossiê é este painel. O que ele
                mostrava a mais está nas abas Jornada e Histórico acima. */}
            <Button size="sm" variant="ghost" onClick={() => setTab('historico')}>
              Ver histórico completo
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={<Sparkles className="h-3.5 w-3.5" />}
              onClick={() => actions.onCopilot(student.id, kase.id)}
            >
              Copiloto
            </Button>

            {allowed.includes('Encaminhado') && (
              <Button
                size="sm"
                variant="ghost"
                icon={<Forward className="h-3.5 w-3.5" />}
                onClick={() => actions.onForward(kase.id)}
              >
                Encaminhar
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              icon={<CalendarClock className="h-3.5 w-3.5" />}
              onClick={() => actions.onFollowUp(student.id, kase.id)}
            >
              Follow-up
            </Button>

            <span className="ml-auto flex flex-wrap items-center gap-2">
              {allowed.includes('Cancelado') && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => actions.onClose(kase.id, 'descartar')}
                  title="Alerta improcedente — descarta o caso e alimenta a calibração do radar"
                >
                  Descartar
                </Button>
              )}

              {kase.status === 'Pendente' ? (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Hand className="h-3.5 w-3.5" />}
                  onClick={() => claimCase(kase.id)}
                >
                  Assumir e iniciar contato
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  onClick={() => actions.onRegister(kase.id)}
                >
                  {kase.status === 'Aguardando Retorno' ? 'Registrar retorno' : 'Registrar contato'}
                </Button>
              )}
            </span>
          </div>
        )}

        {!closed && !mine && owner && (
          <p className="mt-2.5 text-[11px] text-ink-4">
            Este caso é de {owner.name}. Assumir transfere a responsabilidade para você.
          </p>
        )}
        {!closed && kase.status === 'Em Contato' && (
          <div className="mt-2.5">
            <LinkButton
              onClick={() =>
                transitionCase(
                  kase.id,
                  'Aguardando Retorno',
                  'Contato realizado, aguardando decisão do aluno.',
                )
              }
              iconRight={<ArrowRight className="h-3.5 w-3.5" />}
            >
              Marcar como “Aguardando Retorno” sem registrar interação
            </LinkButton>
          </div>
        )}
      </div>
    </div>
  );
}
