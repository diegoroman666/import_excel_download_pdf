/** Diagrama de dispersión: relación entre dos variables cuantitativas. */

import { aEtiqueta, paresNumericos } from '../../../lib/aggregate.js';
import { PALETA } from '../../../lib/constants.js';
import { layoutBase } from '../theme.js';

const dispersion = {
  id: 'dispersion',
  nombre: 'Dispersión',
  descripcion: 'Relaciona dos variables numéricas, punto a punto.',
  icono: 'dispersion',
  ejes: {
    x: { etiqueta: 'Variable X', requerido: true, filtro: 'numerica' },
    y: { etiqueta: 'Variable Y', requerido: true, filtro: 'numerica' },
    serie: { etiqueta: 'Color por', requerido: false, filtro: 'categorica' },
  },

  construir({ filas, x, y, serie }) {
    if (!x || !y) return { vacio: 'Elija dos variables numéricas (X e Y).' };

    if (!serie) {
      const { x: ejeX, y: ejeY } = paresNumericos(filas, x, y);
      if (!ejeX.length) return { vacio: 'No hay pares de valores numéricos completos.' };

      return {
        data: [
          {
            type: 'scattergl',
            mode: 'markers',
            x: ejeX,
            y: ejeY,
            marker: { color: PALETA[1], size: 7, opacity: 0.75 },
            hovertemplate: `${x}: %{x}<br>${y}: %{y}<extra></extra>`,
          },
        ],
        layout: layoutBase({
          xaxis: { title: { text: x } },
          yaxis: { title: { text: y } },
        }),
        nota: `${ejeX.length} pares representados.`,
      };
    }

    // Una traza por grupo permite distinguir subpoblaciones.
    const grupos = new Map();
    for (const fila of filas) {
      const valorX = Number(fila[x]);
      const valorY = Number(fila[y]);
      if (!Number.isFinite(valorX) || !Number.isFinite(valorY)) continue;

      const clave = aEtiqueta(fila[serie]);
      if (!grupos.has(clave)) grupos.set(clave, { x: [], y: [] });
      grupos.get(clave).x.push(valorX);
      grupos.get(clave).y.push(valorY);
    }

    if (!grupos.size) return { vacio: 'No hay pares de valores numéricos completos.' };

    const ordenados = [...grupos.entries()].sort((a, b) => b[1].x.length - a[1].x.length);
    const visibles = ordenados.slice(0, 10);

    return {
      data: visibles.map(([nombre, puntos], indice) => ({
        type: 'scattergl',
        mode: 'markers',
        name: nombre,
        x: puntos.x,
        y: puntos.y,
        marker: { color: PALETA[indice % PALETA.length], size: 7, opacity: 0.75 },
        hovertemplate: `${nombre}<br>${x}: %{x}<br>${y}: %{y}<extra></extra>`,
      })),
      layout: layoutBase({
        xaxis: { title: { text: x } },
        yaxis: { title: { text: y } },
        showlegend: true,
      }),
      nota:
        ordenados.length > visibles.length
          ? `Se muestran los 10 grupos con más puntos de ${ordenados.length}.`
          : null,
    };
  },
};

export default dispersion;
