/**
 * Registro de gráficos disponibles.
 *
 * Se conservan los doce tipos de la aplicación original. Cada módulo declara
 * qué ejes necesita y sabe construir su propia especificación de Plotly, de
 * modo que añadir un gráfico nuevo no obliga a tocar el dashboard.
 */

import area from './tipos/area.js';
import barras from './tipos/barras.js';
import cajas from './tipos/cajas.js';
import circular from './tipos/circular.js';
import dispersion from './tipos/dispersion.js';
import heatmap from './tipos/heatmap.js';
import histograma from './tipos/histograma.js';
import lineas from './tipos/lineas.js';
import mixto from './tipos/mixto.js';
import radar from './tipos/radar.js';
import regresion from './tipos/regresion.js';
import stacked from './tipos/stacked.js';

export const GRAFICOS = [
  barras,
  circular,
  histograma,
  lineas,
  dispersion,
  area,
  radar,
  stacked,
  mixto,
  cajas,
  heatmap,
  regresion,
];

export const GRAFICOS_POR_ID = Object.fromEntries(GRAFICOS.map((g) => [g.id, g]));

export function obtenerGrafico(id) {
  return GRAFICOS_POR_ID[id] || GRAFICOS[0];
}
