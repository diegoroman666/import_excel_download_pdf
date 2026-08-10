/** Gráfico circular (dona): reparto de un total entre categorías. */

import { agruparPor } from '../../../lib/aggregate.js';
import { PALETA } from '../../../lib/constants.js';
import { layoutBase } from '../theme.js';

const MAX_PORCIONES = 10;

const circular = {
  id: 'circular',
  nombre: 'Circular',
  descripcion: 'Muestra qué proporción del total aporta cada categoría.',
  icono: 'circular',
  ejes: {
    x: { etiqueta: 'Categoría', requerido: true, filtro: 'cualquiera' },
    y: { etiqueta: 'Medida', requerido: false, filtro: 'numerica' },
    agregacion: true,
  },

  construir({ filas, x, y, agregacion, ordenCategorias }) {
    if (!x) return { vacio: 'Elija la columna que define las porciones.' };

    const { categorias, valores, totalCategorias } = agruparPor(filas, x, y, {
      agregacion,
      limite: 200,
      ordenCategorias,
    });
    if (!categorias.length) return { vacio: 'No hay datos que mostrar con los filtros actuales.' };

    // Un reparto porcentual exige magnitudes no negativas.
    if (valores.some((valor) => valor < 0)) {
      return {
        vacio:
          'Un gráfico circular no puede representar valores negativos. ' +
          'Pruebe con barras o cambie la agregación.',
      };
    }

    let etiquetas = categorias;
    let magnitudes = valores;
    let nota = null;

    if (categorias.length > MAX_PORCIONES) {
      const principales = categorias.slice(0, MAX_PORCIONES);
      const resto = valores.slice(MAX_PORCIONES).reduce((a, b) => a + b, 0);
      etiquetas = [...principales, 'Otros'];
      magnitudes = [...valores.slice(0, MAX_PORCIONES), resto];
      nota = `Las ${totalCategorias - MAX_PORCIONES} categorías menores se agrupan en «Otros».`;
    }

    return {
      data: [
        {
          type: 'pie',
          labels: etiquetas,
          values: magnitudes,
          hole: 0.45,
          sort: false,
          textinfo: 'percent',
          hovertemplate: '%{label}<br>%{value} (%{percent})<extra></extra>',
          marker: { colors: PALETA, line: { color: '#0a0d1c', width: 2 } },
        },
      ],
      layout: layoutBase({
        margin: { t: 16, r: 16, b: 16, l: 16 },
        xaxis: { visible: false },
        yaxis: { visible: false },
        legend: { orientation: 'v', x: 1, y: 0.5, xanchor: 'left', yanchor: 'middle' },
      }),
      nota,
    };
  },
};

export default circular;
