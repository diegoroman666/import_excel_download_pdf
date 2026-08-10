/** Formateo de valores para la interfaz (locale es-ES). */

const NUMERO = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 4 });
const NUMERO_CORTO = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
const ENTERO = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 });

/** Número con separadores de miles; `—` si no hay valor. */
export function numero(valor, { corto = false } = {}) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  if (typeof valor !== 'number') return String(valor);
  return (corto ? NUMERO_CORTO : NUMERO).format(valor);
}

/** Entero con separadores de miles. */
export function entero(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return ENTERO.format(valor);
}

/** Número compacto para tarjetas de métricas (1,2 M / 34,5 k). */
export function compacto(valor) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  const absoluto = Math.abs(valor);
  if (absoluto >= 1_000_000) return `${NUMERO_CORTO.format(valor / 1_000_000)} M`;
  if (absoluto >= 10_000) return `${NUMERO_CORTO.format(valor / 1_000)} k`;
  return NUMERO_CORTO.format(valor);
}

/** Porcentaje a partir de una fracción (0,25 → «25 %»). */
export function porcentaje(fraccion, { decimales = 1 } = {}) {
  if (fraccion === null || fraccion === undefined || Number.isNaN(fraccion)) return '—';
  return `${NUMERO_CORTO.format(Number((fraccion * 100).toFixed(decimales)))} %`;
}

/** Porcentaje ya expresado en base 100 (25 → «25 %»). */
export function porcentajeDirecto(valor, { decimales = 1 } = {}) {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return '—';
  return `${NUMERO_CORTO.format(Number(valor.toFixed(decimales)))} %`;
}

/** Tamaño de archivo legible. */
export function bytes(valor) {
  if (!valor && valor !== 0) return '—';
  const unidades = ['B', 'KB', 'MB', 'GB'];
  let indice = 0;
  let cantidad = valor;
  while (cantidad >= 1024 && indice < unidades.length - 1) {
    cantidad /= 1024;
    indice += 1;
  }
  return `${NUMERO_CORTO.format(cantidad)} ${unidades[indice]}`;
}

/** Valor de celda para tablas: fechas ISO abreviadas, nulos visibles. */
export function celda(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (typeof valor === 'number') return numero(valor);
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';

  const texto = String(valor);
  const iso = texto.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(\.\d+)?$/);
  if (iso) return iso[1];
  return texto;
}

/** Duración en milisegundos con unidad adecuada. */
export function duracion(ms) {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ENTERO.format(ms)} ms`;
  return `${NUMERO_CORTO.format(ms / 1000)} s`;
}

/** Trunca un texto largo conservando el inicio. */
export function truncar(texto, maximo = 42) {
  const cadena = String(texto ?? '');
  return cadena.length > maximo ? `${cadena.slice(0, maximo - 1)}…` : cadena;
}

/** Primera letra en mayúscula (para escalas ordinales normalizadas). */
export function capitalizar(texto) {
  const cadena = String(texto ?? '');
  return cadena ? cadena.charAt(0).toUpperCase() + cadena.slice(1) : cadena;
}
