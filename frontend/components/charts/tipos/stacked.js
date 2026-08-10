/** Barras apiladas: composición de cada categoría por una segunda variable. */

import { agruparPorDos } from '../../../lib/aggregate.js';
import { PALETA } from '../../../lib/constants.js';
import { layoutBase } from '../theme.js';

const stacked = {
  id: 'stacked',
  nombre: 'Barras apiladas',
  descripcion: 'Descompone cada barra según una segunda variable categórica.',
  icono: 'stacked',
  ejes: {
    x: { etiqueta: 'Categoría', requerido: true, filtro: 'cualquiera' },
    serie: { etiqueta: 'Desglose', requerido: true, filtro: 'categorica' },
    y: { etiqueta: 'Medida', requerido: false, filtro: 'numerica' },
    agregacion: true,
    normalizar: true,
  },

  construir({ filas, x, y, serie, agregacion, normalizar }) {
    if (!x) return { vacio: 'Elija la columna del eje de categorías.' };
    if (!serie) {
      return {
        vacio:
          'Elija una columna de desglose: es la variable que divide cada barra ' +
          'en segmentos apilados.',
      };
    }
    if (serie === x) return { vacio: 'El desglose debe ser distinto de la categoría del eje X.' };

    const { categorias, series, matriz } = agruparPorDos(filas, x, serie, y, { agregacion });
    if (!categorias.length) return { vacio: 'No hay datos que mostrar con los filtros actuales.' };

    // En modo 100 % cada barra se normaliza a su propio total.
    let valores = matriz;
    if (normalizar) {
      const totales = categorias.map((_, columna) =>
        matriz.reduce((suma, fila) => suma + (fila[columna] || 0), 0),
      );
      valores = matriz.map((fila) =>
        fila.map((valor, columna) => (totales[columna] ? (valor / totales[columna]) * 100 : 0)),
      );
    }

    const medida = normalizar
      ? '% del total'
      : y
        ? `${agregacion} de ${y}`
        : 'Nº de registros';

    return {
      data: series.map((nombre, indice) => ({
        type: 'bar',
        name: nombre,
        x: categorias,
        y: valores[indice],
        marker: { color: PALETA[indice % PALETA.length] },
        hovertemplate: `%{x}<br>${nombre}: %{y:.2f}<extra></extra>`,
      })),
      layout: layoutBase({
        barmode: 'stack',
        showlegend: true,
        xaxis: { title: { text: x }, type: 'category' },
        yaxis: { title: { text: medida }, ticksuffix: normalizar ? ' %' : '' },
      }),
      nota: `Desglosado por «${serie}» (${series.length} segmentos).`,
    };
  },
};

export default stacked;
