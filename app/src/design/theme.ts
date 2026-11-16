// Tema: modo claro/oscuro y acento según la selección dirigida.

export type Mode = 'dark' | 'light';

export interface Nation {
  code: string;      // código FIFA de 3 letras
  name: string;
  flag: string;      // código ISO para flag-icons
  primary: string;   // color de la camiseta
  secondary: string; // segundo color
}

export const NATIONS: Nation[] = [
  { code: 'PER', name: 'Perú', flag: 'pe', primary: '#D91023', secondary: '#FFFFFF' },
  { code: 'ARG', name: 'Argentina', flag: 'ar', primary: '#5BA7E0', secondary: '#FFFFFF' },
  { code: 'BRA', name: 'Brasil', flag: 'br', primary: '#F5CD1E', secondary: '#009C3B' },
  { code: 'URU', name: 'Uruguay', flag: 'uy', primary: '#5CBFEB', secondary: '#0B1F3A' },
  { code: 'COL', name: 'Colombia', flag: 'co', primary: '#FCD116', secondary: '#003893' },
  { code: 'CHI', name: 'Chile', flag: 'cl', primary: '#D52B1E', secondary: '#0039A6' },
  { code: 'ECU', name: 'Ecuador', flag: 'ec', primary: '#FFD100', secondary: '#034EA2' },
  { code: 'PAR', name: 'Paraguay', flag: 'py', primary: '#D52B1E', secondary: '#0038A8' },
  { code: 'BOL', name: 'Bolivia', flag: 'bo', primary: '#007A3D', secondary: '#F9E300' },
  { code: 'VEN', name: 'Venezuela', flag: 've', primary: '#8C1D2C', secondary: '#FFCC00' },
  { code: 'MEX', name: 'México', flag: 'mx', primary: '#006847', secondary: '#FFFFFF' },
  { code: 'ESP', name: 'España', flag: 'es', primary: '#C60B1E', secondary: '#FFC400' },
  { code: 'ENG', name: 'Inglaterra', flag: 'gb-eng', primary: '#1E2B5C', secondary: '#FFFFFF' },
  { code: 'JPN', name: 'Japón', flag: 'jp', primary: '#1A3E8C', secondary: '#FFFFFF' },
];

export const nationByCode = (code: string) => NATIONS.find(n => n.code === code) ?? NATIONS[0];

/** Elige texto blanco o casi negro según el brillo del color. */
export function readableOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#14110b' : '#ffffff';
}

export function applyMode(mode: Mode) {
  document.documentElement.dataset.theme = mode;
}

export function applyNation(nation: Nation) {
  const s = document.documentElement.style;
  s.setProperty('--accent', nation.primary);
  s.setProperty('--accent-2', nation.secondary);
  s.setProperty('--on-accent', readableOn(nation.primary));
}

export function initialMode(): Mode {
  try {
    const saved = localStorage.getItem('ep-mode');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch { /* sin almacenamiento */ }
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function saveMode(mode: Mode) {
  try { localStorage.setItem('ep-mode', mode); } catch { /* sin almacenamiento */ }
}
