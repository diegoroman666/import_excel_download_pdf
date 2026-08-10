/** Gráfico de barras: compara una medida entre categorías. */

import { agruparPor } from '../../../lib/aggregate.js';
import { PALETA } from '../../../lib/constants.js';
import { layoutBase } from '../theme.js';

const barras = {
  id: 'barras',
  nombre: 'Barras',
  descripcion: 'Compara una medida entre las categorías de una variable.',
  icono: 'barras',
  ejes: {
    x: { etiqueta: 'Categoría', requerido: true, filtro: 'cualquiera' },
    y: { etiqueta: 'Medida', requerido: false, filtro: 'numerica' },
    agregacion: true,
  },

  construir({ filas, x, y, agregacion, ordenCategorias }) {
    if (!x) return { vacio: 'Elija una columna para el eje de categorías.' };

    const { categorias, valores, truncado, totalCategorias } = agruparPor(filas, x, y, {
      agregacion,
      ordenCategorias,
    });
    if (!categorias.length) return { vacio: 'No hay datos que mostrar con los filtros actuales.' };

    const medida = y ? `${agregacion} de ${y}` : 'Nº de registros';

    return {
      data: [
        {
          type: 'bar',
          x: categorias,
          y: valores,
          marker: { color: PALETA[0], line: { color: PALETA[0], width: 1 } },
          hovertemplate: `%{x}<br>${medida}: %{y}<extra></extra>`,
        },
      ],
      layout: layoutBase({
        xaxis: { title: { text: x }, type: 'category' },
        yaxis: { title: { text: medida } },
      }),
      nota: truncado
        ? `Se muestran las 25 categorías principales de ${totalCategorias}.`
        : null,
    };
  },
};

export default barras;
