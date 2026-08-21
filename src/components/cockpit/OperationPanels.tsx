import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Bot, Info, Timer } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { OUTCOMES, periodMeta } from '../../lib/cockpit';
import type { CockpitPeriod, Operations, AutomationSplit } from '../../lib/cockpit';
import { Card, CardHeader } from '../ui/Surfaces';
import { LinkButton } from '../ui/Button';
import { AnimatedNumber } from '../ui/Charts';
import { StackedColumns } from '../ui/Plot';
import type { StackBucket } from '../ui/Plot';
import { AUTOMATION_COLOR, SLA_COLOR, outcomeColor } from './palette';
import { emphasis } from '../../lib/motion';
import { decimal, int } from '../../lib/format';

/* ==========================================================================
   Quinta linha — a operação
   --------------------------------------------------------------------------
   Dois blocos que precisam concordar, e é por isso que leem a MESMA partição:
   "concluídas" no bloco de intervenções é literalmente a soma dos desfechos
   apurados no bloco de resultado. Se viessem de contas separadas, um painel
   diria 70 e o outro somaria 72, e a taxa de estabilização — que é a métrica
   que decide se a operação funciona — viraria discussão.

   E é a taxa, não o volume, que ganha o corpo maior. Duzentos atendimentos com
   40% de estabilização é uma equipe ocupada tratando o sintoma errado; oitenta
   com 71% é a operação fazendo o que existe para fazer.
   ========================================================================== */

/* -- Números lado a lado, divididos por fio ------------------------------- */

function Figure({
  label,
  value,
  tone = 'plain',
  hint,
}: {
  label: string;
  value: number;
  tone?: 'plain' | 'warn' | 'crit';
  hint?: string;
}) {
  const ink = tone === 'crit' ? 'text-crit-ink' : tone === 'warn' ? 'text-warn-ink' : 'text-ink';
  return (
    <div className="min-w-0 px-3 py-2 first:pl-0" title={hint}>
      <p className={`font-mono text-[19px] leading-none font-medium tracking-tight ${ink}`}>
        <AnimatedNumber value={value} resetOnChange />
      </p>
      <p className="mt-1.5 truncate text-[11.5px] font-medium text-ink-3">{label}</p>
    </div>
  );
}

/* -- Intervenções --------------------------------------------------------- */

export function InterventionsPanel({
  operations,
  period,
  onOpenQueue,
}: {
  operations: Operations;
  period: CockpitPeriod;
  onOpenQueue: () => void;
}) {
  const meta = periodMeta(period);

  const buckets: StackBucket[] = useMemo(
    () =>
      operations.buckets.map((bucket) => {
        const pending = Math.max(0, bucket.received - bucket.inSla - bucket.outSla);
        return {
          label: bucket.label,
          full: bucket.full,
          segments: [
            { key: 'inSla', label: 'Dentro do SLA', value: bucket.inSla, color: SLA_COLOR.inSla },
            { key: 'outSla', label: 'Fora do SLA', value: bucket.outSla, color: SLA_COLOR.outSla },
            { key: 'pending', label: 'Ainda pendente', value: pending, color: SLA_COLOR.pending },
          ],
        };
      }),
    [operations.buckets],
  );

  return (
    <Card>
      <CardHeader
        title="Intervenções"
        subtitle={`Contatos humanos abertos ${meta.inline}, com a aderência ao SLA em horas úteis.`}
        action={
          <LinkButton onClick={onOpenQueue} iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
            Abrir a fila
          </LinkButton>
        }
      />

      <div className="mt-4 flex flex-wrap divide-x divide-hairline">
        <Figure label="recebidas" value={operations.received} hint="Casos abertos na janela." />
        <Figure
          label="concluídas"
          value={operations.concluded}
          hint="Casos com desfecho apurado. É o denominador da taxa de estabilização."
        />
        <Figure
          label="pendentes"
          value={operations.pending}
          tone={operations.pending > 0 ? 'warn' : 'plain'}
          hint="Contato feito, próximo passo agendado, ainda sem desfecho."
        />
        <Figure label="dentro do SLA" value={operations.inSla} hint="Primeiro contato dentro do prazo." />
        <Figure
          label="fora do SLA"
          value={operations.outSla}
          tone={operations.outSla > 0 ? 'crit' : 'plain'}
          hint="Prazo estourado antes do primeiro contato."
        />
      </div>

      {operations.concluded > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-ink-3">
          <Timer className="h-3.5 w-3.5 shrink-0 text-ink-4" />
          Aderência ao SLA de{' '}
          <span className="font-mono font-medium text-ink">
            {decimal(operations.slaAdherence, 1)}%
          </span>{' '}
          sobre as concluídas.
        </p>
      )}

      <div className="mt-5 border-t border-hairline pt-4">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="text-[12px] font-medium text-ink-3">
            Evolução {operations.granularity} das intervenções
          </p>
          <div className="flex shrink-0 items-center gap-3">
            {[
              { label: 'dentro do SLA', color: SLA_COLOR.inSla },
              { label: 'fora do SLA', color: SLA_COLOR.outSla },
              { label: 'pendente', color: SLA_COLOR.pending },
            ].map((item) => (
              <span key={item.label} className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] text-ink-4">{item.label}</span>
              </span>
            ))}
          </div>
        </div>
        <StackedColumns buckets={buckets} height={156} totalLabel="Recebidas" />
      </div>
    </Card>
  );
}

/* -- Resultado das intervenções ------------------------------------------ */

export function OutcomePanel({
  operations,
  period,
}: {
  operations: Operations;
  period: CockpitPeriod;
}) {
  const { theme } = useApp();
  const dark = theme === 'dark';
  const meta = periodMeta(period);
  const { outcomes } = operations;

  const rows = OUTCOMES.map((outcome) => ({
    ...outcome,
    count: outcomes.counts[outcome.key],
    percent: outcomes.received > 0 ? (outcomes.counts[outcome.key] / outcomes.received) * 100 : 0,
    color: outcomeColor(outcome.key, dark),
  }));

  return (
    <Card>
      <CardHeader
        title="Resultado das intervenções"
        subtitle={`Desfecho dos ${int(outcomes.received)} contatos abertos ${meta.inline}.`}
      />

      {outcomes.received === 0 ? (
        <p className="py-14 text-center text-[12px] text-ink-4">
          Nenhuma intervenção na janela selecionada.
        </p>
      ) : (
        <>
          {/* A métrica que importa, com a conta à vista. Um número grande sem a
              sua fórmula é uma opinião com tipografia boa. */}
          <div className="mt-4 rounded-lg bg-surface-2 p-4">
            <p className="text-[12px] font-medium text-ink-3">Taxa de estabilização</p>
            <p className="mt-1.5 font-mono text-[38px] leading-none font-medium tracking-tight text-ink">
              <AnimatedNumber value={outcomes.rate} decimals={0} format={false} resetOnChange />
              <span className="text-[24px] text-ink-3">%</span>
            </p>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-3">
              <span className="font-mono font-medium text-ink">
                {int(outcomes.counts.estabilizado)}
              </span>{' '}
              estabilizados ÷{' '}
              <span className="font-mono font-medium text-ink">{int(outcomes.settled)}</span> com
              desfecho apurado. Os{' '}
              <span className="font-mono font-medium text-ink">
                {int(outcomes.counts.acompanhamento)}
              </span>{' '}
              em acompanhamento ficam fora da conta até fechar.
            </p>
          </div>

          <div className="mt-4 space-y-0.5">
            {rows.map((row, i) => (
              <div
                key={row.key}
                title={row.meaning}
                className="rounded-md px-2 py-2 transition-colors hover:bg-surface-2"
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="h-1.5 w-1.5 shrink-0 translate-y-[-2px] rounded-full"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-2">
                    {row.label}
                  </span>
                  {!row.settled && (
                    <span className="shrink-0 text-[10.5px] text-ink-4">sem desfecho</span>
                  )}
                  <span className="shrink-0 font-mono text-[13px] font-medium text-ink">
                    {int(row.count)}
                  </span>
                  <span className="w-10 shrink-0 text-right font-mono text-[11px] text-ink-4">
                    {decimal(row.percent, 0)}%
                  </span>
                </div>
                <div className="mt-1.5 ml-4 h-1.5 overflow-hidden rounded-full bg-track">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: row.color }}
                    initial={{ width: 0 }}
                    animate={{ width: decimal(row.percent, 2) + '%' }}
                    transition={{ duration: 0.7, ease: emphasis, delay: i * 0.05 }}
                  />
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 flex items-start gap-1.5 border-t border-hairline pt-3 text-[11.5px] leading-relaxed text-ink-4">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            Volume de atendimento não é resultado. Um caso só conta como
            estabilizado quando o sinal que o abriu deixa de aparecer nos ciclos seguintes.
          </p>
        </>
      )}
    </Card>
  );
}

/* -- Automação × intervenção humana -------------------------------------- */

export function AutomationPanel({
  automation,
  onOpenOnboarding,
}: {
  automation: AutomationSplit;
  onOpenOnboarding: () => void;
}) {
  const segments = [
    {
      key: 'auto',
      label: 'Automático concluído',
      value: automation.auto,
      percent: automation.autoPercent,
      color: AUTOMATION_COLOR.auto,
      note: 'A régua rodou até o fim sem nenhuma pessoa envolvida.',
    },
    {
      key: 'pending',
      label: 'Pendência na régua',
      value: automation.pending,
      percent: automation.pendingPercent,
      color: AUTOMATION_COLOR.pending,
      note: 'Pré-checagem falhou — contrato, documento, login. A automação reagenda.',
    },
    {
      key: 'human',
      label: 'Intervenção humana',
      value: automation.human,
      percent: automation.humanPercent,
      color: AUTOMATION_COLOR.human,
      note: 'Virou exceção e está com um especialista. É a atenção de calouro do funil.',
    },
  ];

  return (
    <Card>
      <CardHeader
        eyebrow={
          <>
            <Bot className="h-3.5 w-3.5" />
            Régua de pós-venda
          </>
        }
        title="Automação × intervenção humana"
        subtitle="Automatizar o normal, detectar o desvio, humanizar a exceção — medido."
        action={
          <LinkButton onClick={onOpenOnboarding} iconRight={<ArrowRight className="h-3.5 w-3.5" />}>
            Ver onboarding
          </LinkButton>
        }
      />

      {automation.freshmen === 0 ? (
        <p className="py-12 text-center text-[12px] text-ink-4">
          Nenhum ingressante no escopo selecionado. A régua de onboarding só existe dentro da janela
          de 90 dias.
        </p>
      ) : (
        <>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="font-mono text-[30px] leading-none font-medium tracking-tight text-ink">
              <AnimatedNumber value={automation.freshmen} resetOnChange />
            </span>
            <span className="text-[12.5px] text-ink-3">ingressantes na régua</span>
          </div>

          <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-track">
            {segments.map((segment, i) => (
              <motion.div
                key={segment.key}
                title={`${segment.label}: ${int(segment.value)} (${decimal(segment.percent, 1)}%)`}
                style={{ backgroundColor: segment.color }}
                initial={{ width: 0 }}
                animate={{ width: decimal(segment.percent, 2) + '%' }}
                transition={{ duration: 0.8, ease: emphasis, delay: i * 0.08 }}
              />
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {segments.map((segment) => (
              <div key={segment.key} className="flex items-start gap-2.5">
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-2">
                      {segment.label}
                    </span>
                    <span className="shrink-0 font-mono text-[13px] font-medium text-ink">
                      {int(segment.value)}
                    </span>
                    <span className="w-11 shrink-0 text-right font-mono text-[11px] text-ink-4">
                      {decimal(segment.percent, 1)}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-4">{segment.note}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 border-t border-hairline pt-3 text-[12.5px] leading-relaxed text-ink-2">
            <span className="font-mono font-medium text-ink">
              {decimal(100 - automation.humanPercent, 1)}%
            </span>{' '}
            da régua segue sem uma pessoa. Cada ponto que sai desta conta é uma ligação que a equipe
            não precisou fazer.
          </p>
        </>
      )}
    </Card>
  );
}
