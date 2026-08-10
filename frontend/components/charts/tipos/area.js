/** Gráfico de área: como el de líneas, resaltando el volumen acumulado. */

import { agruparPor } from '../../../lib/aggregate.js';
import { PALETA } from '../../../lib/constants.js';
import { layoutBase } from '../theme.js';

const area = {
  id: 'area',
  nombre: 'Área',
  descripcion: 'Resalta el volumen acumulado bajo la evolución de una medida.',
  icono: 'area',
  ejes: {
    x: { etiqueta: 'Eje X (tiempo o secuencia)', requerido: true, filtro: 'cualquiera' },
    y: { etiqueta: 'Medida', requerido: false, filtro: 'numerica' },
    agregacion: true,
  },

  construir({ filas, x, y, agregacion, ordenCategorias }) {
    if (!x) return { vacio: 'Elija la columna que ordena la secuencia.' };

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
          mode: 'lines',
          x: categorias,
          y: valores,
          fill: 'tozeroy',
          fillcolor: 'rgba(45, 212, 191, 0.18)',
          line: { color: PALETA[0], width: 2.5 },
          hovertemplate: `%{x}<br>${medida}: %{y}<extra></extra>`,
        },
      ],
      layout: layoutBase({
        xaxis: { title: { text: x }, type: 'category' },
        yaxis: { title: { text: medida }, rangemode: 'tozero' },
      }),
    };
  },
};

export default area;
