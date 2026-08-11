/** Tema compartido por todos los gráficos de Plotly. */

import { PALETA } from '../../lib/constants.js';

const TINTA = '#b6c0e4';
const TINTA_TENUE = '#7f8bb5';
const REJILLA = '#1a2140';

/**
 * Fondo de las imágenes exportadas.
 *
 * En pantalla el lienzo es transparente para dejar ver el fondo animado, pero
 * un PNG con transparencia se vuelve ilegible fuera de la aplicación: el texto
 * del gráfico es claro y quedaría sobre blanco. Coincide con `--color-abismo`.
 */
export const FONDO_EXPORTACION = '#05060f';

/** Configuración de la barra de herramientas y del comportamiento del lienzo. */
export const CONFIG_BASE = {
  responsive: true,
  displaylogo: false,
  scrollZoom: false,
  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d', 'toggleSpikelines'],
  toImageButtonOptions: { format: 'png', scale: 2, filename: 'grafico' },
};

const EJE_BASE = {
  gridcolor: REJILLA,
  zerolinecolor: REJILLA,
  linecolor: REJILLA,
  tickfont: { color: TINTA_TENUE, size: 11 },
  titlefont: { color: TINTA, size: 12 },
  automargin: true,
};

/**
 * Layout base del tema.
 * @param {Object} extra  Ajustes específicos del gráfico (se fusionan encima).
 */
export function layoutBase(extra = {}) {
  const { xaxis, yaxis, ...resto } = extra;

  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    colorway: PALETA,
    font: {
      color: TINTA,
      family: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
      size: 12,
    },
    margin: { t: 16, r: 20, b: 56, l: 64 },
    hovermode: 'closest',
    hoverlabel: {
      bgcolor: '#101529',
      bordercolor: '#242d52',
      font: { color: '#eef2ff', size: 12 },
    },
    legend: {
      orientation: 'h',
      y: -0.2,
      x: 0,
      font: { color: TINTA_TENUE, size: 11 },
      bgcolor: 'rgba(0,0,0,0)',
    },
    xaxis: { ...EJE_BASE, ...xaxis },
    yaxis: { ...EJE_BASE, ...yaxis },
    ...resto,
  };
}

/** Escala secuencial coherente con el tema (para mapas de calor). */
export const ESCALA_SECUENCIAL = [
  [0, '#0a0d1c'],
  [0.25, '#164e63'],
  [0.5, '#0e7490'],
  [0.75, '#2dd4bf'],
  [1, '#a7f3d0'],
];

/** Escala divergente centrada en cero (correlaciones). */
export const ESCALA_DIVERGENTE = [
  [0, '#fb7185'],
  [0.5, '#101529'],
  [1, '#2dd4bf'],
];

export { TINTA, TINTA_TENUE, REJILLA };
