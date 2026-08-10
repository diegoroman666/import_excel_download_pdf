'use client';

/**
 * Fila de métricas del dashboard.
 *
 * Se calculan sobre las filas ya filtradas en el navegador, de modo que
 * cambian en el mismo instante en que se mueve un filtro.
 */

import { useMemo } from 'react';
import { aNumero } from '@/lib/aggregate';
import { compacto, entero, porcentajeDirecto } from '@/lib/format';
import Icono from '../ui/Icono';

function Kpi({ etiqueta, valor, detalle, icono, tono = 'var(--color-acento)' }) {
  return (
    <div className="vidrio flex items-center gap-3 rounded-xl p-3.5">
      <span
        className="grid size-9 shrink-0 place-items-center rounded-lg"
        style={{ color: tono, backgroundColor: `color-mix(in oklab, ${tono} 12%, transparent)` }}
      >
        <Icono nombre={icono} tamano={17} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] uppercase tracking-wide text-tinta-3">{etiqueta}</p>
        <p className="truncate text-lg font-bold tabular-nums text-tinta">{valor}</p>
        {detalle && <p className="truncate text-[11px] text-tinta-3">{detalle}</p>}
      </div>
    </div>
  );
}

export default function FilaKpis({ filas, filasTotales, columnas, medida, resumen }) {
  const metricas = useMemo(() => {
    const totalColumnas = columnas.length;
    const celdas = filas.length * totalColumnas;

    let vacias = 0;
    for (const fila of filas) {
      for (const columna of columnas) {
        const valor = fila[columna.nombre];
        if (valor === null || valor === undefined || valor === '') vacias += 1;
      }
    }

    let suma = null;
    let promedio = null;
    if (medida) {
      let acumulado = 0;
      let cuenta = 0;
      for (const fila of filas) {
        const valor = aNumero(fila[medida]);
        if (!Number.isNaN(valor)) {
          acumulado += valor;
          cuenta += 1;
        }
      }
      if (cuenta) {
        suma = acumulado;
        promedio = acumulado / cuenta;
      }
    }

    return {
      completitud: celdas ? ((celdas - vacias) / celdas) * 100 : 100,
      suma,
      promedio,
    };
  }, [filas, columnas, medida]);

  const proporcion = filasTotales ? (filas.length / filasTotales) * 100 : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="fila-kpis">
      <Kpi
        icono="tabla"
        etiqueta="Filas visibles"
        valor={entero(filas.length)}
        detalle={`${porcentajeDirecto(proporcion, { decimales: 0 })} de ${entero(filasTotales)}`}
      />
      <Kpi
        icono="capas"
        etiqueta="Variables"
        valor={entero(columnas.length)}
        detalle={
          resumen
            ? `${resumen.continuas + resumen.discretas} cuantitativas · ${resumen.nominales + resumen.ordinales} cualitativas`
            : null
        }
        tono="var(--color-ordinal)"
      />
      <Kpi
        icono="check"
        etiqueta="Completitud"
        valor={porcentajeDirecto(metricas.completitud)}
        detalle="Celdas con valor sobre el total"
        tono={metricas.completitud >= 95 ? 'var(--color-lima)' : 'var(--color-ambar)'}
      />
      <Kpi
        icono="rayo"
        etiqueta={medida ? `Suma de ${medida}` : 'Medida'}
        valor={medida ? compacto(metricas.suma) : '—'}
        detalle={
          medida
            ? metricas.promedio !== null
              ? `Promedio ${compacto(metricas.promedio)}`
              : 'Sin valores numéricos'
            : 'Elija una medida numérica'
        }
        tono="var(--color-discreta)"
      />
    </div>
  );
}
