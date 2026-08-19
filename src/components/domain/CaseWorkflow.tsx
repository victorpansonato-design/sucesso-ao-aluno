import { useState } from 'react';
import {
  ArrowRight,
  BellOff,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Forward,
  Hand,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  XCircle,
} from 'lucide-react';
import type { Case } from '../../types';
import { useApp } from '../../state/AppContext';
import { Button, LinkButton } from '../ui/Button';
import { Callout, DataList, SectionLabel } from '../ui/Surfaces';
import { Avatar, CaseStatusBadge, CohortBadge, ModalityBadge, PriorityBadge, RadarBadge } from '../ui/Badges';
import { TextArea } from '../ui/Fields';
import { SlaBanner } from './SlaPill';
import { RADARS } from '../../lib/radars';
import { isTerminal, nextStatuses } from '../../lib/caseFlow';
import { stamp } from '../../lib/format';

/* ==========================================================================
   Case workflow panel
   --------------------------------------------------------------------------
   Everything the attendant needs to run one case, in the order the operating
   plan prescribes: identificação → priorização → preparação → intervenção →
   registro → follow-up → encerramento.

   Two rules govern the action row:
     · Only transitions the state machine permits are rendered. There is no
       button here that can fail or surprise.
     · The primary action changes with the case state. A pending case wants to
       be claimed; a case in contact wants its outcome recorded. The button
       that matters most is always the filled one.
   ========================================================================== */

export interface CaseActions {
  onRegister: (caseId: string) => void;
  onCopilot: (studentId: string, caseId: string) => void;
  onForward: (caseId: string) => void;
  onClose: (caseId: string, mode: 'retido' | 'perdido' | 'descartar') => void;
  onReopen: (caseId: string) => void;
  onFollowUp: (studentId: string, caseId: string) => void;
  onOpenStudent: (studentId: string) => void;
}

export function CaseWorkflow({ kase, actions }: { kase: Case; actions: CaseActions }) {
  const { getStudent, getSpecialist, claimCase, setHold, addCaseNote, currentUser, transitionCase } =
    useApp();
  const student = getStudent(kase.studentId);
  const owner = getSpecialist(kase.assigneeId);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);

  if (!student) return null;

  const radar = RADARS[kase.radar];
  const mine = kase.assigneeId === currentUser.id;
  const closed = isTerminal(kase.status);
  const allowed = nextStatuses(kase.status);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* ---- Band header: the one place the royal blue takes over --------- */}
      <div className="band-surface band-grid relative shrink-0 border-b border-band-line p-5">
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] font-bold tracking-[0.06em] text-band-ink-2">
                {kase.protocol}
              </span>
              <PriorityBadge priority={kase.priority} />
              <CaseStatusBadge status={kase.status} />
            </div>

            <h2 className="mt-2 max-w-2xl text-[17px] leading-snug font-bold text-band-ink">
              {kase.title}
            </h2>

            <button
              onClick={() => actions.onOpenStudent(student.id)}
              className="group mt-3 flex items-center gap-2.5 text-left"
            >
              <Avatar initials={student.initials} size="sm" />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[13px] font-bold text-band-ink group-hover:underline">
                    {student.name}
                  </span>
                  <ExternalLink className="h-3 w-3 shrink-0 text-band-ink-2" />
                </span>
                <span className="mt-0.5 block truncate font-mono text-[11px] text-band-ink-2">
                  RA {student.ra} · {student.course} · {student.period}º período
                </span>
              </span>
            </button>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <SlaBanner kase={kase} onBand />
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <RadarBadge radar={kase.radar} full />
              <ModalityBadge modality={student.modality} />
              <CohortBadge cohort={student.cohort} days={student.journey.daysSinceEnrollment} />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-band-ink-2">
              <UserRound className="h-3 w-3" />
              {owner ? (
                <span>
                  {owner.name}
                  {mine && <span className="ml-1 font-bold text-band-ink">· você</span>}
                </span>
              ) : (
                <span className="font-bold text-band-ink">Sem responsável</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Scrollable body -------------------------------------------- */}
      <div className="scroll-slim min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {!owner && (
          <Callout tone="crit" icon={<Hand className="h-3.5 w-3.5" />} title="Caso sem dono">
            Nenhum especialista assumiu este caso. Enquanto isso, o SLA continua correndo e o aluno não
            está sendo contatado.
          </Callout>
        )}

        {/* Signals — the evidence, never "o sistema disse" */}
        <section>
          <SectionLabel>Sinais detectados</SectionLabel>
          <ul className="mt-3 space-y-2">
            {kase.signals.map((signal) => (
              <li key={signal} className="flex gap-2.5">
                <span
                  className={[
                    'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                    kase.priority === 'Crítico' ? 'bg-crit' : 'bg-warn',
                  ].join(' ')}
                />
                <span className="text-[12.5px] leading-relaxed text-ink-2">{signal}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Diagnosis + recommendation */}
        <section className="space-y-3 rounded-lg border border-hairline bg-surface-2 p-4">
          <div>
            <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-ink-4 uppercase">
              Leitura do caso
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{kase.diagnosis}</p>
          </div>
          <div className="border-t border-hairline pt-3">
            <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-ink-4 uppercase">
              Ação recomendada
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed font-semibold text-ink">
              {kase.recommendedAction}
            </p>
          </div>
        </section>

        {/* Freio Concorrente — a real mechanism, not a badge */}
        <section
          className={[
            'rounded-lg border p-4',
            kase.hold.active ? 'border-ok-border bg-ok-soft' : 'border-hairline bg-surface-2',
          ].join(' ')}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
                {kase.hold.active ? (
                  <BellOff className="h-3.5 w-3.5 text-ok" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5 text-ink-4" />
                )}
                Freio Concorrente
                <span
                  className={[
                    'rounded px-1.5 py-px font-mono text-[9.5px] font-bold uppercase',
                    kase.hold.active ? 'bg-ok text-white' : 'bg-surface-3 text-ink-3',
                  ].join(' ')}
                >
                  {kase.hold.active ? 'ativo' : 'desligado'}
                </span>
              </p>
              <p className="mt-1 max-w-lg text-[11.5px] leading-relaxed text-ink-3">
                {kase.hold.active
                  ? `Ativado por ${kase.hold.activatedBy || 'sistema'}. O aluno não recebe cobrança, marketing ou push automático enquanto o contato humano estiver aberto.`
                  : 'Réguas automáticas rodando normalmente. Ative antes do contato para evitar mensagens conflitantes.'}
              </p>
            </div>
            {!closed && (
              <Button
                size="xs"
                variant={kase.hold.active ? 'ghost' : 'secondary'}
                onClick={() => setHold(kase.id, !kase.hold.active)}
              >
                {kase.hold.active ? 'Desativar' : 'Ativar freio'}
              </Button>
            )}
          </div>

          {kase.hold.active && kase.hold.suppressed.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-ok-border pt-3">
              {kase.hold.suppressed.map((rule) => (
                <span
                  key={rule}
                  className="inline-flex items-center gap-1 rounded border border-ok-border bg-surface px-1.5 py-px font-mono text-[9.5px] font-bold text-ok-ink"
                >
                  <XCircle className="h-2.5 w-2.5" />
                  {rule}
                </span>
              ))}
              {kase.hold.blockedCount > 0 && (
                <span className="ml-auto font-mono text-[10.5px] font-bold text-ok-ink">
                  {kase.hold.blockedCount} disparos bloqueados
                </span>
              )}
            </div>
          )}
        </section>

        {/* Case facts */}
        <section>
          <SectionLabel>Dados do protocolo</SectionLabel>
          <DataList
            className="mt-3"
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
        </section>

        {/* Notes */}
        <section>
          <SectionLabel
            action={
              !closed && (
                <LinkButton onClick={() => setNoteOpen((v) => !v)}>
                  {noteOpen ? 'Cancelar' : 'Adicionar observação'}
                </LinkButton>
              )
            }
          >
            Observações da equipe ({kase.notes.length})
          </SectionLabel>

          {noteOpen && (
            <div className="mt-3 space-y-2">
              <TextArea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Contexto para quem abrir este caso depois de você."
              />
              <div className="flex justify-end gap-2">
                <Button size="xs" variant="ghost" onClick={() => setNoteOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  size="xs"
                  variant="primary"
                  disabled={note.trim().length < 3}
                  onClick={() => {
                    addCaseNote(kase.id, note.trim());
                    setNote('');
                    setNoteOpen(false);
                  }}
                >
                  Salvar observação
                </Button>
              </div>
            </div>
          )}

          {kase.notes.length === 0 ? (
            <p className="mt-3 text-[12px] text-ink-4">Nenhuma observação registrada.</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {[...kase.notes].reverse().map((n) => (
                <li key={n.id} className="rounded-lg border border-hairline bg-surface-2 p-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[11.5px] font-bold text-ink">{n.author}</span>
                    <span className="shrink-0 font-mono text-[10.5px] text-ink-4">{stamp(n.at)}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{n.text}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Status history */}
        <section>
          <SectionLabel>Histórico de status</SectionLabel>
          <ol className="mt-3 space-y-1.5">
            {kase.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2 text-[11.5px]">
                <span className="font-mono text-[10.5px] text-ink-4">{stamp(h.at)}</span>
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
        </section>

        {/* Radar guidance */}
        <Callout tone="info" title={`Diretriz do ${radar.label}`}>
          {radar.guidance}
        </Callout>
      </div>

      {/* ---- Action bar: only legal transitions -------------------------- */}
      <div className="shrink-0 border-t border-hairline bg-surface-2 p-4">
        {closed ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-auto flex items-center gap-1.5 text-[12px] text-ink-3">
              <CheckCircle2 className="h-3.5 w-3.5 text-ink-4" />
              Caso encerrado como <span className="font-semibold text-ink">{kase.status}</span>
              {kase.closingReason && ` · ${kase.closingReason}`}
            </span>
            <Button
              size="sm"
              variant="secondary"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => actions.onReopen(kase.id)}
            >
              Reabrir caso
            </Button>
            <Button
              size="sm"
              variant="ghost"
              icon={<UserRound className="h-3.5 w-3.5" />}
              onClick={() => actions.onOpenStudent(student.id)}
            >
              Ver dossiê
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {/* Preparation & secondary actions */}
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

            <span className="ml-auto flex flex-wrap items-center gap-2">
              {allowed.includes('Evasão Inevitável') && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => actions.onClose(kase.id, 'perdido')}
                >
                  Saída inevitável
                </Button>
              )}

              {allowed.includes('Acordo Firmado') && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<CheckCircle2 className="h-3.5 w-3.5 text-ok" />}
                  onClick={() => actions.onClose(kase.id, 'retido')}
                >
                  Acordo firmado
                </Button>
              )}

              {/* The primary action follows the case state. */}
              {kase.status === 'Pendente' ? (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<Hand className="h-3.5 w-3.5" />}
                  onClick={() => claimCase(kase.id)}
                >
                  Assumir e iniciar contato
                </Button>
              ) : kase.status === 'Aguardando Retorno' ? (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  onClick={() => actions.onRegister(kase.id)}
                >
                  Registrar retorno
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  icon={<MessageSquare className="h-3.5 w-3.5" />}
                  onClick={() => actions.onRegister(kase.id)}
                >
                  Registrar contato
                </Button>
              )}
            </span>
          </div>
        )}

        {/* Explicit hint about what the state machine allows next. */}
        {!closed && !mine && owner && (
          <p className="mt-2.5 text-[11px] text-ink-4">
            Este caso é de {owner.name}. Assumir transfere a responsabilidade para você.
          </p>
        )}
        {!closed && kase.status === 'Em Contato' && (
          <button
            onClick={() => transitionCase(kase.id, 'Aguardando Retorno', 'Contato realizado, aguardando decisão do aluno.')}
            className="mt-2.5 text-[11px] font-semibold text-brand-text hover:text-brand-2"
          >
            Marcar como “Aguardando Retorno” sem registrar interação →
          </button>
        )}
      </div>
    </div>
  );
}
