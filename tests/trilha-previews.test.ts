import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CALENDARS, CALENDAR_ENTRIES } from '../src/data/academicCalendars';
import { DEFAULT_TRILHA_CONFIG } from '../src/data/trilhaConfig';
import { TRILHA_PREVIEWS, previewByRa } from '../src/data/trilhaPreview';
import { STUDENTS } from '../src/data/seed';
import { assessmentPeriodOf, buildTrilha, resolveCalendar } from '../src/lib/trilha';
import { baseExamples } from '../src/views/TrilhaView';

const TODAY = '2026-09-14';

/** Cada perfil, e o PDF que ele TEM de resolver. É o contrato da prévia. */
const EXPECTED: Record<string, string> = {
  'previa-fono': 'cal-quinzenal-ingressantes',
  'previa-nutricao': 'cal-quinzenal-veteranos',
  'previa-enfermagem': 'cal-presencial-geral',
  'previa-administracao': 'cal-presencial-geral',
  'previa-direito': 'cal-direito-sex-sab',
};

const modelOf = (ra: string) =>
  buildTrilha(previewByRa(ra)!.student, CALENDARS, CALENDAR_ENTRIES, DEFAULT_TRILHA_CONFIG, TODAY);

test('os cinco perfis resolvem exatamente o calendário publicado para o curso e a coorte', () => {
  assert.equal(TRILHA_PREVIEWS.length, 5);
  for (const preview of TRILHA_PREVIEWS) {
    const model = modelOf(preview.ra);
    assert.equal(model.resolution.match, 'exata', `${preview.ra} não casou linha do site`);
    assert.equal(model.resolution.calendar?.id, EXPECTED[preview.ra], preview.ra);
    assert.ok(model.totalCount > 0, `${preview.ra} ficou sem datas`);
  }
});

test('nenhum perfil colide com um RA da base', () => {
  for (const preview of TRILHA_PREVIEWS) {
    assert.equal(STUDENTS.some((student) => student.ra === preview.ra), false, preview.ra);
  }
});

test('os dois perfis presenciais publicam as janelas de P1 e de P2 do calendário', () => {
  for (const ra of ['previa-enfermagem', 'previa-administracao']) {
    const model = modelOf(ra);
    const windows = model.items
      .map((item) => {
        const event = model.resolution.calendar?.events.find((candidate) => candidate.id === item.eventId);
        return event ? assessmentPeriodOf(event) : null;
      })
      .filter(Boolean);
    assert.deepEqual([...new Set(windows)].sort(), ['P1', 'P2'], ra);
  }
});

test('o veterano presencial carrega duas disciplinas dispensadas, e elas continuam na grade', () => {
  const student = previewByRa('previa-administracao')!.student;
  const exempted = student.academic.disciplines.filter((discipline) => discipline.exempted);
  assert.equal(exempted.length, 2);
  assert.equal(student.academic.subjects, student.academic.disciplines.length);
});

test('os perfis híbridos traduzem «1ª disciplina híbrida» para o nome da grade', () => {
  for (const ra of ['previa-fono', 'previa-nutricao', 'previa-direito']) {
    const model = modelOf(ra);
    const named = model.items.filter((item) =>
      /1ª disciplina híbrida do primeiro bimestre/i.test(item.officialTitle) && item.title !== item.officialTitle,
    );
    assert.ok(named.length > 0, `${ra} não nomeou nenhuma disciplina do primeiro bimestre`);
  }
});

test('o Direito híbrido tem turma, então «21 e 22/08» não vira escolha de turma', () => {
  const model = modelOf('previa-direito');
  assert.equal(model.items.some((item) => item.ambiguousDay), false);
});

/* ==========================================================================
   Os atalhos de aluno real
   ========================================================================== */

test('os exemplos da base só oferecem aluno com o próprio calendário publicado', () => {
  const examples = baseExamples(STUDENTS);
  assert.ok(examples.length > 0);
  for (const student of examples) {
    const { match, calendar } = resolveCalendar(student, CALENDARS, CALENDAR_ENTRIES);
    assert.equal(match, 'exata', `${student.ra} entrou sem documento próprio`);
    assert.ok(calendar);
    assert.ok(student.academic.disciplines.length > 0, `${student.ra} entrou sem grade`);
  }
});

test('os exemplos da base não repetem calendário nem oferecem oferta encerrada', () => {
  const examples = baseExamples(STUDENTS);
  const calendars = examples.map(
    (student) => resolveCalendar(student, CALENDARS, CALENDAR_ENTRIES).calendar!.id,
  );
  assert.equal(new Set(calendars).size, calendars.length, 'dois exemplos do mesmo PDF');
  assert.equal(
    examples.some((student) => /Recursos Humanos/.test(student.course)),
    false,
    'a oferta híbrida de RH está encerrada e não serve de exemplo',
  );
});
