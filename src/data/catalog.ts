import type { CourseArea, Modality, Shift } from '../types';

/* Institutional catalogue. Kept apart from the seed records so filters,
   dropdowns and the case-creation form all read the same list. */

export interface CourseInfo {
  name: string;
  area: CourseArea;
  modality: Modality[];
  totalPeriods: number;
  fee: number;
}

export const CAMPUSES = [
  'Campus Central — Jundiaí',
  'Campus Anchieta — Jundiaí',
  'Polo Digital — Várzea Paulista',
] as const;

export type Campus = (typeof CAMPUSES)[number];

export const COURSES: CourseInfo[] = [
  { name: 'Bacharelado em Ciências Contábeis', area: 'Negócios', modality: ['Presencial', 'Híbrido'], totalPeriods: 8, fee: 789 },
  { name: 'Bacharelado em Administração', area: 'Negócios', modality: ['Presencial', 'Híbrido'], totalPeriods: 8, fee: 850 },
  { name: 'Bacharelado em Direito', area: 'Direito', modality: ['Presencial'], totalPeriods: 10, fee: 1180 },
  { name: 'Bacharelado em Psicologia', area: 'Humanas', modality: ['Presencial'], totalPeriods: 10, fee: 1090 },
  { name: 'Bacharelado em Enfermagem', area: 'Saúde', modality: ['Presencial', 'Híbrido'], totalPeriods: 8, fee: 980 },
  { name: 'Bacharelado em Fisioterapia', area: 'Saúde', modality: ['Presencial'], totalPeriods: 8, fee: 1040 },
  { name: 'Bacharelado em Nutrição', area: 'Saúde', modality: ['Presencial', 'Híbrido'], totalPeriods: 8, fee: 870 },
  { name: 'Bacharelado em Educação Física', area: 'Saúde', modality: ['Presencial'], totalPeriods: 8, fee: 780 },
  { name: 'Engenharia de Software', area: 'Tecnologia', modality: ['Presencial', 'Híbrido'], totalPeriods: 10, fee: 940 },
  { name: 'Engenharia Civil', area: 'Exatas', modality: ['Presencial'], totalPeriods: 10, fee: 1020 },
  { name: 'Ciência da Computação', area: 'Tecnologia', modality: ['Presencial', 'Híbrido'], totalPeriods: 8, fee: 920 },
  { name: 'Tecnologia em Análise e Desenv. de Sistemas', area: 'Tecnologia', modality: ['Híbrido', 'EaD'], totalPeriods: 5, fee: 590 },
  { name: 'Tecnologia em Logística', area: 'Negócios', modality: ['Híbrido', 'EaD'], totalPeriods: 4, fee: 520 },
  { name: 'Tecnologia em Gestão de Recursos Humanos', area: 'Negócios', modality: ['Híbrido', 'EaD'], totalPeriods: 4, fee: 490 },
  { name: 'Tecnologia em Gestão Financeira', area: 'Negócios', modality: ['EaD'], totalPeriods: 4, fee: 470 },
  { name: 'Licenciatura em Pedagogia', area: 'Humanas', modality: ['Híbrido', 'EaD'], totalPeriods: 6, fee: 460 },
  { name: 'Bacharelado em Arquitetura e Urbanismo', area: 'Exatas', modality: ['Presencial'], totalPeriods: 10, fee: 1150 },
];

export const COURSE_NAMES = COURSES.map((c) => c.name);

export function courseInfo(name: string): CourseInfo {
  return COURSES.find((c) => c.name === name) ?? COURSES[0];
}

export const SHIFTS: Shift[] = ['Matutino', 'Vespertino', 'Noturno', 'Integral'];
export const MODALITIES: Modality[] = ['Presencial', 'Híbrido', 'EaD'];

export const SEMESTERS = ['2026/2', '2026/1', '2025/2'] as const;

/** Institution-wide base size the operational metrics are extrapolated from. */
export const BASE_POPULATION: Record<Modality | 'Todas', number> = {
  Todas: 8426,
  Presencial: 6420,
  Híbrido: 1348,
  EaD: 658,
};
