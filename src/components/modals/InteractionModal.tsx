import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  Globe,
  Mail,
  MessageSquare,
  Phone,
  Save,
  Users,
} from 'lucide-react';
import type { Channel, InteractionKind, InteractionOutcome } from '../../types';
import { useApp } from '../../state/AppContext';
import { Modal } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { Field, Select, TextArea, TextInput } from '../ui/Fields';
import { Callout } from '../ui/Surfaces';
import { CaseStatusBadge } from '../ui/Badges';
import { statusFromOutcome } from '../../lib/caseFlow';
import { dateInputToIso, isoToDateInput } from '../../lib/format';

/* ==========================================================================
   Registro de interação
   --------------------------------------------------------------------------
   The minimum record from the operating plan is non-negotiable and is enforced
   by the form: Causa → Intervenção → Resultado → Próximo passo. Those four
   fields are what let the institution learn what actually happened after an
   intervention, so three of them are required and the fourth defaults to a
   routine follow-up rather than being left blank.

   The form also tells the attendant, before they save, exactly what saving
   will do: which status the case will move to, and whether a follow-up will be
   scheduled. No hidden side effects.
   ========================================================================== */

const CHANNELS: { value: Channel; label: string; Icon: typeof Phone }[] = [
  { value: 'WhatsApp', label: 'WhatsApp', Icon: MessageSquare },
  { value: 'Telefone', label: 'Telefone', Icon: Phone },
  { value: 'Presencial', label: 'Presencial', Icon: Users },
  { value: 'E-mail', label: 'E-mail', Icon: Mail },
  { value: 'Portal', label: 'Portal', Icon: Globe },
];

const KINDS: InteractionKind[] = [
  'Acolhimento',
  'Orientação Pedagógica',
  'Negociação Financeira',
  'Suporte AVA',
  'Retenção',
  'Follow-up',
];

const OUTCOMES: { value: InteractionOutcome; help: string }[] = [
  { value: 'Resolvido', help: 'Situação encerrada com acordo. O caso vinculado é fechado como retido.' },
  { value: 'Parcialmente resolvido', help: 'Avançou, mas depende de uma etapa seguinte.' },
  { value: 'Aguardando aluno', help: 'Contato feito, decisão está com o aluno.' },
  { value: 'Encaminhado', help: 'Precisa de outra especialidade ou da coordenação.' },
  { value: 'Sem contato', help: 'Tentativa registrada, aluno não respondeu.' },
  { value: 'Recusou atendimento', help: 'Aluno declinou. Registrar para não insistir em excesso.' },
];

export interface InteractionTarget {
  studentId: string;
  caseId?: string;
  /** Optional pre-fill coming from the copilot. */
  prefill?: { kind?: InteractionKind; channel?: Channel; intervention?: string };
}

export function InteractionModal({
  target,
  onClose,
}: {
  target: InteractionTarget | null;
  onClose: () => void;
}) {
  const { getStudent, getCase, logInteraction, closeCase, transitionCase } = useApp();
  const student = target ? getStudent(target.studentId) : undefined;
  const kase = target?.caseId ? getCase(target.caseId) : undefined;

  const [channel, setChannel] = useState<Channel>('WhatsApp');
  const [kind, setKind] = useState<InteractionKind>('Acolhimento');
  const [outcome, setOutcome] = useState<InteractionOutcome>('Parcialmente resolvido');
  const [cause, setCause] = useState('');
  const [intervention, setIntervention] = useState('');
  const [result, setResult] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [touched, setTouched] = useState(false);

  // Reset the form each time it opens on a new target, and honour any prefill
  // handed over by the copilot so the attendant does not retype the approach.
  useEffect(() => {
    if (!target) return;
    setChannel(target.prefill?.channel ?? 'WhatsApp');
    setKind(
      target.prefill?.kind ??
        (kase?.radar === 'financeiro'
          ? 'Negociação Financeira'
          : kase?.radar === 'academico'
            ? 'Orientação Pedagógica'
            : kase?.radar === 'engajamento'
              ? 'Suporte AVA'
              : kase?.radar === 'evasao'
                ? 'Retenção'
                : 'Acolhimento'),
    );
    setOutcome('Parcialmente resolvido');
    setCause('');
    setIntervention(target.prefill?.intervention ?? '');
    setResult('');
    setNextStep('');
    setNextDate(isoToDateInput(new Date(Date.now() + 3 * 86_400_000).toISOString()));
    setTouched(false);
  }, [target, kase?.radar]);

  const projectedStatus = useMemo(
    () => (kase ? statusFromOutcome(outcome, kase.status) : null),
    [kase, outcome],
  );

  const missing = {
    cause: cause.trim().length < 4,
    intervention: intervention.trim().length < 4,
    result: result.trim().length < 4,
  };
  const invalid = missing.cause || missing.intervention || missing.result;

  const submit = () => {
    if (!student || !target) return;
    setTouched(true);
    if (invalid) return;

    const effectiveNextStep = nextStep.trim() || 'Acompanhamento de rotina no próximo ciclo';
    const nextIso = nextDate ? dateInputToIso(nextDate) : undefined;

    logInteraction({
      studentId: student.id,
      caseId: target.caseId,
      channel,
      kind,
      outcome,
      cause: cause.trim(),
      intervention: intervention.trim(),
      result: result.trim(),
      nextStep: effectiveNextStep,
      nextStepDate: nextIso,
    });

    // The outcome the attendant chose *is* the case decision — applying it here
    // means they never have to remember a second action to keep the queue honest.
    if (kase && outcome === 'Resolvido') {
      closeCase(kase.id, 'Acordo Firmado', 'Acordo firmado no atendimento', result.trim());
    } else if (kase && projectedStatus) {
      transitionCase(kase.id, projectedStatus, `Registro de contato via ${channel}: ${result.trim()}`);
    }

    onClose();
  };

  return (
    <Modal
      open={Boolean(target && student)}
      onClose={onClose}
      size="lg"
      icon={<MessageSquare className="h-4.5 w-4.5" />}
      eyebrow="Registro mínimo · Causa → Intervenção → Resultado → Próximo passo"
      title="Registrar atendimento humanizado"
      subtitle={
        student ? (
          <>
            <span className="font-semibold text-ink">{student.name}</span> · RA {student.ra} ·{' '}
            {student.course}
            {kase && (
              <>
                {' '}
                · caso <span className="font-mono">{kase.protocol}</span>
              </>
            )}
          </>
        ) : undefined
      }
      footer={
        <>
          <span className="mr-auto text-[11.5px] text-ink-4">
            {invalid && touched
              ? 'Preencha causa, intervenção e resultado para salvar.'
              : 'O registro alimenta o histórico 360°, o Health Score e os indicadores.'}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={submit} icon={<Save className="h-3.5 w-3.5" />}>
            Salvar registro
          </Button>
        </>
      }
    >
      <div className="space-y-5 p-5">
        {/* Channel */}
        <div>
          <p className="mb-2 text-[12px] font-semibold text-ink">Canal utilizado</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {CHANNELS.map((c) => {
              const active = channel === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setChannel(c.value)}
                  className={[
                    'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-3 transition-colors',
                    active
                      ? 'border-brand bg-brand-soft text-brand-text'
                      : 'border-hairline bg-surface-2 text-ink-3 hover:border-ink-4 hover:text-ink',
                  ].join(' ')}
                >
                  <c.Icon className="h-4 w-4" />
                  <span className="text-[11.5px] font-semibold">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo de atendimento">
            {(id) => (
              <Select id={id} value={kind} onChange={(e) => setKind(e.target.value as InteractionKind)}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label="Resultado do contato"
            help={OUTCOMES.find((o) => o.value === outcome)?.help}
          >
            {(id) => (
              <Select
                id={id}
                value={outcome}
                onChange={(e) => setOutcome(e.target.value as InteractionOutcome)}
              >
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.value}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {/* The mandatory four */}
        <div className="space-y-4 rounded-lg border border-hairline bg-surface-2 p-4">
          <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-ink-4 uppercase">
            Registro mínimo obrigatório
          </p>

          <Field
            label="1. Causa identificada (na fala do aluno)"
            required
            error={touched && missing.cause ? 'Descreva a causa-raiz relatada pelo aluno.' : undefined}
          >
            {(id) => (
              <TextArea
                id={id}
                data-autofocus
                rows={2}
                value={cause}
                onChange={(e) => setCause(e.target.value)}
                placeholder="Ex.: assumiu turno fixo no trabalho em agosto e não consegue mais assistir às videoaulas à noite."
              />
            )}
          </Field>

          <Field
            label="2. Intervenção realizada"
            required
            error={
              touched && missing.intervention
                ? 'Descreva concretamente o que foi feito ou oferecido.'
                : undefined
            }
          >
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={intervention}
                onChange={(e) => setIntervention(e.target.value)}
                placeholder="Ex.: enviado cronograma do módulo, ativada monitoria e simulada repactuação em 10x sem juros."
              />
            )}
          </Field>

          <Field
            label="3. Resultado e acordo estabelecido"
            required
            error={touched && missing.result ? 'Registre o que ficou combinado com o aluno.' : undefined}
          >
            {(id) => (
              <TextArea
                id={id}
                rows={2}
                value={result}
                onChange={(e) => setResult(e.target.value)}
                placeholder="Ex.: aluno se compromete a entregar a atividade até sexta e aceitou a monitoria de terça."
              />
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-[1fr_170px]">
            <Field label="4. Próximo passo" help="Se ficar em branco, registramos acompanhamento de rotina.">
              {(id) => (
                <TextInput
                  id={id}
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder="Ex.: confirmar entrega da atividade e novo acesso ao AVA"
                />
              )}
            </Field>
            <Field label="Data do acompanhamento">
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                />
              )}
            </Field>
          </div>
        </div>

        {/* What saving will do — stated before it happens. */}
        <Callout tone={outcome === 'Resolvido' ? 'ok' : 'info'} icon={<ArrowRight className="h-3.5 w-3.5" />}>
          <ul className="space-y-1">
            <li>A interação entra na linha do tempo 360° e no histórico de contatos.</li>
            <li>O Health Score é recalculado com o novo histórico de relacionamento.</li>
            {kase && outcome === 'Resolvido' && (
              <li className="flex flex-wrap items-center gap-1.5">
                O caso <span className="font-mono font-semibold">{kase.protocol}</span> será encerrado
                como <CaseStatusBadge status="Acordo Firmado" solid /> e sai da fila de pendentes.
              </li>
            )}
            {kase && outcome !== 'Resolvido' && projectedStatus && (
              <li className="flex flex-wrap items-center gap-1.5">
                O caso permanece aberto, sugerindo o status <CaseStatusBadge status={projectedStatus} />.
              </li>
            )}
            {nextDate && (
              <li className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Um acompanhamento será agendado para a data informada.
              </li>
            )}
          </ul>
        </Callout>
      </div>
    </Modal>
  );
}
