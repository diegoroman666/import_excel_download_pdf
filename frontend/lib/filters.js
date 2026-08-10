/**
 * Motor de filtrado en cliente (equivalente a `backend/app/services/filtering.py`).
 *
 * Existe para que los gráficos y las métricas respondan de forma inmediata al
 * mover un filtro, sin esperar al servidor. El backend sigue siendo la fuente
 * de verdad: recalcula el informe completo con la misma semántica y sus
 * resultados sustituyen a los locales en cuanto llegan.
 *
 * Reglas compartidas con el backend:
 *  - Los filtros se combinan con AND.
 *  - Un filtro sin criterio no filtra nada ni cuenta como activo.
 *  - Los nulos no atraviesan un filtro activo salvo que `incluir_nulos` sea true.
 */

export const TIPO_FILTRO = {
  CATEGORICO: 'categorico',
  RANGO: 'rango',
  TEXTO: 'texto',
  FECHA: 'fecha',
  NULOS: 'nulos',
};

/** `true` si el valor debe considerarse ausente. */
export function esNulo(valor) {
  return valor === null || valor === undefined || valor === '';
}

function aNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : NaN;
  if (esNulo(valor)) return NaN;
  const numero = Number(String(valor).replace(/\s/g, ''));
  return Number.isFinite(numero) ? numero : NaN;
}

function aTiempo(valor) {
  if (esNulo(valor)) return NaN;
  const tiempo = new Date(valor).getTime();
  return Number.isNaN(tiempo) ? NaN : tiempo;
}

/** Indica si un filtro tiene un criterio real que aplicar. */
export function filtroEsActivo(filtro) {
  if (!filtro) return false;
  switch (filtro.tipo) {
    case TIPO_FILTRO.CATEGORICO:
      return Array.isArray(filtro.valores) && filtro.valores.length > 0;
    case TIPO_FILTRO.RANGO:
      return filtro.minimo != null || filtro.maximo != null;
    case TIPO_FILTRO.FECHA:
      return Boolean(filtro.desde || filtro.hasta);
    case TIPO_FILTRO.TEXTO:
      return Boolean((filtro.contiene || '').trim());
    case TIPO_FILTRO.NULOS:
      return filtro.incluir_nulos === false;
    default:
      return false;
  }
}

/** Filtros que realmente se aplican, listos para enviar al backend. */
export function filtrosActivos(filtros) {
  return (filtros || []).filter(filtroEsActivo);
}

function evaluarCategorico(valor, filtro, meta) {
  if (esNulo(valor)) return Boolean(filtro.incluir_nulos);

  let pertenece;
  if (meta?.esNumerica) {
    // Comparación numérica: evita depender de cómo Pandas formatea los
    // números al convertirlos a texto ("3" frente a "3.0").
    const numero = aNumero(valor);
    pertenece = filtro.valores.some((v) => aNumero(v) === numero);
  } else {
    pertenece = filtro.valores.includes(String(valor));
  }

  return filtro.excluir ? !pertenece : pertenece;
}

function evaluarRango(valor, filtro) {
  const numero = aNumero(valor);
  if (Number.isNaN(numero)) return Boolean(filtro.incluir_nulos);
  if (filtro.minimo != null && numero < filtro.minimo) return false;
  if (filtro.maximo != null && numero > filtro.maximo) return false;
  return true;
}

function evaluarFecha(valor, filtro) {
  const tiempo = aTiempo(valor);
  if (Number.isNaN(tiempo)) return Boolean(filtro.incluir_nulos);
  if (filtro.desde) {
    const desde = aTiempo(filtro.desde);
    if (!Number.isNaN(desde) && tiempo < desde) return false;
  }
  if (filtro.hasta) {
    const hasta = aTiempo(filtro.hasta);
    if (!Number.isNaN(hasta) && tiempo > hasta) return false;
  }
  return true;
}

function evaluarTexto(valor, filtro) {
  if (esNulo(valor)) return Boolean(filtro.incluir_nulos);
  const patron = (filtro.contiene || '').trim();
  const texto = String(valor);
  return filtro.sensible_mayusculas
    ? texto.includes(patron)
    : texto.toLowerCase().includes(patron.toLowerCase());
}

/** Construye el predicado de un filtro para una fila. */
export function crearPredicado(filtro, meta) {
  switch (filtro.tipo) {
    case TIPO_FILTRO.CATEGORICO:
      return (fila) => evaluarCategorico(fila[filtro.columna], filtro, meta);
    case TIPO_FILTRO.RANGO:
      return (fila) => evaluarRango(fila[filtro.columna], filtro);
    case TIPO_FILTRO.FECHA:
      return (fila) => evaluarFecha(fila[filtro.columna], filtro);
    case TIPO_FILTRO.TEXTO:
      return (fila) => evaluarTexto(fila[filtro.columna], filtro);
    case TIPO_FILTRO.NULOS:
      return (fila) => !esNulo(fila[filtro.columna]);
    default:
      return () => true;
  }
}

/**
 * Aplica todos los filtros activos a las filas.
 *
 * @param {Array<Object>} filas
 * @param {Array<Object>} filtros
 * @param {Object} metaPorColumna  `{ [columna]: { esNumerica: boolean } }`
 * @returns {Array<Object>} filas que superan todos los filtros
 */
export function aplicarFiltros(filas, filtros, metaPorColumna = {}) {
  const activos = filtrosActivos(filtros);
  if (!activos.length) return filas;

  const predicados = activos
    .filter((filtro) => filtro.columna)
    .map((filtro) => crearPredicado(filtro, metaPorColumna[filtro.columna]));

  return filas.filter((fila) => predicados.every((predicado) => predicado(fila)));
}

/** Construye el mapa de metadatos que necesita `aplicarFiltros`. */
export function metaDeColumnas(columnas = []) {
  const mapa = {};
  for (const columna of columnas) {
    mapa[columna.nombre] = {
      esNumerica: Boolean(columna.es_numerica),
      tipo: columna.tipo,
      dtype: columna.dtype_pandas,
    };
  }
  return mapa;
}

/** Resumen legible de un filtro para mostrarlo como chip. */
export function describirFiltro(filtro) {
  switch (filtro.tipo) {
    case TIPO_FILTRO.CATEGORICO: {
      const cantidad = filtro.valores?.length ?? 0;
      const verbo = filtro.excluir ? 'excluye' : 'incluye';
      const detalle = cantidad <= 2 ? filtro.valores.join(', ') : `${cantidad} valores`;
      return `${filtro.columna}: ${verbo} ${detalle}`;
    }
    case TIPO_FILTRO.RANGO: {
      const desde = filtro.minimo != null ? filtro.minimo : '−∞';
      const hasta = filtro.maximo != null ? filtro.maximo : '∞';
      return `${filtro.columna}: ${desde} — ${hasta}`;
    }
    case TIPO_FILTRO.FECHA:
      return `${filtro.columna}: ${filtro.desde || 'inicio'} → ${filtro.hasta || 'fin'}`;
    case TIPO_FILTRO.TEXTO:
      return `${filtro.columna} contiene "${filtro.contiene}"`;
    case TIPO_FILTRO.NULOS:
      return `${filtro.columna}: sin vacíos`;
    default:
      return filtro.columna;
  }
}
