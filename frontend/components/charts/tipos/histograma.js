/** Histograma: distribución de una variable cuantitativa. */

import { histograma as calcularHistograma, serieNumerica } from '../../../lib/aggregate.js';
import { PALETA } from '../../../lib/constants.js';
import { layoutBase } from '../theme.js';

const histograma = {
  id: 'histograma',
  nombre: 'Histograma',
  descripcion: 'Reparte una variable numérica en intervalos de igual amplitud.',
  icono: 'histograma',
  ejes: {
    x: { etiqueta: 'Variable numérica', requerido: true, filtro: 'numerica' },
    clases: true,
  },

  construir({ filas, x, clases }) {
    if (!x) return { vacio: 'Elija una variable numérica para ver su distribución.' };

    const valores = serieNumerica(filas, x);
    if (!valores.length) {
      return { vacio: `«${x}» no tiene valores numéricos con los filtros actuales.` };
    }

    const { etiquetas, conteos, amplitud } = calcularHistograma(valores, clases);

    return {
      data: [
        {
          type: 'bar',
          x: etiquetas,
          y: conteos,
          marker: { color: PALETA[2] },
          hovertemplate: 'Intervalo %{x}<br>Frecuencia: %{y}<extra></extra>',
        },
      ],
      layout: layoutBase({
        bargap: 0.02,
        xaxis: { title: { text: `${x} (intervalos)` }, type: 'category' },
        yaxis: { title: { text: 'Frecuencia absoluta' } },
      }),
      nota:
        amplitud > 0
          ? `${conteos.length} clases de amplitud ${amplitud.toFixed(2)} (regla de Sturges).`
          : null,
    };
  },
};

export default histograma;
