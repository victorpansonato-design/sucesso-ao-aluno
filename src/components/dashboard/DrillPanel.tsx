import type { CockpitSnapshot } from '../../lib/cockpit';
import { OUTCOMES } from '../../lib/cockpit';
import type { PulseModel, SignalMovement } from '../../lib/pulse';
import type { DrillKey } from './PulsePhoneApp';
import { MetricSheet } from '../ui/MetricSheet';
import type { MetricSheetContent } from '../ui/MetricSheet';
import { outcomeColor } from '../cockpit/palette';
import { decimal, int, percent } from '../../lib/format';

/* ==========================================================================
   Detalhe de um indicador do Dashboard
   --------------------------------------------------------------------------
   Este arquivo é só o MONTADOR. A apresentação mora em `ui/MetricSheet`, que
   Indicadores também usa — as duas telas tinham o mesmo defeito de público
   (mandar a gestão para a Fila de Atendimento para entender um número) e
   merecem a mesma forma de aprofundamento, não duas parecidas.

   Todo montador aqui lê o MESMO snapshot que a página desenhou. É isso que
   torna impossível o detalhe discordar do cartão que o abriu — o defeito
   clássico de quem vai buscar o dado de novo, por outro caminho, com outro
   arredondamento.
   ========================================================================== */

export function DrillPanel({
  drill,
  snapshot,
  pulse,
  signals,
  onClose,
}: {
  drill: DrillKey | null;
  snapshot: CockpitSnapshot;
  pulse: PulseModel;
  signals: SignalMovement[];
  onClose: () => void;
}) {
  const content = drill ? buildDrill(drill, snapshot, pulse, signals) : null;
  return <MetricSheet content={content} onClose={onClose} />;
}

/* -- Os montadores ---------------------------------------------------------
   Um por indicador. Todos leem o MESMO snapshot que a página desenhou, então é
   impossível o detalhe discordar do cartão que o abriu — que é exatamente o
   defeito que aparece quando o aprofundamento vai buscar o dado de novo, por
   outro caminho, com outro arredondamento. */

function buildDrill(
  key: DrillKey,
  snapshot: CockpitSnapshot,
  pulse: PulseModel,
  signals: SignalMovement[],
): MetricSheetContent {
  const { cases, base, operations, bands } = snapshot;

  switch (key) {
    case 'alto-risco': {
      const total = Math.max(1, cases.highRisk);
      return {
        eyebrow: 'Casos de alto risco',
        title: 'Onde o alto risco está concentrado',
        value: int(cases.highRisk),
        denominator: (
          <>
            <span className="font-mono font-semibold text-ink tabular">{int(cases.highRisk)}</span>{' '}
            de <span className="font-mono font-semibold text-ink tabular">{int(cases.attention)}</span>{' '}
            casos em atenção humana —{' '}
            <span className="font-mono tabular">
              {percent((cases.highRisk / Math.max(1, cases.attention)) * 100, 1)}
            </span>
            . É um subconjunto de CASOS ABERTOS, e não a faixa de Health Score de mesmo nome, que
            classifica <span className="font-mono tabular">{int(base.bands[2] ?? 0)}</span> alunos
            sem caso aberto.
          </>
        ),
        rowsLabel: 'Distribuição por sinal de origem',
        rows: signals.map((s) => ({
          key: s.key,
          label: s.label,
          value: s.highRisk,
          percent: (s.highRisk / total) * 100,
          color: 'var(--crit)',
          meaning: s.description,
        })),
        reading: (
          <>
            Um sinal que concentra alto risco acima da sua participação no volume total é um sinal
            que a régua automática não está resolvendo. A comparação útil é entre esta lista e o
            ranking de variação na página: sinal que cresce E concentra risco é o que merece
            desenho novo, não mais gente.
          </>
        ),
      };
    }

    case 'atencao': {
      const total = Math.max(1, base.monitored);
      return {
        eyebrow: 'Casos em atenção humana',
        title: 'Quanto da base exige uma pessoa',
        value: int(cases.attention),
        denominator: (
          <>
            <span className="font-mono font-semibold text-ink tabular">{int(cases.attention)}</span>{' '}
            casos abertos ÷{' '}
            <span className="font-mono font-semibold text-ink tabular">{int(base.monitored)}</span>{' '}
            alunos monitorados —{' '}
            <span className="font-mono tabular">{percent((cases.attention / total) * 100, 2)}</span>{' '}
            da base. A maioria dos alunos monitorados nunca é acionada.
          </>
        ),
        rowsLabel: 'Faixas de Health Score na base',
        rows: bands.map((b) => ({
          key: b.status,
          label: `${b.label} (${b.range[0]}–${b.range[1]})`,
          value: b.count,
          percent: b.percent,
          color: b.hex(false),
        })),
        reading: (
          <>
            Faixa de score e caso aberto são medidas diferentes e a tela mantém as duas separadas
            de propósito. A faixa classifica TODA a base por probabilidade; o caso existe quando um
            desvio concreto apareceu e alguém ficou responsável. Um aluno pode estar em faixa
            crítica sem caso — e é justamente essa diferença que o funil da página mede.
          </>
        ),
      };
    }

    case 'retencao': {
      return {
        eyebrow: 'Retenção projetada',
        title: 'A projeção sobre a base do escopo',
        value: `${decimal(snapshot.retention, 1)}%`,
        denominator: (
          <>
            Projeção sobre{' '}
            <span className="font-mono font-semibold text-ink tabular">
              {int(base.monitored)}
            </span>{' '}
            alunos monitorados, ponderada pela distribuição de Health Score do escopo. É uma
            PROJEÇÃO, não uma apuração de matrícula — a apuração fecha no fim do ciclo.
          </>
        ),
        rowsLabel: 'Peso de cada faixa na projeção',
        rows: bands.map((b) => ({
          key: b.status,
          label: `${b.label} (${b.range[0]}–${b.range[1]})`,
          value: b.count,
          percent: b.percent,
          color: b.hex(false),
        })),
        reading: (
          <>
            A projeção sobe de duas maneiras, e elas não valem o mesmo: movendo alunos de faixa
            (trabalho de retenção) ou mudando a composição da base (perfil de ingresso). Quando a
            projeção melhora sem que as faixas se movam, o que mudou foi quem entrou — e isso é
            resultado de captação, não do Centro de Sucesso.
          </>
        ),
      };
    }

    case 'sla': {
      return {
        eyebrow: `Contato dentro do prazo · ${pulse.windowLabel.toLowerCase()}`,
        title: 'Do que a aderência é feita',
        value: `${decimal(operations.slaAdherence, 1)}%`,
        denominator: (
          <>
            <span className="font-mono font-semibold text-ink tabular">
              {int(operations.inSla)}
            </span>{' '}
            contatados no prazo ÷{' '}
            <span className="font-mono font-semibold text-ink tabular">
              {int(operations.concluded)}
            </span>{' '}
            casos com desfecho apurado. O prazo é contado em horas úteis e varia por radar,
            conforme Governança. Os <span className="font-mono tabular">{int(operations.pending)}</span>{' '}
            ainda em acompanhamento ficam fora do denominador — o prazo deles não venceu.
          </>
        ),
        rowsLabel: `Recebidos por ${operations.granularity === 'diária' ? 'dia' : 'semana'}`,
        rows: operations.buckets.slice(-8).map((b, i) => ({
          key: `${b.label}-${i}`,
          label: b.full,
          value: b.outSla,
          percent: (b.outSla / Math.max(1, b.received)) * 100,
          color: b.outSla > 0 ? 'var(--crit)' : 'var(--ink-4)',
          meaning: `${int(b.received)} recebidos · ${int(b.inSla)} no prazo`,
        })),
        reading: (
          <>
            A barra mostra a FRAÇÃO fora do prazo em cada balde, não o volume. Um dia com dois
            casos e um estouro aparece pior que um dia com quarenta e três estouros — e é assim
            que deve ser lido: aderência é uma taxa, e um pico isolado num balde pequeno não é uma
            crise de operação. O total{' '}
            <span className="font-mono tabular">{int(operations.outSla)}</span> no alto é o número
            que vale para a reunião.
          </>
        ),
      };
    }

    case 'intervencoes': {
      const o = operations.outcomes;
      const total = Math.max(1, o.received);
      return {
        eyebrow: `Intervenções · ${pulse.windowLabel.toLowerCase()}`,
        title: 'Volume não é resultado',
        value: int(operations.received),
        denominator: (
          <>
            <span className="font-mono font-semibold text-ink tabular">
              {int(operations.concluded)}
            </span>{' '}
            com desfecho apurado ·{' '}
            <span className="font-mono font-semibold text-ink tabular">
              {int(operations.pending)}
            </span>{' '}
            ainda em acompanhamento. Este total é esforço: ele mede quantos contatos a equipe
            abriu, e nada sobre o que aconteceu depois.
          </>
        ),
        rowsLabel: 'Desfecho de cada intervenção',
        rows: OUTCOMES.map((out) => ({
          key: out.key,
          label: out.label,
          value: o.counts[out.key],
          percent: (o.counts[out.key] / total) * 100,
          color: outcomeColor(out.key, false),
          meaning: out.meaning,
        })),
        reading: (
          <>
            Este é o indicador mais fácil de melhorar e o menos útil de comemorar: basta abrir mais
            casos. Ele existe como denominador e como medida de carga da equipe — não como
            resultado. A composição abaixo diz onde esse esforço foi parar.
          </>
        ),
      };
    }
  }
}
