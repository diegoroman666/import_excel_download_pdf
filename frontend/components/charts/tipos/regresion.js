/**
 * Regresión lineal simple.
 *
 * La versión original filtraba los valores nulos de X e Y por separado, con lo
 * que las series quedaban desalineadas y la recta no correspondía a los puntos.
 * Aquí se usan pares completos y se reporta la bondad del ajuste.
 */

import { paresNumericos, regresionLineal } from '../../../lib/aggregate.js';
import { PALETA } from '../../../lib/constants.js';
import { layoutBase } from '../theme.js';

const regresion = {
  id: 'regresion',
  nombre: 'Regresión',
  descripcion: 'Ajusta una recta por mínimos cuadrados y mide su bondad de ajuste.',
  icono: 'regresion',
  ejes: {
    x: { etiqueta: 'Variable independiente (X)', requerido: true, filtro: 'numerica' },
    y: { etiqueta: 'Variable dependiente (Y)', requerido: true, filtro: 'numerica' },
  },

  construir({ filas, x, y }) {
    if (!x || !y) return { vacio: 'Elija las variables independiente (X) y dependiente (Y).' };
    if (x === y) return { vacio: 'Elija dos variables distintas para la regresión.' };

    const { x: ejeX, y: ejeY } = paresNumericos(filas, x, y);
    if (ejeX.length < 2) return { vacio: 'Hacen falta al menos dos pares de valores completos.' };

    const ajuste = regresionLineal(ejeX, ejeY);
    if (!ajuste) {
      return { vacio: `«${x}» no varía en los datos filtrados: no existe recta de regresión.` };
    }

    // Basta con los extremos para trazar la recta.
    const minimo = Math.min(...ejeX);
    const maximo = Math.max(...ejeX);
    const rectaX = [minimo, maximo];
    const rectaY = rectaX.map((valor) => ajuste.pendiente * valor + ajuste.intercepto);

    const signo = ajuste.intercepto >= 0 ? '+' : '−';
    const ecuacion =
      `y = ${ajuste.pendiente.toFixed(4)}x ${signo} ${Math.abs(ajuste.intercepto).toFixed(4)}`;

    return {
      data: [
        {
          type: 'scattergl',
          mode: 'markers',
          name: 'Observaciones',
          x: ejeX,
          y: ejeY,
          marker: { color: PALETA[2], size: 7, opacity: 0.7 },
          hovertemplate: `${x}: %{x}<br>${y}: %{y}<extra></extra>`,
        },
        {
          type: 'scatter',
          mode: 'lines',
          name: 'Recta de regresión',
          x: rectaX,
          y: rectaY,
          line: { color: PALETA[4], width: 3 },
          hovertemplate: `${ecuacion}<extra></extra>`,
        },
      ],
      layout: layoutBase({
        showlegend: true,
        xaxis: { title: { text: x } },
        yaxis: { title: { text: y } },
        annotations: [
          {
            xref: 'paper',
            yref: 'paper',
            x: 0.02,
            y: 0.98,
            xanchor: 'left',
            yanchor: 'top',
            showarrow: false,
            align: 'left',
            bgcolor: 'rgba(16, 21, 41, 0.85)',
            bordercolor: '#242d52',
            borderwidth: 1,
            borderpad: 8,
            font: { color: '#eef2ff', size: 12 },
            text:
              `${ecuacion}<br>R² = ${ajuste.r2.toFixed(4)}` +
              `<br>r = ${ajuste.r.toFixed(4)} · n = ${ajuste.n}`,
          },
        ],
      }),
      nota:
        `El modelo explica el ${(ajuste.r2 * 100).toFixed(1)} % de la variabilidad de «${y}».`,
    };
  },
};

export default regresion;
