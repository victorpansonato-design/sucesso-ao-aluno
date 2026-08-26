import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BellRing, RotateCcw } from 'lucide-react';
import type { ShellActions } from '../App';
import { useApp } from '../state/AppContext';
import { pageVariants } from '../lib/motion';
import { todayIso } from '../lib/calendarDates';
import { usePushStore } from '../lib/pushStore';
import { Metric, PageHeader, Tabs } from '../components/ui/Surfaces';
import { Button } from '../components/ui/Button';
import { StudentPushPanel } from '../components/push/StudentPushPanel';
import { CalendarBrowser } from '../components/push/CalendarBrowser';
import { TemplateCatalog } from '../components/push/TemplateCatalog';

/* ==========================================================================
   Gestão de PUSH
   --------------------------------------------------------------------------
   O aplicativo Grupo Anchieta é o canal que chega ao aluno sem depender de ele
   procurar nada. Esta aba é o lugar onde se decide o que passa por ele.

   Três abas, na ordem em que a informação nasce:

     Calendários  o que a instituição publica. É a fonte de tudo.
     Mensagens    o que disparamos por conta dos parâmetros do aluno.
     Alunos       o que chegou no celular de cada um.

   Alunos abria primeiro e estava errado: quem entra aqui pela primeira vez
   precisa ver a régua antes do histórico dela, senão o histórico é uma lista de
   textos sem origem.

   Cada aba tem uma faixa azul, e só uma, com o número que justifica a aba
   inteira. Os números do cabeçalho ficam sóbrios de propósito: duas coisas
   azuis na mesma tela não destacam nada.
   ========================================================================== */

type Tab = 'calendarios' | 'mensagens' | 'alunos';

export function PushView({
  actions,
  calendarParam,
}: {
  actions: ShellActions;
  /** Id de uma linha do site, para mandar a régua de um curso por link. */
  calendarParam?: string | null;
}) {
  const { students, toast } = useApp();
  const store = usePushStore();

  /* Calendários abre primeiro porque é a fonte: a régua nasce dele, e as
     mensagens e o histórico do aluno são o que ele produz. */
  const [tab, setTab] = useState<Tab>('calendarios');
  const [openCalendar, setOpenCalendar] = useState<string | null>(calendarParam ?? null);

  /* O hash é a verdade sobre qual calendário está aberto, e não o estado local:
     sem isto, o Voltar do navegador mudava a URL e a tela ficava onde estava —
     que é exatamente a mentira que o roteador por hash existe para evitar. */
  useEffect(() => {
    setOpenCalendar(calendarParam ?? null);
    if (calendarParam) setTab('calendarios');
  }, [calendarParam]);

  const today = todayIso();

  const totals = useMemo(() => {
    const rules = Object.values(store.rulesByCalendar).flat();
    const active = rules.filter((r) => r.enabled);
    return {
      calendars: store.calendars.length,
      lines: store.calendars.reduce((sum, c) => sum + c.events.length, 0),
      scheduled: active.filter((r) => r.sendDate >= today).length,
      sent: active.filter((r) => r.sendDate < today).length,
      templates: store.templates.filter((t) => t.active).length,
      divergences: store.calendars.reduce(
        (sum, c) => sum + c.events.filter((e) => e.note).length,
        0,
      ),
    };
  }, [store.calendars, store.rulesByCalendar, store.templates, today]);

  const edits = store.editedEvents.size + store.editedRules.size;

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      <PageHeader
        eyebrow={
          <>
            <BellRing className="h-3.5 w-3.5" />
            Notificações do App Grupo Anchieta · 2026/2
          </>
        }
        title="Gestão de PUSH"
        description="A régua de avisos que sai do calendário acadêmico de cada curso, as mensagens que seguem os parâmetros de cada aluno, e o histórico do que chegou em cada celular."
        actions={
          edits > 0 ? (
            <Button
              variant="ghost"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
              onClick={() => {
                store.resetAllPush();
                toast(
                  'info',
                  'Edições descartadas',
                  'Calendários, réguas e mensagens voltaram ao que está nos PDFs e no catálogo original.',
                );
              }}
            >
              Descartar {edits} {edits > 1 ? 'edições' : 'edição'}
            </Button>
          ) : undefined
        }
      >
        {/* Números sóbrios aqui em cima: a faixa azul de cada aba é que carrega
            o destaque, e duas coisas azuis na mesma tela não destacam nada. */}
        <div className="flex flex-wrap items-start gap-x-10 gap-y-4 border-t border-hairline pt-4">
          <Metric label="Avisos ainda por disparar" value={totals.scheduled} />
          <Metric label="Avisos já disparados" value={totals.sent} />
          <Metric label="Combinações curso e público" value={store.entries.length} />
          <Metric label="Linhas transcritas dos PDFs" value={totals.lines} />
          <Metric label="Mensagens personalizadas ativas" value={totals.templates} />
          {totals.divergences > 0 && (
            <Metric
              label="Divergências a validar no PDF"
              value={totals.divergences}
              onClick={() => {
                setTab('calendarios');
                setOpenCalendar(null);
              }}
            />
          )}
        </div>
      </PageHeader>

      <Tabs
        layoutId="push-tabs"
        value={tab}
        onChange={(value) => {
          setTab(value);
          if (value !== 'calendarios') setOpenCalendar(null);
        }}
        tabs={[
          { value: 'calendarios', label: 'Calendários', count: store.entries.length },
          { value: 'mensagens', label: 'Mensagens', count: store.templates.length },
          { value: 'alunos', label: 'Alunos', count: students.length },
        ]}
      />

      {tab === 'calendarios' && (
        <CalendarBrowser
          store={store}
          openId={openCalendar}
          onOpen={(id) => {
            setOpenCalendar(id);
            actions.goto('push', id);
          }}
        />
      )}
      {tab === 'mensagens' && <TemplateCatalog store={store} />}
      {tab === 'alunos' && <StudentPushPanel store={store} />}
    </motion.div>
  );
}
