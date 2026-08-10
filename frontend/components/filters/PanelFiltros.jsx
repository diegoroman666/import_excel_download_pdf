'use client';

/**
 * Panel de segmentación por columnas, al estilo de Power BI.
 *
 * Cada columna recibe el control adecuado a su tipo (lista de categorías,
 * rango numérico, rango de fechas o búsqueda de texto). Los filtros se combinan
 * con AND y el dashboard entero se recalcula a partir de ellos.
 */

import { useMemo, useState } from 'react';
import { META_TIPOS } from '@/lib/constants';
import { TIPO_FILTRO } from '@/lib/filters';
import { entero } from '@/lib/format';
import Icono from '../ui/Icono';
import FiltroCategorico from './FiltroCategorico';
import FiltroFecha from './FiltroFecha';
import FiltroRango from './FiltroRango';
import FiltroTexto from './FiltroTexto';

const CONTROLES = {
  [TIPO_FILTRO.CATEGORICO]: FiltroCategorico,
  [TIPO_FILTRO.RANGO]: FiltroRango,
  [TIPO_FILTRO.FECHA]: FiltroFecha,
  [TIPO_FILTRO.TEXTO]: FiltroTexto,
};

function FiltroColumna({ opciones, columna, filtro, activo, onCambiar, onQuitar, abierta, alternar }) {
  const Control = CONTROLES[opciones.tipo_control] ?? FiltroCategorico;
  const meta = META_TIPOS[columna?.tipo];

  return (
    <li className={`rounded-xl border transition-colors ${activo ? 'border-acento/40 bg-acento/[0.04]' : 'border-borde-suave'}`}>
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierta}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Icono
          nombre="chevron"
          tamano={13}
          className={`shrink-0 text-tinta-3 transition-transform ${abierta ? 'rotate-90' : ''}`}
        />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-tinta" title={columna?.nombre}>
          {opciones.columna}
        </span>
        {meta && (
          <span
            className="shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold"
            style={{ color: meta.color, backgroundColor: `color-mix(in oklab, ${meta.color} 12%, transparent)` }}
          >
            {meta.abreviatura}
          </span>
        )}
        {activo && <span className="size-1.5 shrink-0 rounded-full bg-acento" aria-label="Filtro activo" />}
      </button>

      {abierta && (
        <div className="animar-aparecer border-t border-borde-suave px-3 py-3">
          <Control opciones={opciones} filtro={filtro} onCambiar={onCambiar} onQuitar={onQuitar} />
        </div>
      )}
    </li>
  );
}

export default function PanelFiltros({
  filtrosDisponibles,
  columnas,
  filtros,
  onAplicar,
  onQuitar,
  onLimpiar,
  filasFiltradas,
  filasTotales,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [abiertas, setAbiertas] = useState(() => new Set());

  const columnasPorNombre = useMemo(
    () => Object.fromEntries(columnas.map((columna) => [columna.nombre, columna])),
    [columnas],
  );

  const filtrosPorColumna = useMemo(
    () => Object.fromEntries(filtros.map((filtro) => [filtro.columna, filtro])),
    [filtros],
  );

  const visibles = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return filtrosDisponibles;
    return filtrosDisponibles.filter((opciones) =>
      opciones.columna.toLowerCase().includes(termino),
    );
  }, [filtrosDisponibles, busqueda]);

  const alternar = (columna) => {
    setAbiertas((previas) => {
      const siguiente = new Set(previas);
      if (siguiente.has(columna)) siguiente.delete(columna);
      else siguiente.add(columna);
      return siguiente;
    });
  };

  const activos = filtros.length;
  const proporcion = filasTotales ? (filasFiltradas / filasTotales) * 100 : 100;

  return (
    <aside className="vidrio flex max-h-[calc(100vh-7rem)] flex-col rounded-carta lg:sticky lg:top-24">
      <header className="flex items-center gap-2 border-b border-borde-suave px-4 py-3">
        <Icono nombre="filtro" tamano={17} className="text-acento" />
        <h3 className="flex-1 text-sm font-semibold text-tinta">Filtros</h3>
        {activos > 0 && (
          <button
            type="button"
            onClick={onLimpiar}
            className="rounded-lg px-2 py-1 text-[11px] text-tinta-3 transition-colors hover:text-rojo"
          >
            Limpiar ({activos})
          </button>
        )}
      </header>

      {/* Cuántas filas sobreviven a la selección actual. */}
      <div className="border-b border-borde-suave px-4 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-bold tabular-nums text-tinta" data-testid="filas-filtradas">
            {entero(filasFiltradas)}
          </span>
          <span className="text-[11px] text-tinta-3">de {entero(filasTotales)} filas</span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-superficie-2">
          <div
            className="h-full rounded-full bg-acento transition-all duration-300"
            style={{ width: `${Math.max(proporcion, 0.5)}%` }}
          />
        </div>
      </div>

      {filtrosDisponibles.length > 8 && (
        <div className="border-b border-borde-suave px-4 py-2.5">
          <div className="relative">
            <Icono
              nombre="buscar"
              tamano={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-tinta-3"
            />
            <input
              type="search"
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              placeholder="Buscar columna…"
              aria-label="Buscar columna para filtrar"
              className="w-full rounded-lg border border-borde-suave bg-abismo-2/60 py-1.5 pl-8 pr-2
                text-xs text-tinta placeholder:text-tinta-3 focus:border-acento"
            />
          </div>
        </div>
      )}

      <ul className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3">
        {visibles.map((opciones) => (
          <FiltroColumna
            key={opciones.columna}
            opciones={opciones}
            columna={columnasPorNombre[opciones.columna]}
            filtro={filtrosPorColumna[opciones.columna]}
            activo={Boolean(filtrosPorColumna[opciones.columna])}
            abierta={abiertas.has(opciones.columna)}
            alternar={() => alternar(opciones.columna)}
            onCambiar={(cambios) => onAplicar(opciones.columna, cambios)}
            onQuitar={() => onQuitar(opciones.columna)}
          />
        ))}

        {!visibles.length && (
          <li className="px-2 py-6 text-center text-xs text-tinta-3">
            Ninguna columna coincide con «{busqueda}».
          </li>
        )}
      </ul>
    </aside>
  );
}
