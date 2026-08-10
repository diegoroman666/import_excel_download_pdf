/**
 * Mapa de calor.
 *
 * La versión original construía la matriz con los ejes intercambiados (una fila
 * por columna del archivo), de modo que el gráfico sólo era legible por
 * casualidad. Aquí hay dos lecturas correctas y explícitas: la correlación
 * entre variables numéricas y el cruce de dos categorías.
 */

import { agruparPorDos, matrizCorrelacion } from '../../../lib/aggregate.js';
import { ESCALA_DIVERGENTE, ESCALA_SECUENCIAL, layoutBase } from '../theme.js';

const heatmap = {
  id: 'heatmap',
  nombre: 'Mapa de calor',
  descripcion: 'Correlación entre variables numéricas o cruce de dos categorías.',
  icono: 'heatmap',
  ejes: {
    modo: {
      etiqueta: 'Lectura',
      opciones: [
        { id: 'correlacion', nombre: 'Correlación numérica' },
        { id: 'cruce', nombre: 'Cruce de categorías' },
      ],
    },
    x: { etiqueta: 'Categoría (eje X)', requerido: false, filtro: 'cualquiera', soloModo: 'cruce' },
    serie: { etiqueta: 'Categoría (eje Y)', requerido: false, filtro: 'categorica', soloModo: 'cruce' },
    y: { etiqueta: 'Medida', requerido: false, filtro: 'numerica', soloModo: 'cruce' },
    agregacion: true,
  },

  construir({ filas, x, y, serie, agregacion, modo = 'correlacion', columnasNumericas = [] }) {
    if (modo === 'cruce') {
      if (!x || !serie) {
        return { vacio: 'Elija las dos variables categóricas que quiere cruzar.' };
      }

      const { categorias, series, matriz } = agruparPorDos(filas, x, serie, y, {
        agregacion,
        limiteCategorias: 30,
        limiteSeries: 30,
      });
      if (!categorias.length) return { vacio: 'No hay datos que mostrar con los filtros actuales.' };

      const medida = y ? `${agregacion} de ${y}` : 'Nº de registros';

      return {
        data: [
          {
            type: 'heatmap',
            z: matriz,
            x: categorias,
            y: series,
            colorscale: ESCALA_SECUENCIAL,
            hovertemplate: `${x}: %{x}<br>${serie}: %{y}<br>${medida}: %{z}<extra></extra>`,
            colorbar: { title: { text: medida, side: 'right' }, thickness: 12, outlinewidth: 0 },
          },
        ],
        layout: layoutBase({
          xaxis: { title: { text: x }, type: 'category' },
          yaxis: { title: { text: serie }, type: 'category' },
        }),
      };
    }

    if (columnasNumericas.length < 2) {
      return { vacio: 'La correlación necesita al menos dos columnas numéricas.' };
    }

    const { columnas, valores } = matrizCorrelacion(filas, columnasNumericas.slice(0, 20));

    return {
      data: [
        {
          type: 'heatmap',
          z: valores,
          x: columnas,
          y: columnas,
          zmin: -1,
          zmax: 1,
          colorscale: ESCALA_DIVERGENTE,
          hovertemplate: '%{y} ↔ %{x}<br>r = %{z:.3f}<extra></extra>',
          colorbar: { title: { text: 'r', side: 'right' }, thickness: 12, outlinewidth: 0 },
        },
      ],
      layout: layoutBase({
        margin: { t: 16, r: 20, b: 96, l: 120 },
        xaxis: { type: 'category', tickangle: -35 },
        yaxis: { type: 'category', autorange: 'reversed' },
      }),
      nota: 'Coeficiente de Pearson: +1 relación directa, −1 inversa, 0 sin relación lineal.',
    };
  },
};

export default heatmap;
