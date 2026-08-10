/** Diagrama de cajas: resumen de la distribución y valores atípicos. */

import { aEtiqueta, serieNumerica } from '../../../lib/aggregate.js';
import { PALETA } from '../../../lib/constants.js';
import { layoutBase } from '../theme.js';

const MAX_CAJAS = 12;

const cajas = {
  id: 'cajas',
  nombre: 'Cajas',
  descripcion: 'Resume mediana, cuartiles y valores atípicos de una variable.',
  icono: 'cajas',
  ejes: {
    y: { etiqueta: 'Variable numérica', requerido: true, filtro: 'numerica' },
    x: { etiqueta: 'Agrupar por (opcional)', requerido: false, filtro: 'categorica' },
  },

  construir({ filas, x, y }) {
    if (!y) return { vacio: 'Elija la variable numérica que quiere resumir.' };

    if (!x) {
      const valores = serieNumerica(filas, y);
      if (!valores.length) {
        return { vacio: `«${y}» no tiene valores numéricos con los filtros actuales.` };
      }

      return {
        data: [
          {
            type: 'box',
            y: valores,
            name: y,
            boxpoints: 'outliers',
            marker: { color: PALETA[0], outliercolor: PALETA[6] },
            line: { color: PALETA[0] },
            fillcolor: 'rgba(45, 212, 191, 0.16)',
            hovertemplate: '%{y}<extra></extra>',
          },
        ],
        layout: layoutBase({
          showlegend: false,
          xaxis: { visible: false },
          yaxis: { title: { text: y } },
        }),
      };
    }

    // Una caja por categoría permite comparar distribuciones.
    const grupos = new Map();
    for (const fila of filas) {
      const valor = Number(fila[y]);
      if (!Number.isFinite(valor)) continue;
      const clave = aEtiqueta(fila[x]);
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(valor);
    }

    if (!grupos.size) return { vacio: 'No hay valores numéricos con los filtros actuales.' };

    const ordenados = [...grupos.entries()].sort((a, b) => b[1].length - a[1].length);
    const visibles = ordenados.slice(0, MAX_CAJAS);

    return {
      data: visibles.map(([nombre, valores], indice) => ({
        type: 'box',
        y: valores,
        name: nombre,
        boxpoints: 'outliers',
        marker: { color: PALETA[indice % PALETA.length] },
        line: { color: PALETA[indice % PALETA.length] },
        hovertemplate: `${nombre}<br>%{y}<extra></extra>`,
      })),
      layout: layoutBase({
        showlegend: false,
        xaxis: { title: { text: x }, type: 'category' },
        yaxis: { title: { text: y } },
      }),
      nota:
        ordenados.length > visibles.length
          ? `Se muestran las ${MAX_CAJAS} categorías con más datos de ${ordenados.length}.`
          : null,
    };
  },
};

export default cajas;
