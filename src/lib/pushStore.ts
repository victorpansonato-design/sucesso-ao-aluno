import { useCallback, useMemo, useState } from 'react';
import type {
  AcademicCalendar,
  CalendarEntry,
  CalendarEventOverride,
  PushRule,
  PushRuleOverride,
  PushTemplate,
} from '../types';
import { CALENDARS, CALENDAR_ENTRIES } from '../data/academicCalendars';
import { PUSH_TEMPLATES } from '../data/pushCatalog';
import { rulesFor } from './push';
import { KEYS, load, save } from './storage';

/* ==========================================================================
   Estado da Gestão de PUSH
   --------------------------------------------------------------------------
   Guarda-se a EDIÇÃO, não o resultado.

   O calendário digitalizado e a régua gerada a partir dele são recomputados a
   cada render; o que vai para o localStorage é apenas o que uma pessoa mudou à
   mão. Isso resolve dois problemas de uma vez:

     · corrigir uma data no calendário move os avisos daquele evento sem apagar
       o texto que alguém já tinha reescrito para ele;
     · quando um calendário novo for carregado, quem editou não perde nada — o
       override continua ancorado no id do evento.

   O preço é que um override órfão (evento que sumiu do calendário) fica no
   armazenamento sem efeito. É barato e silencioso, e melhor do que o inverso.
   ========================================================================== */

type EventOverrides = Record<string, CalendarEventOverride>;
type RuleOverrides = Record<string, PushRuleOverride>;
type TemplateOverrides = Record<string, Partial<PushTemplate>>;

export interface PushStore {
  /** Os onze PDFs, já com as correções manuais aplicadas. */
  calendars: AcademicCalendar[];
  /** As trinta e três linhas do site. Vêm de lá, não se editam aqui. */
  entries: CalendarEntry[];
  /** Régua de cada calendário, na ordem de disparo. */
  rulesByCalendar: Record<string, PushRule[]>;
  templates: PushTemplate[];

  /** Ids do que foi tocado — a tela marca esses itens como "editado". */
  editedEvents: Set<string>;
  editedRules: Set<string>;

  editEvent: (eventId: string, patch: CalendarEventOverride) => void;
  resetEvent: (eventId: string) => void;
  editRule: (ruleId: string, patch: PushRuleOverride) => void;
  resetRule: (ruleId: string) => void;
  toggleRule: (ruleId: string, enabled: boolean) => void;
  editTemplate: (templateId: string, patch: Partial<PushTemplate>) => void;
  toggleTemplate: (templateId: string, active: boolean) => void;
  /** Devolve tudo ao que está impresso no PDF e ao catálogo de fábrica. */
  resetAllPush: () => void;
}

export function usePushStore(): PushStore {
  const [eventOverrides, setEventOverrides] = useState<EventOverrides>(() =>
    load<EventOverrides>(KEYS.pushEvents, {}),
  );
  const [ruleOverrides, setRuleOverrides] = useState<RuleOverrides>(() =>
    load<RuleOverrides>(KEYS.pushRules, {}),
  );
  const [templateOverrides, setTemplateOverrides] = useState<TemplateOverrides>(() =>
    load<TemplateOverrides>(KEYS.pushTemplates, {}),
  );

  /* -- Calendários com correções aplicadas -------------------------------- */
  const calendars = useMemo<AcademicCalendar[]>(
    () =>
      CALENDARS.map((calendar) => ({
        ...calendar,
        events: calendar.events.map((event) => {
          const patch = eventOverrides[event.id];
          return patch ? { ...event, ...patch } : event;
        }),
      })),
    [eventOverrides],
  );

  /* -- Régua derivada, com os textos manuais por cima --------------------- */
  const rulesByCalendar = useMemo<Record<string, PushRule[]>>(() => {
    const out: Record<string, PushRule[]> = {};
    calendars.forEach((calendar) => {
      out[calendar.id] = rulesFor(calendar)
        .map((rule) => {
          const patch = ruleOverrides[rule.id];
          return patch ? { ...rule, ...patch } : rule;
        })
        .sort((a, b) =>
          a.sendDate === b.sendDate
            ? a.sendTime.localeCompare(b.sendTime)
            : a.sendDate.localeCompare(b.sendDate),
        );
    });
    return out;
  }, [calendars, ruleOverrides]);

  const templates = useMemo<PushTemplate[]>(
    () =>
      PUSH_TEMPLATES.map((t) => {
        const patch = templateOverrides[t.id];
        return patch ? { ...t, ...patch } : t;
      }),
    [templateOverrides],
  );

  /* -- Mutações ----------------------------------------------------------- */

  const editEvent = useCallback((eventId: string, patch: CalendarEventOverride) => {
    setEventOverrides((prev) => {
      const next = { ...prev, [eventId]: { ...prev[eventId], ...patch } };
      save(KEYS.pushEvents, next);
      return next;
    });
  }, []);

  const resetEvent = useCallback((eventId: string) => {
    setEventOverrides((prev) => {
      const next = { ...prev };
      delete next[eventId];
      save(KEYS.pushEvents, next);
      return next;
    });
  }, []);

  const editRule = useCallback((ruleId: string, patch: PushRuleOverride) => {
    setRuleOverrides((prev) => {
      const next = { ...prev, [ruleId]: { ...prev[ruleId], ...patch } };
      save(KEYS.pushRules, next);
      return next;
    });
  }, []);

  const resetRule = useCallback((ruleId: string) => {
    setRuleOverrides((prev) => {
      const next = { ...prev };
      delete next[ruleId];
      save(KEYS.pushRules, next);
      return next;
    });
  }, []);

  const toggleRule = useCallback(
    (ruleId: string, enabled: boolean) => editRule(ruleId, { enabled }),
    [editRule],
  );

  const editTemplate = useCallback((templateId: string, patch: Partial<PushTemplate>) => {
    setTemplateOverrides((prev) => {
      const next = { ...prev, [templateId]: { ...prev[templateId], ...patch } };
      save(KEYS.pushTemplates, next);
      return next;
    });
  }, []);

  const toggleTemplate = useCallback(
    (templateId: string, active: boolean) => editTemplate(templateId, { active }),
    [editTemplate],
  );

  const resetAllPush = useCallback(() => {
    setEventOverrides({});
    setRuleOverrides({});
    setTemplateOverrides({});
    save(KEYS.pushEvents, {});
    save(KEYS.pushRules, {});
    save(KEYS.pushTemplates, {});
  }, []);

  const editedEvents = useMemo(() => new Set(Object.keys(eventOverrides)), [eventOverrides]);
  const editedRules = useMemo(
    () =>
      new Set(
        Object.entries(ruleOverrides)
          // Ligar/desligar não é "editar o texto" — não merece a marca.
          .filter(([, patch]) => Object.keys(patch).some((k) => k !== 'enabled'))
          .map(([id]) => id),
      ),
    [ruleOverrides],
  );

  return {
    calendars,
    entries: CALENDAR_ENTRIES,
    rulesByCalendar,
    templates,
    editedEvents,
    editedRules,
    editEvent,
    resetEvent,
    editRule,
    resetRule,
    toggleRule,
    editTemplate,
    toggleTemplate,
    resetAllPush,
  };
}
