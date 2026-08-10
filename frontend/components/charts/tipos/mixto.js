/** Gráfico mixto: barras y línea sobre dos ejes verticales independientes. */

import { agruparPor } from '../../../lib/aggregate.js';
import { PALETA } from '../../../lib/constants.js';
import { layoutBase, REJILLA, TINTA_TENUE } from '../theme.js';

const mixto = {
  id: 'mixto',
  nombre: 'Mixto',
  descripcion: 'Combina barras y línea con dos escalas para comparar magnitudes distintas.',
  icono: 'mixto',
  ejes: {
    x: { etiqueta: 'Categoría', requerido: true, filtro: 'cualquiera' },
    y: { etiqueta: 'Medida en barras', requerido: true, filtro: 'numerica' },
    serie: { etiqueta: 'Medida en línea', requerido: false, filtro: 'numerica' },
    agregacion: true,
  },

  construir({ filas, x, y, serie, agregacion, ordenCategorias }) {
    if (!x) return { vacio: 'Elija la columna del eje de categorías.' };
    if (!y) return { vacio: 'Elija la medida numérica que dibujarán las barras.' };

    const barras = agruparPor(filas, x, y, { agregacion, ordenCategorias });
    if (!barras.categorias.length) {
      return { vacio: 'No hay datos que mostrar con los filtros actuales.' };
    }

    // Sin segunda medida se compara la misma variable en dos agregaciones,
    // que es la lectura más útil: volumen total frente a valor típico.
    const agruparLinea = (columna, agregacionUsada) =>
      agruparPor(filas, x, columna, {
        agregacion: agregacionUsada,
        ordenCategorias: barras.categorias,
        limite: barras.categorias.length,
      });

    let usaSegundaMedida = Boolean(serie && serie !== y);
    let columnaLinea = usaSegundaMedida ? serie : y;
    let agregacionLinea = usaSegundaMedida ? agregacion : 'promedio';
    let linea = agruparLinea(columnaLinea, agregacionLinea);

    // Si la columna elegida para la línea no aporta ningún valor numérico, la
    // serie quedaría vacía sobre un eje superpuesto y ese eje no podría
    // escalarse. En ese caso se vuelve a la medida principal.
    if (usaSegundaMedida && !linea.valores.length) {
      usaSegundaMedida = false;
      columnaLinea = y;
      agregacionLinea = 'promedio';
      linea = agruparLinea(columnaLinea, agregacionLinea);
    }

    const etiquetaBarras = `${agregacion} de ${y}`;
    const etiquetaLinea = `${agregacionLinea} de ${columnaLinea}`;

    // El segundo eje lleva un rango explícito. Dejar que Plotly lo calcule
    // mientras dibuja por primera vez un eje superpuesto produce un fotograma
    // con coordenadas indefinidas; además, fijarlo evita que la escala salte
    // al cambiar los filtros.
    const finitos = linea.valores.filter((valor) => Number.isFinite(valor));
    const minimo = finitos.length ? Math.min(...finitos, 0) : 0;
    const maximo = finitos.length ? Math.max(...finitos) : 1;
    const margen = (maximo - minimo) * 0.08 || Math.abs(maximo) * 0.08 || 1;
    const rangoLinea = [minimo - (minimo < 0 ? margen : 0), maximo + margen];

    return {
      data: [
        {
          type: 'bar',
          name: etiquetaBarras,
          x: barras.categorias,
          y: barras.valores,
          marker: { color: PALETA[0] },
          hovertemplate: `%{x}<br>${etiquetaBarras}: %{y}<extra></extra>`,
        },
        {
          type: 'scatter',
          mode: 'lines+markers',
          name: etiquetaLinea,
          x: linea.categorias,
          y: linea.valores,
          yaxis: 'y2',
          line: { color: PALETA[3], width: 2.5 },
          marker: { color: PALETA[3], size: 7 },
          hovertemplate: `%{x}<br>${etiquetaLinea}: %{y}<extra></extra>`,
        },
      ],
      layout: layoutBase({
        showlegend: true,
        margin: { t: 16, r: 64, b: 56, l: 64 },
        xaxis: { title: { text: x }, type: 'category' },
        yaxis: { title: { text: etiquetaBarras } },
        yaxis2: {
          title: { text: etiquetaLinea },
          overlaying: 'y',
          side: 'right',
          range: rangoLinea,
          showgrid: false,
          zeroline: false,
          linecolor: REJILLA,
          tickfont: { color: TINTA_TENUE, size: 11 },
          automargin: true,
        },
      }),
      nota: usaSegundaMedida
        ? null
        : 'Sin segunda medida seleccionada se compara el total (barras) con el promedio (línea).',
    };
  },
};

export default mixto;
