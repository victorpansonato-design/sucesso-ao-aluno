import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { BellOff, BellRing, Filter, Timer, Users } from 'lucide-react';
import type { PushCategory, PushTemplate } from '../../types';
import { useApp } from '../../state/AppContext';
import { matchesTemplate } from '../../lib/push';
import { PUSH_TEMPLATES } from '../../data/pushCatalog';
import type { PushStore } from '../../lib/pushStore';
import { staggerContainer, staggerItem } from '../../lib/motion';
import { Card, Callout, SectionLabel } from '../ui/Surfaces';
import { Chip } from '../ui/Fields';
import { BrandBand, CategoryIcon, EditedMark, NotificationPreview, PencilButton } from './PushBits';
import { TemplateEditor } from './PushEditors';

/* ==========================================================================
   Catálogo de mensagens personalizadas
   --------------------------------------------------------------------------
   A régua do calendário é igual para a turma inteira. Estas são o contrário:
   cada uma tem uma condição, e a condição decide quem recebe.

   Cada cartão mostra quantos alunos da base batem na condição AGORA. É o único
   número que impede o catálogo de virar ficção: uma mensagem que alcança zero
   aluno em agosto ou está com a condição errada, ou não deveria existir — e
   uma que alcança a base inteira quase certamente é genérica demais para ser
   chamada de personalizada.
   ========================================================================== */

const GROUPS: { key: string; label: string; categories: PushCategory[] }[] = [
  { key: 'acolhimento', label: 'Acolhimento e chegada', categories: ['acolhimento'] },
  { key: 'engajamento', label: 'Engajamento e vida acadêmica', categories: ['engajamento'] },
  { key: 'prazo', label: 'Prazos e avaliações', categories: ['prazo', 'prova'] },
  { key: 'financeiro', label: 'Financeiro', categories: ['financeiro'] },
];

export function TemplateCatalog({ store }: { store: PushStore }) {
  const { students } = useApp();
  const [editing, setEditing] = useState<PushTemplate | null>(null);
  const [onlyActive, setOnlyActive] = useState(false);

  /** Alcance atual de cada mensagem sobre a base carregada. */
  const reach = useMemo(() => {
    const map: Record<string, number> = {};
    store.templates.forEach((t) => {
      map[t.id] = students.filter((s) => matchesTemplate({ ...t, active: true }, s)).length;
    });
    return map;
  }, [store.templates, students]);

  const visible = onlyActive ? store.templates.filter((t) => t.active) : store.templates;
  const activeCount = store.templates.filter((t) => t.active).length;

  /* Quantos alunos da base estão, agora, dentro de pelo menos uma condição.
     É o que separa um catálogo vivo de uma lista de boas intenções. */
  const reached = useMemo(
    () => students.filter((s) => store.templates.some((t) => matchesTemplate(t, s))).length,
    [students, store.templates],
  );

  return (
    <>
      <div className="space-y-4">
        <BrandBand
          value={reached}
          unit={`de ${students.length}`}
          headline="alunos da base batem agora na condição de pelo menos uma mensagem"
          stats={[
            { label: 'mensagens ativas', value: activeCount },
            { label: 'no catálogo', value: store.templates.length },
            {
              label: 'sem alcance hoje',
              value: store.templates.filter((t) => (reach[t.id] ?? 0) === 0).length,
            },
          ]}
        />

        <Card>
          <SectionLabel
            action={
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-ink-4">
                  {activeCount} de {store.templates.length} ativas
                </span>
                <Chip active={onlyActive} onClick={() => setOnlyActive((v) => !v)}>
                  Só ativas
                </Chip>
              </div>
            }
          >
            Mensagens personalizadas
          </SectionLabel>
          <div className="mt-3">
            <Callout tone="info" icon={<Filter className="h-3.5 w-3.5" />}>
              Estas mensagens não seguem data: seguem o aluno. A condição de cada uma é avaliada
              contra Health Score, acesso ao AVA, frequência, notas, situação financeira e etapa da
              jornada. O intervalo mínimo evita que a mesma mensagem saia todo dia enquanto a
              condição continuar verdadeira.
            </Callout>
          </div>
        </Card>

        {GROUPS.map((group) => {
          const items = visible.filter((t) => group.categories.includes(t.category));
          if (items.length === 0) return null;
          return (
            <section key={group.key}>
              <div className="mb-3 flex items-baseline gap-2 border-b border-hairline pb-2">
                <h3 className="text-[12px] font-semibold text-ink-3">{group.label}</h3>
                <span className="font-mono text-[11px] text-ink-4">{items.length}</span>
              </div>

              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="grid gap-3 lg:grid-cols-2"
              >
                {items.map((template) => (
                  <motion.article
                    key={template.id}
                    variants={staggerItem}
                    className="group flex flex-col rounded-xl bg-surface p-4"
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-3">
                        <CategoryIcon category={template.category} className="h-3.5 w-3.5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="font-mono text-[11px] font-medium text-ink-3">
                            {template.code}
                          </span>
                          <h4 className="text-[13px] leading-snug font-semibold text-ink">
                            {template.name}
                          </h4>
                          {isEdited(template) && <EditedMark />}
                        </div>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-3">
                          {template.trigger}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          onClick={() => store.toggleTemplate(template.id, !template.active)}
                          title={template.active ? 'Desativar' : 'Ativar'}
                          aria-label={template.active ? 'Desativar' : 'Ativar'}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-3 hover:text-ink"
                        >
                          {template.active ? (
                            <BellRing className="h-3.5 w-3.5" />
                          ) : (
                            <BellOff className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <PencilButton
                          label="Editar mensagem"
                          onClick={() => setEditing(template)}
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <NotificationPreview
                        title={template.title}
                        body={template.body}
                        muted={!template.active}
                      />
                    </div>

                    <div className="mt-3 flex items-center gap-4 border-t border-hairline pt-2.5 text-[11px] text-ink-3">
                      {/* O alcance é o único número do cartão que muda com a
                          base — e o que diz se a condição está certa. */}
                      <span
                        className={[
                          'inline-flex items-center gap-1.5 font-medium',
                          (reach[template.id] ?? 0) > 0 ? 'text-brand-text' : 'text-ink-4',
                        ].join(' ')}
                      >
                        <Users className="h-3 w-3" />
                        {reach[template.id] ?? 0} na amostra
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Timer className="h-3 w-3 text-ink-4" />
                        repete após {template.cooldownDays} dias
                      </span>
                      <span className="ml-auto text-ink-4">
                        {template.audience === 'Ambos' ? 'Todos' : template.audience}
                      </span>
                    </div>
                  </motion.article>
                ))}
              </motion.div>
            </section>
          );
        })}
      </div>

      <TemplateEditor
        template={editing}
        onSave={(patch) => {
          if (editing) store.editTemplate(editing.id, patch);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

/**
 * Uma mensagem foi editada quando não bate mais com o catálogo de fábrica.
 * Comparar texto é mais barato — e mais honesto — do que manter um sinalizador
 * que alguém esqueceria de limpar ao restaurar.
 */
function isEdited(template: PushTemplate): boolean {
  const factory = FACTORY.get(template.id);
  if (!factory) return false;
  return (
    factory.title !== template.title ||
    factory.body !== template.body ||
    factory.cooldownDays !== template.cooldownDays
  );
}

const FACTORY = new Map(PUSH_TEMPLATES.map((t) => [t.id, t] as const));
