/**
 * Elección automática de ejes al cambiar de gráfico o de dataset.
 *
 * Objetivo: que el usuario vea siempre un gráfico con sentido sin tener que
 * configurarlo, respetando a la vez lo que ya haya elegido a mano.
 *
 * Reglas:
 *  - Un eje sin valor previo (`undefined`) recibe una sugerencia.
 *  - Un eje vaciado a propósito (`''`) sigue vacío si es opcional.
 *  - Un valor incompatible con el gráfico nuevo se sustituye (si el eje es
 *    obligatorio) o se vacía (si es opcional).
 */

/** Columnas admisibles para un eje según el filtro que declara el gráfico. */
export function columnasCompatibles(columnas, filtro) {
  if (filtro === 'numerica') return columnas.filter((columna) => columna.es_numerica);
  if (filtro === 'categorica') return columnas.filter((columna) => !columna.es_numerica);
  return columnas;
}

/** Puntuación de una columna como eje de categorías: ni constante ni un identificador. */
function puntuarCategoria(columna) {
  const unicos = columna.unicos ?? 0;
  if (unicos <= 1) return -100;
  if (columna.rol === 'identificador') return -50;
  if (columna.rol === 'texto_libre') return -40;
  // Entre 2 y 12 categorías es el rango que mejor se lee en un gráfico.
  if (unicos <= 12) return 100 - unicos;
  return Math.max(10 - unicos / 10, -20);
}

/** Puntuación de una columna como medida: se prefieren magnitudes continuas. */
function puntuarMedida(columna) {
  if (!columna.es_numerica) return -100;
  if (columna.rol === 'identificador') return -50;
  if (columna.rol === 'medida') return 100;
  if (columna.rol === 'conteo') return 80;
  return 40;
}

function mejorPor(columnas, puntuar, excluidos = []) {
  const candidatas = columnas.filter((columna) => !excluidos.includes(columna.nombre));
  if (!candidatas.length) return '';

  let mejor = null;
  let mayor = -Infinity;
  for (const columna of candidatas) {
    const puntos = puntuar(columna);
    if (puntos > mayor) {
      mayor = puntos;
      mejor = columna;
    }
  }
  return mejor?.nombre ?? '';
}

function sugerir(clave, eje, columnas, excluidos) {
  const disponibles = columnasCompatibles(columnas, eje.filtro);
  if (!disponibles.length) return '';

  if (clave === 'y') return mejorPor(disponibles, puntuarMedida, excluidos);
  if (eje.filtro === 'numerica') return mejorPor(disponibles, puntuarMedida, excluidos);
  return mejorPor(disponibles, puntuarCategoria, excluidos);
}

/**
 * Ajusta la selección de ejes al gráfico indicado.
 *
 * @param {Object} grafico    Módulo del registro de gráficos.
 * @param {Array}  columnas   Columnas analizadas del dataset.
 * @param {Object} seleccion  Selección actual (puede venir incompleta).
 * @returns {Object} nueva selección
 */
export function ajustarSeleccion(grafico, columnas, seleccion = {}) {
  const ejes = grafico.ejes ?? {};
  const resultado = {
    ...seleccion,
    agregacion: seleccion.agregacion ?? 'suma',
    modo: ejes.modo ? (seleccion.modo ?? ejes.modo.opciones[0].id) : undefined,
    clases: seleccion.clases ?? null,
    normalizar: seleccion.normalizar ?? false,
  };

  const excluidos = [];

  for (const clave of ['x', 'y', 'serie']) {
    const eje = ejes[clave];
    if (!eje) {
      resultado[clave] = '';
      continue;
    }

    const disponibles = columnasCompatibles(columnas, eje.filtro);
    const nombres = disponibles.map((columna) => columna.nombre);
    const actual = seleccion[clave];

    if (actual === undefined) {
      resultado[clave] = sugerir(clave, eje, columnas, excluidos);
    } else if (actual === '' && !eje.requerido) {
      resultado[clave] = '';
    } else if (!nombres.includes(actual)) {
      resultado[clave] = eje.requerido ? sugerir(clave, eje, columnas, excluidos) : '';
    } else {
      resultado[clave] = actual;
    }

    // Evita que dos ejes apunten a la misma columna cuando eso no aporta nada.
    if (resultado[clave]) excluidos.push(resultado[clave]);
  }

  // Un desglose idéntico al eje de categorías no descompone nada.
  if (resultado.serie && resultado.serie === resultado.x) {
    const eje = ejes.serie;
    const alternativa = sugerir('serie', eje, columnas, [resultado.x]);
    resultado.serie = alternativa;
  }

  return resultado;
}

/** Selección inicial para un dataset recién cargado. */
export function seleccionInicial(grafico, columnas) {
  return ajustarSeleccion(grafico, columnas, {});
}
