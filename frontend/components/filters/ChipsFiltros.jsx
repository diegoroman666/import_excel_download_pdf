'use client';

/** Resumen de los filtros activos, con retirada individual. */

import { describirFiltro } from '@/lib/filters';
import Icono from '../ui/Icono';

export default function ChipsFiltros({ filtros, onQuitar, onLimpiar }) {
  if (!filtros.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="chips-filtros">
      <span className="text-xs text-tinta-3">Filtros activos:</span>

      {filtros.map((filtro) => (
        <span
          key={`${filtro.columna}-${filtro.tipo}`}
          className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-acento/30
            bg-acento/10 py-1 pl-2.5 pr-1 text-[11px] text-acento"
        >
          <span className="truncate" title={describirFiltro(filtro)}>
            {describirFiltro(filtro)}
          </span>
          <button
            type="button"
            onClick={() => onQuitar(filtro.columna)}
            aria-label={`Quitar filtro de ${filtro.columna}`}
            className="rounded p-0.5 transition-colors hover:bg-acento/20"
          >
            <Icono nombre="cerrar" tamano={11} />
          </button>
        </span>
      ))}

      <button
        type="button"
        onClick={onLimpiar}
        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-tinta-3
          transition-colors hover:text-rojo"
      >
        <Icono nombre="reiniciar" tamano={12} /> Limpiar todo
      </button>
    </div>
  );
}
