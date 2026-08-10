'use client';

/**
 * Validación de consistencia por scraping simulado.
 *
 * Contrasta el dataset contra catálogos de referencia (regiones, categorías,
 * rangos físicos admisibles) que el backend tiene embebidos. El proceso imita
 * una consulta externa —incluida su latencia— pero **no realiza peticiones de
 * red**, de modo que es reproducible y funciona sin conexión.
 */

import { useState } from 'react';
import { validarConsistencia } from '@/lib/api';
import { duracion, entero, numero } from '@/lib/format';
import Aviso from '../ui/Aviso';
import Boton from '../ui/Boton';
import EstadoVacio from '../ui/EstadoVacio';
import Icono from '../ui/Icono';

const SEVERIDADES = {
  critico: { etiqueta: 'Crítico', color: 'var(--color-rojo)', icono: 'alerta' },
  advertencia: { etiqueta: 'Advertencia', color: 'var(--color-ambar)', icono: 'alerta' },
  info: { etiqueta: 'Informativo', color: 'var(--color-acento-2)', icono: 'info' },
};

function Puntuacion({ valor }) {
  const tono =
    valor >= 90 ? 'var(--color-lima)' : valor >= 70 ? 'var(--color-ambar)' : 'var(--color-rojo)';
  const circunferencia = 2 * Math.PI * 34;

  return (
    <div className="flex items-center gap-4">
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 80 80" className="size-full -rotate-90">
          <circle cx="40" cy="40" r="34" fill="none" stroke="var(--color-superficie-2)" strokeWidth="7" />
          <circle
            cx="40"
            cy="40"
            r="34"
            fill="none"
            stroke={tono}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={circunferencia}
            strokeDashoffset={circunferencia * (1 - valor / 100)}
            style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-lg font-bold tabular-nums text-tinta">
          {Math.round(valor)}
        </span>
      </div>

      <div>
        <p className="text-sm font-semibold text-tinta">Puntuación de consistencia</p>
        <p className="mt-0.5 max-w-xs text-xs text-tinta-3">
          100 significa que no se detectó ninguna incidencia. Cada hallazgo descuenta según su
          gravedad y cuántas filas afecta.
        </p>
      </div>
    </div>
  );
}

function Hallazgo({ hallazgo }) {
  const severidad = SEVERIDADES[hallazgo.severidad] ?? SEVERIDADES.info;

  return (
    <li
      className="rounded-xl border p-3.5"
      style={{
        borderColor: `color-mix(in oklab, ${severidad.color} 30%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${severidad.color} 6%, transparent)`,
      }}
    >
      <div className="flex items-start gap-3">
        <Icono
          nombre={severidad.icono}
          tamano={17}
          className="mt-0.5 shrink-0"
          style={{ color: severidad.color }}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
              style={{
                color: severidad.color,
                backgroundColor: `color-mix(in oklab, ${severidad.color} 14%, transparent)`,
              }}
            >
              {severidad.etiqueta}
            </span>
            {hallazgo.columna && (
              <span className="rounded bg-superficie px-1.5 py-0.5 text-[10px] text-tinta-2">
                {hallazgo.columna}
              </span>
            )}
            {hallazgo.filas_afectadas > 0 && (
              <span className="text-[10px] text-tinta-3">
                {entero(hallazgo.filas_afectadas)} fila(s)
              </span>
            )}
          </div>

          <p className="mt-1.5 text-sm text-tinta">{hallazgo.mensaje}</p>

          {hallazgo.ejemplos?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {hallazgo.ejemplos.map((ejemplo) => (
                <code
                  key={ejemplo}
                  className="rounded bg-abismo-2 px-1.5 py-0.5 font-mono text-[10px] text-tinta-2"
                >
                  {ejemplo}
                </code>
              ))}
            </div>
          )}

          {hallazgo.sugerencia && (
            <p className="mt-2 text-[11px] text-tinta-3">→ {hallazgo.sugerencia}</p>
          )}
        </div>
      </div>
    </li>
  );
}

export default function ValidadorConsistencia({ datasetId, filtros }) {
  const [informe, setInforme] = useState(null);
  const [ejecutando, setEjecutando] = useState(false);
  const [error, setError] = useState(null);

  const ejecutar = async () => {
    if (!datasetId) return;
    setEjecutando(true);
    setError(null);
    try {
      setInforme(await validarConsistencia(datasetId, { filtros }));
    } catch (causa) {
      setError(causa.message);
    } finally {
      setEjecutando(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-tinta-3">
          Contrasta los valores del archivo con catálogos de referencia y con los rangos admisibles
          de cada magnitud, y señala duplicados, vacíos y variantes de escritura de una misma
          categoría.
        </p>
        <Boton
          variante="principal"
          icono="escudo"
          cargando={ejecutando}
          onClick={ejecutar}
          disabled={!datasetId}
          data-testid="boton-validar"
        >
          {informe ? 'Volver a validar' : 'Ejecutar validación'}
        </Boton>
      </div>

      {error && (
        <Aviso tono="error" onCerrar={() => setError(null)}>
          {error}
        </Aviso>
      )}

      {!informe && !ejecutando && (
        <EstadoVacio icono="escudo" titulo="Validación no ejecutada">
          Lance el proceso para revisar las filas actualmente filtradas frente a los catálogos de
          referencia.
        </EstadoVacio>
      )}

      {informe && (
        <div className="flex flex-col gap-5" data-testid="informe-validacion">
          <div className="flex flex-wrap items-center justify-between gap-5 rounded-carta border border-borde-suave bg-superficie/40 p-5">
            <Puntuacion valor={informe.puntuacion_consistencia} />

            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <dt className="text-tinta-3">Filas analizadas</dt>
              <dd className="tabular-nums text-tinta">{entero(informe.filas_analizadas)}</dd>
              <dt className="text-tinta-3">Hallazgos</dt>
              <dd className="tabular-nums text-tinta">{informe.hallazgos.length}</dd>
              <dt className="text-tinta-3">Duración</dt>
              <dd className="tabular-nums text-tinta">{duracion(informe.duracion_ms)}</dd>
              <dt className="text-tinta-3">Modo</dt>
              <dd className="text-tinta">Scraping simulado</dd>
            </dl>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-3">
              Fuentes consultadas
            </h4>
            <ul className="grid gap-2 sm:grid-cols-2">
              {informe.fuentes.map((fuente) => (
                <li
                  key={`${fuente.nombre}-${fuente.url}`}
                  className="flex items-center gap-2.5 rounded-lg border border-borde-suave bg-superficie/30 px-3 py-2"
                >
                  <span
                    className={`size-1.5 shrink-0 rounded-full ${
                      fuente.estado === 'consultada' ? 'bg-lima' : 'bg-tinta-3/50'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-tinta-2">{fuente.nombre}</p>
                    <p className="truncate font-mono text-[10px] text-tinta-3">{fuente.url}</p>
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-tinta-3">
                    {numero(fuente.registros)} reg · {fuente.latencia_ms} ms
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-3">
              Hallazgos
            </h4>
            {informe.hallazgos.length ? (
              <ul className="flex flex-col gap-2">
                {informe.hallazgos.map((hallazgo, indice) => (
                  <Hallazgo key={`${hallazgo.codigo}-${hallazgo.columna}-${indice}`} hallazgo={hallazgo} />
                ))}
              </ul>
            ) : (
              <Aviso tono="exito" titulo="Sin incidencias">
                Los valores coinciden con los catálogos de referencia y no se detectaron duplicados,
                rangos imposibles ni variantes de escritura.
              </Aviso>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
