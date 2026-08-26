import { useEffect, useState } from 'react';
import { CalendarDays, RotateCcw, Send } from 'lucide-react';
import type {
  CalendarEvent,
  EventRelevance,
  PushCategory,
  PushRule,
  PushTemplate,
} from '../../types';
import { Modal } from '../ui/Overlay';
import { Button } from '../ui/Button';
import { Field, Select, Switch, TextArea, TextInput } from '../ui/Fields';
import { Callout } from '../ui/Surfaces';
import { CATEGORY_LABEL } from '../../lib/push';
import { NotificationPreview } from './PushBits';

/* ==========================================================================
   Os três lápis
   --------------------------------------------------------------------------
   Um para a linha do calendário, um para o aviso da régua, um para a mensagem
   personalizada. Os três seguem a mesma regra: o formulário abre com o valor
   atual, "Restaurar" devolve ao que está impresso no PDF (ou ao catálogo de
   fábrica), e nada é salvo até alguém confirmar.

   O editor de aviso mostra o push renderizado ao lado do campo, atualizando a
   cada tecla. Sem isso, escrever push é escrever no escuro: ninguém consegue
   julgar um texto de notificação lendo-o dentro de um textarea.
   ========================================================================== */

const CATEGORIES: PushCategory[] = [
  'aula',
  'prova',
  'prazo',
  'evento',
  'feriado',
  'programa',
  'financeiro',
  'engajamento',
  'acolhimento',
];

const RELEVANCES: { value: EventRelevance; label: string; help: string }[] = [
  { value: 'alta', label: 'Alta', help: 'Vira push, com reforço antecipado quando é prova ou prazo.' },
  { value: 'media', label: 'Média', help: 'Vira um push único, no dia ou na véspera.' },
  { value: 'baixa', label: 'Baixa', help: 'Fica registrado no calendário e não gera push.' },
];

/* -- Linha do calendário -------------------------------------------------- */

export function EventEditor({
  event,
  edited,
  onSave,
  onReset,
  onClose,
}: {
  event: CalendarEvent | null;
  edited: boolean;
  onSave: (patch: {
    dateLabel: string;
    title: string;
    detail: string;
    category: PushCategory;
    relevance: EventRelevance;
  }) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [dateLabel, setDateLabel] = useState('');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [category, setCategory] = useState<PushCategory>('aula');
  const [relevance, setRelevance] = useState<EventRelevance>('media');

  useEffect(() => {
    if (!event) return;
    setDateLabel(event.dateLabel);
    setTitle(event.title);
    setDetail(event.detail ?? '');
    setCategory(event.category);
    setRelevance(event.relevance);
  }, [event]);

  const help = RELEVANCES.find((r) => r.value === relevance)?.help;

  return (
    <Modal
      open={Boolean(event)}
      onClose={onClose}
      title="Editar linha do calendário"
      subtitle="Mudar a data aqui move todos os avisos deste evento junto."
      icon={<CalendarDays className="h-4.5 w-4.5" />}
      size="lg"
      footer={
        <>
          {edited && (
            <Button variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onReset}>
              Restaurar do PDF
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => onSave({ dateLabel, title, detail, category, relevance })}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="space-y-4 p-5">
        {event?.note && (
          <Callout tone="warn" title="Divergência no PDF de origem">
            {event.note}
          </Callout>
        )}

        <Field
          label="Data, como está impressa"
          required
          help="Aceita dia, período e lista: 09/07 · 01/07 a 21/08 · 12 e 13/10 · 13, 14, 27 e 28/11."
        >
          {(id) => (
            <TextInput
              id={id}
              value={dateLabel}
              onChange={(e) => setDateLabel(e.target.value)}
              className="font-mono"
            />
          )}
        </Field>

        <Field label="Descrição" required>
          {(id) => (
            <TextArea id={id} rows={2} value={title} onChange={(e) => setTitle(e.target.value)} />
          )}
        </Field>

        <Field label="Complemento" help="Local, horário e observações impressas abaixo da linha.">
          {(id) => (
            <TextArea id={id} rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria" help="Define a antecedência e o horário do disparo.">
            {(id) => (
              <Select
                id={id}
                value={category}
                onChange={(e) => setCategory(e.target.value as PushCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Relevância para o aluno" help={help}>
            {(id) => (
              <Select
                id={id}
                value={relevance}
                onChange={(e) => setRelevance(e.target.value as EventRelevance)}
              >
                {RELEVANCES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* -- Aviso da régua ------------------------------------------------------- */

export function RuleEditor({
  rule,
  eventTitle,
  edited,
  onSave,
  onReset,
  onClose,
}: {
  rule: PushRule | null;
  eventTitle?: string;
  edited: boolean;
  onSave: (patch: {
    title: string;
    body: string;
    sendDate: string;
    sendTime: string;
    enabled: boolean;
  }) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sendDate, setSendDate] = useState('');
  const [sendTime, setSendTime] = useState('09:00');
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (!rule) return;
    setTitle(rule.title);
    setBody(rule.body);
    setSendDate(rule.sendDate);
    setSendTime(rule.sendTime);
    setEnabled(rule.enabled);
  }, [rule]);

  // A prova de gráfica usa um nome real: "#NOME#" no preview esconde justamente
  // o problema que o preview existe para revelar — o texto com o nome dentro.
  const preview = (text: string) => text.replace(/#NOME#/g, 'Marina');

  return (
    <Modal
      open={Boolean(rule)}
      onClose={onClose}
      title="Editar aviso"
      subtitle={eventTitle}
      icon={<Send className="h-4.5 w-4.5" />}
      size="lg"
      footer={
        <>
          {edited && (
            <Button variant="ghost" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={onReset}>
              Restaurar texto gerado
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => onSave({ title, body, sendDate, sendTime, enabled })}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data do disparo" required>
              {(id) => (
                <TextInput
                  id={id}
                  type="date"
                  value={sendDate}
                  onChange={(e) => setSendDate(e.target.value)}
                />
              )}
            </Field>
            <Field label="Horário" required>
              {(id) => (
                <TextInput
                  id={id}
                  type="time"
                  value={sendTime}
                  onChange={(e) => setSendTime(e.target.value)}
                />
              )}
            </Field>
          </div>

          <Field
            label="Título"
            required
            hint={`${title.length}/65`}
            help="O celular corta o título por volta de 65 caracteres."
          >
            {(id) => (
              <TextInput id={id} value={title} onChange={(e) => setTitle(e.target.value)} />
            )}
          </Field>

          <Field
            label="Mensagem"
            required
            hint={`${body.length}/240`}
            help="Use #NOME# para o primeiro nome do aluno. Termine sempre em algo que ele possa fazer hoje."
          >
            {(id) => (
              <TextArea id={id} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            )}
          </Field>

          <Switch
            checked={enabled}
            onChange={setEnabled}
            label="Aviso ativo"
            description="Desligado, ele continua na régua para consulta, mas não é disparado."
          />
        </div>

        <div className="space-y-2">
          <p className="text-[12px] font-medium text-ink-3">Como o aluno vê</p>
          <NotificationPreview
            title={preview(title)}
            body={preview(body)}
            stamp={sendTime}
            muted={!enabled}
          />
          <p className="text-[11px] leading-relaxed text-ink-4">
            Pré-visualização com um nome de exemplo. No disparo, #NOME# vira o primeiro nome de
            cada aluno da turma.
          </p>
        </div>
      </div>
    </Modal>
  );
}

/* -- Mensagem personalizada ----------------------------------------------- */

export function TemplateEditor({
  template,
  onSave,
  onClose,
}: {
  template: PushTemplate | null;
  onSave: (patch: Partial<PushTemplate>) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [cooldownDays, setCooldownDays] = useState(14);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!template) return;
    setTitle(template.title);
    setBody(template.body);
    setCooldownDays(template.cooldownDays);
    setActive(template.active);
  }, [template]);

  const preview = (text: string) => text.replace(/#NOME#/g, 'Marina');

  return (
    <Modal
      open={Boolean(template)}
      onClose={onClose}
      title={template ? `${template.code} · ${template.name}` : 'Mensagem'}
      subtitle={template?.trigger}
      icon={<Send className="h-4.5 w-4.5" />}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => onSave({ title, body, cooldownDays, active })}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <Field label="Título" required hint={`${title.length}/65`}>
            {(id) => (
              <TextInput id={id} value={title} onChange={(e) => setTitle(e.target.value)} />
            )}
          </Field>

          <Field
            label="Mensagem"
            required
            hint={`${body.length}/240`}
            help="Use #NOME# para o primeiro nome do aluno."
          >
            {(id) => (
              <TextArea id={id} rows={5} value={body} onChange={(e) => setBody(e.target.value)} />
            )}
          </Field>

          <Field
            label="Intervalo mínimo entre repetições"
            hint="dias"
            help="A condição continua verdadeira depois do disparo. Sem intervalo, o mesmo aviso sairia todo dia."
          >
            {(id) => (
              <TextInput
                id={id}
                type="number"
                min={1}
                max={365}
                value={cooldownDays}
                onChange={(e) => setCooldownDays(Number(e.target.value) || 1)}
                className="font-mono"
              />
            )}
          </Field>

          <Switch
            checked={active}
            onChange={setActive}
            label="Mensagem ativa"
            description="Desligada, ela deixa de ser disparada e some do histórico previsto dos alunos."
          />
        </div>

        <div className="space-y-2">
          <p className="text-[12px] font-medium text-ink-3">Como o aluno vê</p>
          <NotificationPreview title={preview(title)} body={preview(body)} muted={!active} />
        </div>
      </div>
    </Modal>
  );
}
