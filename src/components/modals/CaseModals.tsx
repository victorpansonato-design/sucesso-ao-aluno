import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Forward,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import type { Priority, RadarKey } from '../../types';
import { useApp } from '../../state/AppContext';
import { Modal } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { Field, Select, TextArea, TextInput } from '../ui/Fields';
import { Callout } from '../ui/Surfaces';
import { Avatar, PriorityBadge, RadarBadge } from '../ui/Badges';
import { CLOSING_REASONS } from '../../lib/caseFlow';
import { RADARS, RADAR_ORDER, radarEvidence } from '../../lib/radars';
import { dateInputToIso, isoToDateInput, searchKey } from '../../lib/format';
import { MeterBar } from '../ui/Charts';

/* ==========================================================================
   Case lifecycle dialogs
   --------------------------------------------------------------------------
   Close, forward, reopen, open and schedule. Each one asks for exactly the
   information the operation needs to learn from the action and nothing more —
   a closing reason drawn from a fixed taxonomy (so the executive report can
   aggregate it), a forwarding reason (so the next specialist has context), a
   reopen reason (because a reopen means the first intervention did not hold).
   ========================================================================== */

/* -- Close ---------------------------------------------------------------- */

export function CloseCaseModal({
  caseId,
  mode,
  onClose,
}: {
  caseId: string | null;
  mode: 'retido' | 'perdido' | 'descartar';
  onClose: () => void;
}) {
  const { getCase, getStudent, closeCase } = useApp();
  const kase = caseId ? getCase(caseId) : undefined;
  const student = kase ? getStudent(kase.studentId) : undefined;

  const taxonomy =
    mode === 'descartar'
      ? ['Alerta improcedente — aluno já regularizado', 'Sinal duplicado de outro caso', 'Dado desatualizado na origem']
      : CLOSING_REASONS[mode === 'retido' ? 'retido' : 'perdido'];

  const [reason, setReason] = useState(taxonomy[0]);
  const [note, setNote] = useState('');

  useEffect(() => {
    setReason(taxonomy[0]);
    setNote('');
  }, [caseId, mode, taxonomy]);

  const target =
    mode === 'retido' ? 'Acordo Firmado' : mode === 'perdido' ? 'Evasão Inevitável' : 'Cancelado';

  const config = {
    retido: {
      icon: <CheckCircle2 className="h-4.5 w-4.5" />,
      title: 'Registrar acordo de permanência',
      eyebrow: 'Encerramento · aluno retido',
      subtitle: 'O aluno permanece. O motivo registrado alimenta o que funciona na retenção.',
      cta: 'Confirmar retenção',
      variant: 'primary' as const,
      callout: (
        <Callout tone="ok" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
          O caso sai da fila de pendentes, o Health Score do aluno recebe o efeito da intervenção e o
          Freio Concorrente é liberado — as réguas automáticas de jornada voltam a rodar.
        </Callout>
      ),
    },
    perdido: {
      icon: <AlertTriangle className="h-4.5 w-4.5" />,
      title: 'Registrar saída inevitável',
      eyebrow: 'Encerramento · aprendizado institucional',
      subtitle:
        'Nem todo caso é reversível. O motivo registrado aqui é o que ensina a instituição a evitar o próximo.',
      cta: 'Registrar saída',
      variant: 'danger' as const,
      callout: (
        <Callout tone="warn" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
          O motivo entra no relatório executivo de motivos de evasão por curso e campus, disponível em
          Indicadores. Este registro não é uma falha da equipe — é dado.
        </Callout>
      ),
    },
    descartar: {
      icon: <RotateCcw className="h-4.5 w-4.5" />,
      title: 'Descartar alerta',
      eyebrow: 'Calibração de radar',
      subtitle: 'Falso positivo ou situação já resolvida por outro caminho.',
      cta: 'Descartar caso',
      variant: 'secondary' as const,
      callout: (
        <Callout tone="info" icon={<ShieldCheck className="h-3.5 w-3.5" />}>
          Descartes contam como falsos positivos na precisão do radar. É exatamente esse número que
          justifica ajustar um gatilho em Governança.
        </Callout>
      ),
    },
  }[mode];

  return (
    <Modal
      open={Boolean(kase)}
      onClose={onClose}
      size="md"
      icon={config.icon}
      eyebrow={config.eyebrow}
      title={config.title}
      subtitle={
        kase && student ? (
          <>
            <span className="font-mono">{kase.protocol}</span> ·{' '}
            <span className="font-semibold text-ink">{student.name}</span> · {student.course}
          </>
        ) : (
          config.subtitle
        )
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={config.variant}
            onClick={() => {
              if (!kase) return;
              closeCase(kase.id, target, reason, note.trim());
              onClose();
            }}
          >
            {config.cta}
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <p className="text-[12.5px] leading-relaxed text-ink-3">{config.subtitle}</p>

        <Field label="Motivo registrado" required help="Taxonomia fixa — é o que permite agregar por curso e campus.">
          {(id) => (
            <Select id={id} value={reason} onChange={(e) => setReason(e.target.value)}>
              {taxonomy.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Observação do especialista" help="Contexto livre para quem ler este caso depois.">
          {(id) => (
            <TextArea
              id={id}
              data-autofocus
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === 'retido'
                  ? 'Ex.: aceitou parcelamento em 8x e retomou o AVA no mesmo dia.'
                  : mode === 'perdido'
                    ? 'Ex.: mudou de cidade por transferência no trabalho; orientado sobre retorno em 2027.'
                    : 'Ex.: atestado médico já protocolado na secretaria; ausências justificadas.'
              }
            />
          )}
        </Field>

        {config.callout}
      </div>
    </Modal>
  );
}

/* -- Forward -------------------------------------------------------------- */

export function ForwardCaseModal({
  caseId,
  onClose,
}: {
  caseId: string | null;
  onClose: () => void;
}) {
  const { getCase, getStudent, specialists, reassignCase, caseLoadOf, currentUser } = useApp();
  const kase = caseId ? getCase(caseId) : undefined;
  const student = kase ? getStudent(kase.studentId) : undefined;

  const candidates = useMemo(
    () => specialists.filter((s) => s.id !== currentUser.id),
    [specialists, currentUser.id],
  );

  const [targetId, setTargetId] = useState(candidates[0]?.id ?? '');
  const [reason, setReason] = useState('');

  useEffect(() => {
    // Suggest the specialist whose specialty actually matches the radar.
    if (!kase) return;
    const suggested = candidates.find((s) => s.specialty === RADARS[kase.radar].specialty);
    setTargetId(suggested?.id ?? candidates[0]?.id ?? '');
    setReason('');
  }, [caseId, kase, candidates]);

  return (
    <Modal
      open={Boolean(kase)}
      onClose={onClose}
      size="md"
      icon={<Forward className="h-4.5 w-4.5" />}
      eyebrow="Encaminhamento com contexto"
      title="Encaminhar caso para outro especialista"
      subtitle={
        kase && student ? (
          <>
            <span className="font-mono">{kase.protocol}</span> · {student.name} ·{' '}
            {RADARS[kase.radar].label}
          </>
        ) : undefined
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!targetId || reason.trim().length < 4}
            icon={<Send className="h-3.5 w-3.5" />}
            onClick={() => {
              if (!kase || !targetId) return;
              reassignCase(kase.id, targetId, reason.trim());
              onClose();
            }}
          >
            Confirmar encaminhamento
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <div>
          <p className="mb-2 text-[12px] font-semibold text-ink">Especialista destinatário</p>
          <div className="scroll-slim max-h-64 space-y-2 overflow-y-auto pr-1">
            {candidates.map((spec) => {
              const load = caseLoadOf(spec.id);
              const saturated = load >= spec.capacity * 0.85;
              const active = targetId === spec.id;
              const matches = kase ? spec.specialty === RADARS[kase.radar].specialty : false;

              return (
                <button
                  key={spec.id}
                  onClick={() => setTargetId(spec.id)}
                  className={[
                    'flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors',
                    active
                      ? 'border-brand bg-brand-soft'
                      : 'border-hairline bg-surface-2 hover:border-ink-4',
                  ].join(' ')}
                >
                  <Avatar initials={spec.initials} size="sm" tone={active ? 'brand' : 'neutral'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-[12.5px] font-bold text-ink">{spec.name}</span>
                      {matches && (
                        <span className="rounded border border-ok-border bg-ok-soft px-1.5 py-px font-mono text-[9.5px] font-bold text-ok-ink uppercase">
                          especialidade compatível
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-ink-3">{spec.role}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <MeterBar
                        value={load}
                        max={spec.capacity}
                        color={saturated ? 'var(--warn)' : 'var(--ok)'}
                        height={4}
                      />
                      <span className="shrink-0 font-mono text-[10.5px] font-bold text-ink-3">
                        {load}/{spec.capacity}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <Field
          label="Motivo do encaminhamento"
          required
          help="O próximo especialista abre o caso já sabendo por que chegou até ele."
        >
          {(id) => (
            <TextArea
              id={id}
              data-autofocus
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: aluno aceitou o plano de estudos, mas a pendência financeira precisa de repactuação autorizada."
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}

/* -- Reopen --------------------------------------------------------------- */

export function ReopenCaseModal({
  caseId,
  onClose,
}: {
  caseId: string | null;
  onClose: () => void;
}) {
  const { getCase, getStudent, reopenCase } = useApp();
  const kase = caseId ? getCase(caseId) : undefined;
  const student = kase ? getStudent(kase.studentId) : undefined;
  const [reason, setReason] = useState('');

  useEffect(() => setReason(''), [caseId]);

  return (
    <Modal
      open={Boolean(kase)}
      onClose={onClose}
      size="sm"
      icon={<RotateCcw className="h-4.5 w-4.5" />}
      eyebrow="Reabertura de caso"
      title="Reabrir caso encerrado"
      subtitle={kase && student ? `${kase.protocol} · ${student.name}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={reason.trim().length < 4}
            onClick={() => {
              if (!kase) return;
              reopenCase(kase.id, reason.trim());
              onClose();
            }}
          >
            Reabrir caso
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <Callout tone="warn" icon={<AlertTriangle className="h-3.5 w-3.5" />}>
          Reaberturas são contabilizadas nos indicadores da equipe: elas mostram onde a primeira
          intervenção não se sustentou, e é isso que aponta um playbook que precisa de ajuste.
        </Callout>

        <Field label="Por que o caso precisa voltar?" required>
          {(id) => (
            <TextArea
              id={id}
              data-autofocus
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: aluno não cumpriu o acordo financeiro e voltou a ficar sem acessar o AVA."
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}

/* -- Create --------------------------------------------------------------- */

export function CreateCaseModal({
  open,
  presetStudentId,
  onClose,
  onCreated,
}: {
  open: boolean;
  presetStudentId?: string;
  onClose: () => void;
  onCreated: (caseId: string) => void;
}) {
  const { students, createCase, currentUser, settings, getStudent } = useApp();

  const [query, setQuery] = useState('');
  const [studentId, setStudentId] = useState(presetStudentId ?? '');
  const [radar, setRadar] = useState<RadarKey>('academico');
  const [priority, setPriority] = useState<Priority>('Alto');
  const [title, setTitle] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [action, setAction] = useState('');
  const [assignToMe, setAssignToMe] = useState(true);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setStudentId(presetStudentId ?? '');
    setRadar('academico');
    setPriority('Alto');
    setTitle('');
    setDiagnosis('');
    setAction('');
    setAssignToMe(true);
  }, [open, presetStudentId]);

  const matches = useMemo(() => {
    if (!query.trim()) return students.slice(0, 6);
    const q = searchKey(query);
    return students
      .filter((s) => searchKey(s.name).includes(q) || s.ra.includes(query.trim()))
      .slice(0, 8);
  }, [query, students]);

  const student = studentId ? getStudent(studentId) : undefined;

  // Signals come from the radar's own detection code, so a manual case carries
  // the same evidence a detected one would.
  const detected = useMemo(
    () => (student ? radarEvidence(student, radar) : []),
    [student, radar],
  );

  const canSubmit = Boolean(studentId) && title.trim().length >= 6 && diagnosis.trim().length >= 10;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={<Plus className="h-4.5 w-4.5" />}
      eyebrow="Abertura manual · fila operacional"
      title="Abrir caso de acompanhamento"
      subtitle="Para quando a equipe identifica algo que o radar ainda não capturou."
      footer={
        <>
          <span className="mr-auto text-[11.5px] text-ink-4">
            SLA de {settings.slaHours[radar]} horas úteis conforme {RADARS[radar].label}.
          </span>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={() => {
              if (!canSubmit) return;
              const id = createCase({
                studentId,
                title: title.trim(),
                radar,
                priority,
                signals: detected,
                diagnosis: diagnosis.trim(),
                recommendedAction: action.trim() || RADARS[radar].guidance,
                assigneeId: assignToMe ? currentUser.id : null,
              });
              onCreated(id);
              onClose();
            }}
          >
            Abrir caso na fila
          </Button>
        </>
      }
    >
      <div className="space-y-5 p-5">
        {/* Student picker */}
        <Field label="Aluno" required>
          {(id) => (
            <div className="space-y-2">
              <TextInput
                id={id}
                data-autofocus
                value={student ? `${student.name} · RA ${student.ra}` : query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setStudentId('');
                }}
                placeholder="Buscar por nome ou RA…"
              />
              {!student && (
                <div className="scroll-slim max-h-44 divide-y divide-hairline overflow-y-auto rounded-lg border border-hairline">
                  {matches.length === 0 ? (
                    <p className="p-3 text-[12px] text-ink-4">Nenhum aluno encontrado.</p>
                  ) : (
                    matches.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => {
                          setStudentId(s.id);
                          setQuery('');
                        }}
                        className="flex w-full items-center gap-3 p-2.5 text-left transition-colors hover:bg-surface-hover"
                      >
                        <Avatar initials={s.initials} size="xs" tone={s.status} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-semibold text-ink">
                            {s.name}
                          </span>
                          <span className="block truncate text-[11px] text-ink-3">
                            RA {s.ra} · {s.course} · {s.modality}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-[11px] font-bold text-ink-3">
                          {s.healthScore}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Radar de origem" help={RADARS[radar].purpose}>
            {(id) => (
              <Select id={id} value={radar} onChange={(e) => setRadar(e.target.value as RadarKey)}>
                {RADAR_ORDER.map((key) => (
                  <option key={key} value={key}>
                    {RADARS[key].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Prioridade" help={`Define o SLA: ${settings.slaHours[radar]} h úteis.`}>
            {(id) => (
              <Select id={id} value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                {(['Crítico', 'Alto', 'Médio', 'Baixo'] as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Título do caso" required>
          {(id) => (
            <TextInput
              id={id}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: aluno relatou dificuldade de conciliar estágio com aulas noturnas"
            />
          )}
        </Field>

        <Field
          label="Diagnóstico"
          required
          help="Por que este caso existe e o que a equipe precisa entender antes de ligar."
        >
          {(id) => (
            <TextArea
              id={id}
              rows={3}
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="Descreva a leitura da situação, não apenas os sintomas."
            />
          )}
        </Field>

        <Field label="Ação recomendada" help={`Se vazio, usamos a diretriz do ${RADARS[radar].label}.`}>
          {(id) => (
            <TextArea
              id={id}
              rows={2}
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder={RADARS[radar].guidance}
            />
          )}
        </Field>

        {/* Evidence pulled from the radar itself */}
        {student && (
          <div className="rounded-lg border border-hairline bg-surface-2 p-4">
            <div className="mb-2 flex items-center gap-2">
              <RadarBadge radar={radar} full />
              <PriorityBadge priority={priority} />
            </div>
            {detected.length > 0 ? (
              <>
                <p className="font-mono text-[10px] font-bold tracking-[0.1em] text-ink-4 uppercase">
                  Sinais que o radar já detecta para este aluno
                </p>
                <ul className="mt-2 space-y-1.5">
                  {detected.map((s) => (
                    <li key={s} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-crit" />
                      {s}
                    </li>
                  ))}
                </ul>
                <p className="mt-2.5 text-[11px] text-ink-4">
                  Estes sinais serão anexados ao caso automaticamente.
                </p>
              </>
            ) : (
              <p className="text-[11.5px] leading-relaxed text-ink-3">
                O {RADARS[radar].label} não encontra sinais ativos para {student.name.split(' ')[0]}{' '}
                neste momento. O caso será aberto como acompanhamento proativo, com "Abertura manual
                pela equipe" como sinal registrado.
              </p>
            )}
          </div>
        )}

        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline bg-surface-2 p-3">
          <input
            type="checkbox"
            checked={assignToMe}
            onChange={(e) => setAssignToMe(e.target.checked)}
            className="h-4 w-4 accent-[var(--brand)]"
          />
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
            <UserRound className="h-3.5 w-3.5 text-ink-4" />
            Assumir o caso agora
          </span>
          <span className="text-[11.5px] text-ink-4">
            {assignToMe
              ? 'Entra direto como "Em Contato" na sua fila.'
              : 'Fica como "Pendente" sem responsável.'}
          </span>
        </label>
      </div>
    </Modal>
  );
}

/* -- Schedule follow-up --------------------------------------------------- */

export function FollowUpModal({
  target,
  onClose,
}: {
  target: { studentId: string; caseId?: string } | null;
  onClose: () => void;
}) {
  const { getStudent, scheduleFollowUp } = useApp();
  const student = target ? getStudent(target.studentId) : undefined;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    setTitle('');
    setNotes('');
    setDate(isoToDateInput(new Date(Date.now() + 7 * 86_400_000).toISOString()));
  }, [target]);

  return (
    <Modal
      open={Boolean(student)}
      onClose={onClose}
      size="sm"
      icon={<CalendarClock className="h-4.5 w-4.5" />}
      eyebrow="Follow-up"
      title="Agendar acompanhamento"
      subtitle={student ? `${student.name} · RA ${student.ra}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={title.trim().length < 4 || !date}
            onClick={() => {
              if (!target) return;
              scheduleFollowUp({
                studentId: target.studentId,
                caseId: target.caseId,
                title: title.trim(),
                dueDate: dateInputToIso(date),
                notes: notes.trim(),
              });
              onClose();
            }}
          >
            Agendar
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        <Field label="O que precisa ser verificado" required>
          {(id) => (
            <TextInput
              id={id}
              data-autofocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: confirmar novo acesso ao AVA e entrega da atividade"
            />
          )}
        </Field>

        <Field label="Data" required>
          {(id) => (
            <TextInput id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          )}
        </Field>

        <Field label="Observações">
          {(id) => (
            <TextArea
              id={id}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto para quem for executar o acompanhamento."
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
