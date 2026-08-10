/**
 * Cliente del motor de datos (FastAPI + Pandas).
 *
 * Todas las rutas pasan por `/api/*`, que Next.js redirige al backend
 * (ver `next.config.mjs`), por lo que no hay CORS ni URLs absolutas en el
 * código de los componentes.
 */

const BASE = '/api';

/**
 * Identificador anónimo del navegador.
 *
 * Permite que el historial de cada persona sea suyo sin obligar a crear una
 * cuenta. No es autenticación —quien quiera puede fabricarse uno—, pero impide
 * que los archivos de un visitante aparezcan en el navegador de otro, que es el
 * riesgo real en una aplicación sin registro.
 */
const CLAVE_CLIENTE = 'procesador-datos:cliente';

export function idCliente() {
  if (typeof window === 'undefined') return '';

  try {
    let identificador = window.localStorage.getItem(CLAVE_CLIENTE);
    if (!identificador) {
      identificador = crypto.randomUUID();
      window.localStorage.setItem(CLAVE_CLIENTE, identificador);
    }
    return identificador;
  } catch {
    // Navegación privada o almacenamiento bloqueado: se sigue sin historial.
    return '';
  }
}

/** Cabeceras comunes, con el identificador de cliente cuando existe. */
function cabeceras(extra = {}) {
  const identificador = idCliente();
  return identificador ? { ...extra, 'X-Cliente': identificador } : extra;
}

/** Error de API con el mensaje legible que devuelve el backend. */
export class ApiError extends Error {
  constructor(mensaje, { estado, detalle } = {}) {
    super(mensaje);
    this.name = 'ApiError';
    this.estado = estado;
    this.detalle = detalle;
  }
}

async function extraerError(respuesta) {
  let cuerpo = null;
  try {
    cuerpo = await respuesta.json();
  } catch {
    // Respuesta sin JSON (p. ej. 502 del proxy).
  }

  // FastAPI anida los errores de dominio bajo `detail`.
  const fuente = cuerpo?.detail ?? cuerpo ?? {};
  const mensaje =
    (typeof fuente === 'string' ? fuente : fuente.error) ||
    `El servidor respondió ${respuesta.status}.`;

  return new ApiError(mensaje, { estado: respuesta.status, detalle: fuente.detalle });
}

async function pedir(ruta, opciones = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`${BASE}${ruta}`, opciones);
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError('No se pudo contactar con el motor de datos.', {
      detalle: 'Verifique que el backend esté en ejecución (uvicorn app.main:app).',
    });
  }

  if (!respuesta.ok) throw await extraerError(respuesta);
  return respuesta;
}

async function pedirJson(ruta, opciones) {
  return (await pedir(ruta, opciones)).json();
}

/** Sube un archivo y devuelve el informe inicial completo. */
export async function subirArchivo(archivo, { hoja, señal } = {}) {
  const formulario = new FormData();
  formulario.append('archivo', archivo);
  if (hoja) formulario.append('hoja', hoja);

  return pedirJson('/datasets', {
    method: 'POST',
    body: formulario,
    headers: cabeceras(),
    signal: señal,
  });
}

/** Recalcula el informe aplicando filtros. */
export async function analizar(datasetId, { filtros = [], incluirFilas = false, señal } = {}) {
  return pedirJson(`/datasets/${datasetId}/analisis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filtros, incluir_filas: incluirFilas, limite_filas: 1000 }),
    signal: señal,
  });
}

/** Tablas de frecuencia (agrupada y no agrupada) de una columna. */
export async function obtenerFrecuencias(datasetId, columna, { filtros = [], señal } = {}) {
  const consulta = new URLSearchParams({ columna });
  return pedirJson(`/datasets/${datasetId}/frecuencias?${consulta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filtros }),
    signal: señal,
  });
}

/** Ejecuta la validación de consistencia por scraping simulado. */
export async function validarConsistencia(datasetId, { filtros = [], señal } = {}) {
  return pedirJson(`/datasets/${datasetId}/validacion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filtros }),
    signal: señal,
  });
}

/** Catálogo de archivos de muestra (5 Excel + 5 CSV). */
export async function obtenerMuestras({ señal } = {}) {
  return pedirJson('/muestras', { signal: señal });
}

/** Descarga los datos filtrados y dispara el guardado en el navegador. */
export async function descargarExport(datasetId, formato, { filtros = [] } = {}) {
  const respuesta = await pedir(`/datasets/${datasetId}/exportar?formato=${formato}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filtros }),
  });

  const blob = await respuesta.blob();
  const cabecera = respuesta.headers.get('content-disposition') || '';
  const coincidencia = cabecera.match(/filename="?([^";]+)"?/i);
  guardarBlob(blob, coincidencia?.[1] || `datos.${formato === 'csv' ? 'csv' : 'xlsx'}`);
}

/** Análisis guardados en el historial de este navegador. */
export async function obtenerHistorial({ señal } = {}) {
  return pedirJson('/historial', { headers: cabeceras(), signal: señal });
}

/** Reabre un análisis guardado; devuelve el mismo payload que una subida. */
export async function abrirDelHistorial(entradaId, { señal } = {}) {
  return pedirJson(`/historial/${entradaId}/abrir`, {
    method: 'POST',
    headers: cabeceras(),
    signal: señal,
  });
}

/** Borra una entrada del historial. */
export async function eliminarDelHistorial(entradaId) {
  return pedirJson(`/historial/${entradaId}`, { method: 'DELETE', headers: cabeceras() });
}

/** Vacía el historial de este navegador. */
export async function vaciarHistorial() {
  return pedirJson('/historial', { method: 'DELETE', headers: cabeceras() });
}

/** Libera el dataset en el servidor (mejor esfuerzo). */
export async function liberarDataset(datasetId) {
  try {
    await pedir(`/datasets/${datasetId}`, { method: 'DELETE' });
  } catch {
    // El almacén caduca solo; un fallo aquí no afecta al usuario.
  }
}

/** Guarda un `Blob` como archivo, limpiando siempre la URL temporal. */
export function guardarBlob(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
