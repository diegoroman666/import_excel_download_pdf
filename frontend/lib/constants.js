/** Constantes de dominio compartidas por toda la interfaz. */

export const TIPOS_VARIABLE = {
  NOMINAL: 'Cualitativo Nominal',
  ORDINAL: 'Cualitativo Ordinal',
  DISCRETA: 'Cuantitativo Discreto',
  CONTINUA: 'Cuantitativo Continuo',
};

/** Presentación de cada tipo: color, abreviatura y explicación didáctica. */
export const META_TIPOS = {
  [TIPOS_VARIABLE.NOMINAL]: {
    abreviatura: 'NOM',
    color: 'var(--color-nominal)',
    familia: 'Cualitativa',
    descripcion: 'Categorías sin orden natural. Sólo permiten agrupar y contar.',
    ejemplo: 'Ciudad, color, género',
  },
  [TIPOS_VARIABLE.ORDINAL]: {
    abreviatura: 'ORD',
    color: 'var(--color-ordinal)',
    familia: 'Cualitativa',
    descripcion: 'Categorías con jerarquía, pero sin distancia medible entre ellas.',
    ejemplo: 'Bajo < Medio < Alto',
  },
  [TIPOS_VARIABLE.DISCRETA]: {
    abreviatura: 'DIS',
    color: 'var(--color-discreta)',
    familia: 'Cuantitativa',
    descripcion: 'Números contables, sin valores intermedios posibles.',
    ejemplo: 'Nº de hijos, unidades vendidas',
  },
  [TIPOS_VARIABLE.CONTINUA]: {
    abreviatura: 'CON',
    color: 'var(--color-continua)',
    familia: 'Cuantitativa',
    descripcion: 'Magnitudes medibles que admiten cualquier valor de un intervalo.',
    ejemplo: 'Peso, precio, temperatura',
  },
};

export const META_ROLES = {
  identificador: 'Identificador',
  temporal: 'Fecha / tiempo',
  booleano: 'Dicotómica',
  categoria: 'Categoría',
  medida: 'Medida',
  conteo: 'Conteo',
  texto_libre: 'Texto libre',
};

/** Paleta categórica del tema, usada por todos los gráficos. */
export const PALETA = [
  '#2dd4bf',
  '#a78bfa',
  '#38bdf8',
  '#fbbf24',
  '#f472b6',
  '#a3e635',
  '#fb7185',
  '#22d3ee',
  '#c084fc',
  '#facc15',
  '#4ade80',
  '#60a5fa',
];

export const SECCIONES = [
  { id: 'inicio', etiqueta: 'Inicio' },
  { id: 'cargar', etiqueta: 'Cargar datos' },
  { id: 'variables', etiqueta: 'Variables' },
  { id: 'dashboard', etiqueta: 'Dashboard' },
  { id: 'estadistica', etiqueta: 'Estadística' },
  { id: 'calidad', etiqueta: 'Calidad' },
  { id: 'datos', etiqueta: 'Datos' },
];
