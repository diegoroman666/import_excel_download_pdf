/** Gráfico de líneas: evolución de una medida a lo largo de una secuencia. */

import { agruparPor } from '../../../lib/aggregate.js';
import { PALETA } from '../../../lib/constants.js';
import { layoutBase } from '../theme.js';

const lineas = {
  id: 'lineas',
  nombre: 'Líneas',
  descripcion: 'Sigue la evolución de una medida a lo largo de una secuencia.',
  icono: 'lineas',
  ejes: {
    x: { etiqueta: 'Eje X (tiempo o secuencia)', requerido: true, filtro: 'cualquiera' },
    y: { etiqueta: 'Medida', requerido: false, filtro: 'numerica' },
    agregacion: true,
  },

  construir({ filas, x, y, agregacion, ordenCategorias }) {
    if (!x) return { vacio: 'Elija la columna que ordena la secuencia.' };

    // Una línea sólo tiene sentido si el eje X está ordenado.
    const { categorias, valores } = agruparPor(filas, x, y, {
      agregacion,
      limite: 400,
      ordenar: 'categoria',
      ordenCategorias,
    });
    if (!categorias.length) return { vacio: 'No hay datos que mostrar con los filtros actuales.' };

    const medida = y ? `${agregacion} de ${y}` : 'Nº de registros';

    return {
      data: [
        {
          type: 'scatter',
          mode: categorias.length > 60 ? 'lines' : 'lines+markers',
          x: categorias,
          y: valores,
          line: { color: PALETA[0], width: 2.5, shape: 'linear' },
          marker: { color: PALETA[0], size: 6 },
          hovertemplate: `%{x}<br>${medida}: %{y}<extra></extra>`,
        },
      ],
      layout: layoutBase({
        xaxis: { title: { text: x }, type: 'category' },
        yaxis: { title: { text: medida } },
      }),
    };
  },
};

export default lineas;
