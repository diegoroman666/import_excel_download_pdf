/** Gráfico radar: perfil de una medida sobre varias categorías. */

import { agruparPor } from '../../../lib/aggregate.js';
import { PALETA } from '../../../lib/constants.js';
import { layoutBase, REJILLA, TINTA_TENUE } from '../theme.js';

const MAX_EJES = 12;

const radar = {
  id: 'radar',
  nombre: 'Radar',
  descripcion: 'Dibuja el perfil de una medida sobre varias categorías a la vez.',
  icono: 'radar',
  ejes: {
    x: { etiqueta: 'Categorías (radios)', requerido: true, filtro: 'cualquiera' },
    y: { etiqueta: 'Medida', requerido: false, filtro: 'numerica' },
    agregacion: true,
  },

  construir({ filas, x, y, agregacion, ordenCategorias }) {
    if (!x) return { vacio: 'Elija la columna que define los radios.' };

    const { categorias, valores, totalCategorias } = agruparPor(filas, x, y, {
      agregacion,
      limite: MAX_EJES,
      ordenCategorias,
    });
    if (categorias.length < 3) {
      return { vacio: 'El radar necesita al menos 3 categorías para formar un polígono.' };
    }

    // Se repite el primer punto para cerrar el polígono.
    const radios = [...valores, valores[0]];
    const angulos = [...categorias, categorias[0]];
    const medida = y ? `${agregacion} de ${y}` : 'Nº de registros';

    return {
      data: [
        {
          type: 'scatterpolar',
          r: radios,
          theta: angulos,
          fill: 'toself',
          name: medida,
          fillcolor: 'rgba(167, 139, 250, 0.22)',
          line: { color: PALETA[1], width: 2 },
          hovertemplate: `%{theta}<br>${medida}: %{r}<extra></extra>`,
        },
      ],
      layout: layoutBase({
        margin: { t: 40, r: 60, b: 40, l: 60 },
        xaxis: { visible: false },
        yaxis: { visible: false },
        showlegend: false,
        polar: {
          bgcolor: 'rgba(0,0,0,0)',
          radialaxis: {
            visible: true,
            gridcolor: REJILLA,
            linecolor: REJILLA,
            tickfont: { color: TINTA_TENUE, size: 10 },
            angle: 90,
          },
          angularaxis: {
            gridcolor: REJILLA,
            linecolor: REJILLA,
            tickfont: { color: TINTA_TENUE, size: 11 },
          },
        },
      }),
      nota:
        totalCategorias > MAX_EJES
          ? `Se muestran las ${MAX_EJES} categorías principales de ${totalCategorias}.`
          : null,
    };
  },
};

export default radar;
