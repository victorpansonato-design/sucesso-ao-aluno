import { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  Check,
  Copy,
  ExternalLink,
  Lightbulb,
  MessageSquare,
  Phone,
  Sparkles,
  Target,
  Users,
} from 'lucide-react';
import type { ApproachAngle, Channel } from '../../types';
import { useApp } from '../../state/AppContext';
import { Modal } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { Segmented } from '../ui/Fields';
import { Callout } from '../ui/Surfaces';
import { CohortBadge, HealthBadge } from '../ui/Badges';
import { generateApproaches, mailLink, scriptFor, telLink, whatsappLink } from '../../lib/copilot';
import type { InteractionTarget } from './InteractionModal';

/* ==========================================================================
   Copiloto de Abordagem
   --------------------------------------------------------------------------
   Prepares the contact rather than replacing it. Three genuinely different
   angles, ranked by how well each fits the student's actual signal mix, with
   the evidence and the "do not" list on screen — because the most expensive
   mistake in a retention call is opening with the wrong subject.

   The script is not a dead end: "Usar esta abordagem" carries the chosen angle
   straight into the interaction form, pre-filling the intervention field.
   ========================================================================== */

const ANGLE_ICON: Record<ApproachAngle, typeof Target> = {
  pedagogica: Lightbulb,
  financeira: Target,
  carreira: BadgeCheck,
};

export function CopilotModal({
  studentId,
  caseId,
  onClose,
  onUseApproach,
}: {
  studentId: string | null;
  caseId?: string;
  onClose: () => void;
  onUseApproach: (target: InteractionTarget) => void;
}) {
  const { getStudent, getCase, toast } = useApp();
  const student = studentId ? getStudent(studentId) : undefined;
  const kase = caseId ? getCase(caseId) : undefined;

  const [angle, setAngle] = useState<ApproachAngle | null>(null);
  const [channel, setChannel] = useState<Channel>('WhatsApp');
  const [copied, setCopied] = useState(false);

  const briefing = useMemo(
    () => (student ? generateApproaches(student, kase) : null),
    [student, kase],
  );

  const selected = useMemo(() => {
    if (!briefing) return null;
    return briefing.approaches.find((a) => a.angle === angle) ?? briefing.approaches[0];
  }, [briefing, angle]);

  const script = selected ? scriptFor(selected, channel) : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast('success', 'Roteiro copiado', 'Cole no canal escolhido e ajuste o que fizer sentido.');
    } catch {
      toast('warning', 'Não foi possível copiar', 'Selecione o texto manualmente para copiar.');
    }
  };

  const openChannel = () => {
    if (!student || !selected) return;
    const url =
      channel === 'Telefone'
        ? telLink(student.phone)
        : channel === 'E-mail'
          ? mailLink(student.email, 'Centro de Sucesso ao Aluno · UniAnchieta', script)
          : whatsappLink(student.phone, selected.whatsapp);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal
      open={Boolean(student && briefing)}
      onClose={onClose}
      size="xl"
      tone="band"
      icon={<Sparkles className="h-4.5 w-4.5" />}
      eyebrow="Copiloto de abordagem · apoio à decisão humana"
      title={briefing?.headline ?? 'Preparação de contato'}
      subtitle={briefing?.summary}
      footer={
        <>
          <span className="mr-auto text-[11.5px] text-ink-4">
            Roteiro gerado a partir dos sinais reais do aluno. Revise antes de enviar.
          </span>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          {student && selected && (
            <>
              <Button
                variant="secondary"
                onClick={openChannel}
                icon={<ExternalLink className="h-3.5 w-3.5" />}
              >
                Abrir {channel}
              </Button>
              <Button
                variant="primary"
                icon={<MessageSquare className="h-3.5 w-3.5" />}
                onClick={() => {
                  onUseApproach({
                    studentId: student.id,
                    caseId,
                    prefill: {
                      channel,
                      kind:
                        selected.angle === 'financeira'
                          ? 'Negociação Financeira'
                          : selected.angle === 'pedagogica'
                            ? 'Orientação Pedagógica'
                            : 'Retenção',
                      intervention: `Abordagem ${selected.label.toLowerCase()} via ${channel}: ${selected.objective}`,
                    },
                  });
                }}
              >
                Usar esta abordagem e registrar
              </Button>
            </>
          )}
        </>
      }
    >
      {student && briefing && selected && (
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_310px]">
          {/* ---- Left: the approaches -------------------------------------- */}
          <div className="min-w-0 space-y-4 p-5">
            <div>
              <p className="mb-2 text-[11px] font-medium text-ink-4">
                Três ângulos possíveis · ordenados por aderência aos dados
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {briefing.approaches.map((a) => {
                  const active = a.angle === selected.angle;
                  const Icon = ANGLE_ICON[a.angle];
                  return (
                    <button
                      key={a.angle}
                      onClick={() => setAngle(a.angle)}
                      className={[
                        'flex flex-col gap-2 rounded-lg p-3 text-left transition-colors',
                        active
                          ? 'bg-brand-soft'
                          : 'bg-surface-2',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <Icon
                          className={`h-4 w-4 shrink-0 ${active ? 'text-brand-text' : 'text-ink-4'}`}
                        />
                        <span
                          className={[
                            'font-mono text-[10.5px] font-semibold',
                            a.fit >= 70 ? 'text-ok-ink' : a.fit >= 45 ? 'text-warn-ink' : 'text-ink-4',
                          ].join(' ')}
                        >
                          {a.fit}%
                        </span>
                      </div>
                      <span
                        className={`text-[12px] leading-snug font-semibold ${active ? 'text-brand-text' : 'text-ink'}`}
                      >
                        {a.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 rounded-lg bg-surface-2 p-4">
              <div>
                <p className="text-[11px] font-medium text-ink-4">
                  Quando usar
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{selected.whenToUse}</p>
              </div>
              <div className="border-t border-hairline pt-3">
                <p className="text-[11px] font-medium text-ink-4">
                  Objetivo do contato
                </p>
                <p className="mt-1 text-[12px] leading-relaxed font-semibold text-ink">
                  {selected.objective}
                </p>
              </div>
            </div>

            {/* Script */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] font-medium text-ink-4">
                  Roteiro sugerido
                </p>
                <Segmented
                  layoutId="copilot-channel"
                  size="xs"
                  value={channel}
                  onChange={setChannel}
                  options={[
                    { value: 'WhatsApp', label: 'WhatsApp', icon: <MessageSquare className="h-3 w-3" /> },
                    { value: 'Telefone', label: 'Telefone', icon: <Phone className="h-3 w-3" /> },
                    { value: 'Presencial', label: 'Presencial', icon: <Users className="h-3 w-3" /> },
                  ]}
                />
              </div>

              <div className="rounded-lg bg-surface-2 p-4">
                <pre className="scroll-slim max-h-72 overflow-y-auto font-sans text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-2">
                  {script}
                </pre>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] text-ink-4">
                  Adaptado às diretrizes de acolhimento humanizado da UniAnchieta.
                </span>
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={copy}
                  icon={
                    copied ? (
                      <Check className="h-3.5 w-3.5 text-ok" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )
                  }
                >
                  {copied ? 'Copiado' : 'Copiar roteiro'}
                </Button>
              </div>
            </div>
          </div>

          {/* ---- Right: the dossier the attendant must hold in mind -------- */}
          <aside className="space-y-4 border-t border-hairline bg-surface-2 p-5 lg:border-t-0 lg:border-l">
            <div className="flex flex-wrap items-center gap-2">
              <HealthBadge status={student.status} solid />
              <CohortBadge cohort={student.cohort} days={student.journey.daysSinceEnrollment} />
            </div>

            <div>
              <p className="text-[11px] font-medium text-ink-4">
                Fatos na mesa
              </p>
              <ul className="mt-2 space-y-1.5">
                {selected.evidence.map((e) => (
                  <li key={e} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-4" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-hairline pt-4">
              <p className="text-[11px] font-medium text-ink-4">
                Hipóteses de causa-raiz
              </p>
              <ul className="mt-2 space-y-1.5">
                {briefing.rootCauseHypotheses.map((h) => (
                  <li key={h} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-2">
                    <Lightbulb className="mt-px h-3.5 w-3.5 shrink-0 text-warn" />
                    {h}
                  </li>
                ))}
              </ul>
            </div>

            <Callout tone="crit" icon={<Ban className="h-3.5 w-3.5" />} title="Não fazer">
              <ul className="space-y-1">
                {briefing.doNot.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </Callout>
          </aside>
        </div>
      )}
    </Modal>
  );
}
