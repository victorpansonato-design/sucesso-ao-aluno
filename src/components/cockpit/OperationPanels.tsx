import { useMemo } from 'react';
import { ArrowRight, Timer } from 'lucide-react';
import { periodMeta } from '../../lib/cockpit';
import type { CockpitPeriod, Operations } from '../../lib/cockpit';
import { Card, CardHeader } from '../ui/Surfaces';
import { LinkButton } from '../ui/Button';
import { AnimatedNumber } from '../ui/Charts';
import { StackedColumns } from '../ui/Plot';
import type { StackBucket } from '../ui/Plot';
import { SLA_COLOR } from './palette';
import { decimal } from '../../lib/format';

/* ==========================================================================
   A operação — volume e prazo
   --------------------------------------------------------------------------
   O que este arquivo mede é esforço e pontualidade: quantos contatos foram
   abertos na janela, quantos já têm desfecho apurado e quantos alcançaram o
   aluno dentro do prazo. Nada aqui afirma resultado.

   O arquivo tinha três painéis e perdeu dois:

     · `OutcomePanel` e `AutomationPanel` já não eram renderizados por tela
       nenhuma — a composição de desfechos vive em `dashboard/OutcomeComposition`
       e o bloco de automação saiu do produto.
     · O bloco de automação × humano saiu porque media uma régua que depende de
       data de matrícula, turma e presença no primeiro dia — dados que nenhum
       sistema da instituição entrega hoje. Um percentual de "resolvido sem
       humano" calculado sobre uma régua que ainda não roda é uma afirmação
       sobre o futuro apresentada como medição.
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
  actionLabel = 'Abrir a fila',
}: {
  operations: Operations;
  period: CockpitPeriod;
  onOpenQueue: () => void;
  /**
   * O rótulo da ação do cabeçalho.
   *
   * Ele é um parâmetro porque este painel serve a dois públicos com o mesmo
   * gráfico. No Cockpit a ação abre a Fila de Atendimento, e "Abrir a fila" é
   * literal. No Dashboard ela abre o detalhe dos desfechos na própria aba —
   * manter ali um botão escrito "Abrir a fila" seria um rótulo que mente sobre
   * o próprio destino, que é pior do que um rótulo genérico.
   */
  actionLabel?: string;
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
            {actionLabel}
          </LinkButton>
        }
      />

      <div className="mt-4 flex flex-wrap divide-x divide-hairline">
        <Figure label="recebidas" value={operations.received} hint="Casos abertos na janela." />
        <Figure
          label="concluídas"
          value={operations.concluded}
          hint="Casos com desfecho apurado. É o denominador da aderência ao prazo."
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
