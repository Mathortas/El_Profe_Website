export type Line = 'POR' | 'DEF' | 'MED' | 'DEL';
export type Form = -2 | -1 | 0 | 1 | 2;

export interface Player {
  id: number;
  name: string;
  pos: string;          // POR, DFC, LD, LI, MCD, MC, MCO, ED, EI, DC
  line: Line;
  club: string;
  league: string;
  age: number;
  ovr: number;          // media 1–100
  pot: number;          // potencial estimado
  form: Form;
  minutes: number;      // minutos en las últimas 4 fechas de su club
  value: number;        // valor de mercado en millones de US$
  six: [number, number, number, number, number, number]; // RIT TIR PAS REG DEF FÍS
  dual?: string;        // otra nacionalidad
  alerts?: string[];
  caps?: number;        // partidos con la selección
  yellows?: number;     // amarillas acumuladas en el torneo
  last5?: number[];     // notas de sus últimos partidos en el club
  injury?: string;      // lesión o molestia actual
}
