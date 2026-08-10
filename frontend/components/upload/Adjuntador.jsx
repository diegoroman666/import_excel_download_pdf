'use client';

/**
 * Zona de carga inteligente.
 *
 * Acepta arrastrar y soltar o selección manual, valida la extensión antes de
 * enviar nada y muestra en qué fase está el proceso. Las fases reflejan hitos
 * reales (envío del archivo y análisis en Pandas), no una barra de progreso
 * inventada.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Aviso from '../ui/Aviso';
import Boton from '../ui/Boton';
import Icono from '../ui/Icono';

const EXTENSIONES = ['.xlsx', '.xls', '.xlsm', '.csv', '.tsv', '.txt'];
const LIMITE_BYTES = 25 * 1024 * 1024;

const FASES = [
  { id: 'envio', etiqueta: 'Enviando archivo al motor de datos' },
  { id: 'lectura', etiqueta: 'Leyendo con Pandas y normalizando encabezados' },
  { id: 'clasificacion', etiqueta: 'Clasificando el tipo de cada variable' },
  { id: 'estadistica', etiqueta: 'Calculando estadística descriptiva' },
];

function extensionValida(nombre) {
  const punto = nombre.lastIndexOf('.');
  const extension = punto === -1 ? '' : nombre.slice(punto).toLowerCase();
  return EXTENSIONES.includes(extension);
}

export default function Adjuntador({ onArchivo, subiendo, error, onLimpiarError, metadatos }) {
  const entrada = useRef(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [validacion, setValidacion] = useState(null);
  const [fase, setFase] = useState(0);

  // Las fases avanzan mientras el backend trabaja; al terminar se reinician.
  useEffect(() => {
    if (!subiendo) {
      setFase(0);
      return undefined;
    }
    const intervalo = setInterval(() => {
      setFase((actual) => Math.min(actual + 1, FASES.length - 1));
    }, 700);
    return () => clearInterval(intervalo);
  }, [subiendo]);

  const procesar = useCallback(
    (archivo) => {
      if (!archivo) return;
      onLimpiarError?.();

      if (!extensionValida(archivo.name)) {
        setValidacion(
          `«${archivo.name}» no es un formato admitido. Use ${EXTENSIONES.join(', ')}.`,
        );
        return;
      }
      if (archivo.size > LIMITE_BYTES) {
        setValidacion('El archivo supera el límite de 25 MB.');
        return;
      }
      if (archivo.size === 0) {
        setValidacion('El archivo está vacío.');
        return;
      }

      setValidacion(null);
      onArchivo(archivo);
    },
    [onArchivo, onLimpiarError],
  );

  const alSoltar = useCallback(
    (evento) => {
      evento.preventDefault();
      setArrastrando(false);
      procesar(evento.dataTransfer?.files?.[0]);
    },
    [procesar],
  );

  const alSeleccionar = useCallback(
    (evento) => {
      procesar(evento.target.files?.[0]);
      // Permite volver a elegir el mismo archivo tras corregirlo.
      evento.target.value = '';
    },
    [procesar],
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(evento) => {
          evento.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={alSoltar}
        className={`relative overflow-hidden rounded-carta border-2 border-dashed p-8 text-center
          transition-all duration-300 sm:p-12
          ${arrastrando
            ? 'border-acento bg-acento/5 scale-[1.01]'
            : 'border-borde bg-superficie/30 hover:border-acento/50'}`}
      >
        {subiendo && <div className="barrido-carga absolute inset-x-0 top-0 h-0.5" />}

        <input
          ref={entrada}
          type="file"
          accept={EXTENSIONES.join(',')}
          onChange={alSeleccionar}
          className="hidden"
          id="entrada-archivo"
          data-testid="entrada-archivo"
        />

        <span
          className={`mx-auto mb-5 grid size-16 place-items-center rounded-2xl
            ${subiendo ? 'bg-acento/15 text-acento' : 'bg-superficie text-tinta-3'}
            ${!subiendo && !arrastrando ? 'animar-flotar' : ''}`}
        >
          <Icono nombre={subiendo ? 'rayo' : 'subir'} tamano={30} />
        </span>

        <h3 className="text-lg font-semibold text-tinta">
          {subiendo ? 'Procesando su archivo…' : 'Arrastre su archivo aquí'}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-tinta-3">
          {subiendo
            ? 'El motor de Pandas está leyendo, clasificando y midiendo cada columna.'
            : 'Excel (.xlsx, .xls, .xlsm) o texto delimitado (.csv, .tsv). Máximo 25 MB.'}
        </p>

        {!subiendo && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Boton variante="principal" icono="archivo" onClick={() => entrada.current?.click()}>
              Seleccionar archivo
            </Boton>
            <span className="text-xs text-tinta-3">o suéltelo sobre esta zona</span>
          </div>
        )}

        {subiendo && (
          <ol className="mx-auto mt-6 flex max-w-md flex-col gap-2 text-left">
            {FASES.map((paso, indice) => {
              const completada = indice < fase;
              const activa = indice === fase;
              return (
                <li
                  key={paso.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors
                    ${activa ? 'bg-acento/10 text-tinta' : 'text-tinta-3'}`}
                >
                  {completada ? (
                    <Icono nombre="check" tamano={16} className="text-lima" />
                  ) : activa ? (
                    <span className="animar-girar inline-block size-4 shrink-0 rounded-full border-2 border-borde border-t-acento" />
                  ) : (
                    <span className="inline-block size-4 shrink-0 rounded-full border border-borde" />
                  )}
                  {paso.etiqueta}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {validacion && (
        <Aviso tono="aviso" titulo="Revise el archivo" onCerrar={() => setValidacion(null)}>
          {validacion}
        </Aviso>
      )}

      {error && (
        <Aviso tono="error" titulo="No se pudo procesar el archivo" onCerrar={onLimpiarError}>
          {error.mensaje}
          {error.detalle && <span className="mt-1 block text-tinta-3">{error.detalle}</span>}
        </Aviso>
      )}

      {metadatos && !subiendo && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-tinta-3">
          <Icono nombre="check" tamano={14} className="text-lima" />
          <span className="text-tinta-2">{metadatos.nombre_archivo}</span>
          <span>·</span>
          <span>{metadatos.filas} filas</span>
          <span>·</span>
          <span>{metadatos.columnas} columnas</span>
          <Boton
            variante="fantasma"
            tamano="sm"
            icono="reiniciar"
            onClick={() => entrada.current?.click()}
            className="ml-auto"
          >
            Cambiar archivo
          </Boton>
        </div>
      )}
    </div>
  );
}
