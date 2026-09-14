import assert from 'node:assert/strict';
import { test } from 'node:test';
import { STUDENTS } from '../src/data/seed';
import { CALENDARS, CALENDAR_ENTRIES } from '../src/data/academicCalendars';
import { DEFAULT_TRILHA_CONFIG } from '../src/data/trilhaConfig';
import { buildTrilha, disciplineFor } from '../src/lib/trilha';
import type { CalendarEvent } from '../src/types';

const base = STUDENTS.find((student) => student.ra === '2639012')!;
const student = structuredClone(base);
const hybrid = student.academic.disciplines.filter((discipline) => discipline.format === 'Híbrida');
hybrid[0].calendarSlot = { bimester: 1, ordinal: 1 };
hybrid[0].exempted = true;
hybrid[1].calendarSlot = { bimester: 1, ordinal: 2 };
const event = (title: string) => ({ title } as CalendarEvent);

test('dispensa preserva a posição da segunda disciplina e não se aplica ao próximo bimestre', () => {
  assert.equal(disciplineFor(event('Encontro da 1ª disciplina híbrida do primeiro bimestre'), student)?.id, hybrid[0].id);
  assert.equal(disciplineFor(event('Encontro da 2ª disciplina híbrida do primeiro bimestre'), student)?.id, hybrid[1].id);
  assert.equal(disciplineFor(event('Encontro da 1ª disciplina híbrida do segundo bimestre'), student), undefined);
  assert.equal(disciplineFor(event('Encontro da disciplina híbrida 2 do primeiro bimestre'), student)?.id, hybrid[1].id);
});

test('dispensa mantém todas as datas oficiais e sai do destaque de próxima data', () => {
  const original = buildTrilha(base, CALENDARS, CALENDAR_ENTRIES, DEFAULT_TRILHA_CONFIG, '2026-08-07');
  const model = buildTrilha(student, CALENDARS, CALENDAR_ENTRIES, DEFAULT_TRILHA_CONFIG, '2026-08-07');
  assert.deepEqual(model.items.map((item) => item.eventId), original.items.map((item) => item.eventId));
  const exempted = model.items.filter((item) => item.exempted);
  assert.ok(exempted.length > 0);
  assert.ok(exempted.every((item) => item.title.startsWith('Dispensada:')));
  assert.notEqual(model.next?.exempted, true);
});

test('vínculo duplicado não escolhe uma disciplina arbitrariamente', () => {
  const ambiguous = structuredClone(student);
  ambiguous.academic.disciplines.filter((discipline) => discipline.format === 'Híbrida').forEach((discipline) => {
    discipline.calendarSlot = { bimester: 1, ordinal: 1 };
  });
  assert.equal(disciplineFor(event('Encontro da 1ª disciplina híbrida do primeiro bimestre'), ambiguous), undefined);
});
