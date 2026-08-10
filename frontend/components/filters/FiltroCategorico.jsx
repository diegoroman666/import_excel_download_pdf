'use client';

/** Selección múltiple de categorías con búsqueda, igual que una segmentación. */

import { useMemo, useState } from 'react';
import { TIPO_FILTRO } from '@/lib/filters';
import Icono from '../ui/Icono';

const VISIBLES_INICIALES = 8;

export default function FiltroCategorico({ opciones, filtro, onCambiar, onQuitar }) {
  const [busqueda, setBusqueda] = useState('');
  const [verTodas, setVerTodas] = useState(false);

  const seleccionados = filtro?.valores ?? [];
  const excluir = filtro?.excluir ?? false;
  const incluirNulos = filtro?.incluir_nulos ?? false;

  const coincidencias = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return opciones.valores;
    return opciones.valores.filter((valor) => valor.toLowerCase().includes(termino));
  }, [opciones.valores, busqueda]);

  const visibles = verTodas ? coincidencias : coincidencias.slice(0, VISIBLES_INICIALES);

  const actualizar = (valores, extra = {}) => {
    if (!valores.length && !extra.incluir_nulos) {
      onQuitar();
      return;
    }
    onCambiar({
      tipo: TIPO_FILTRO.CATEGORICO,
      valores,
      excluir,
      incluir_nulos: incluirNulos,
      ...extra,
    });
  };

  const alternar = (valor) => {
    const siguiente = seleccionados.includes(valor)
      ? seleccionados.filter((v) => v !== valor)
      : [...seleccionados, valor];
    actualizar(siguiente);
  };

  return (
    <div className="flex flex-col gap-3">
      {opciones.valores.length > VISIBLES_INICIALES && (
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
            placeholder="Buscar valor…"
            aria-label={`Buscar en ${opciones.columna}`}
            className="w-full rounded-lg border border-borde-suave bg-abismo-2/60 py-1.5 pl-8 pr-2
              text-xs text-tinta placeholder:text-tinta-3 focus:border-acento"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
        <button
          type="button"
          onClick={() => actualizar(coincidencias)}
          className="text-acento transition-opacity hover:opacity-80"
        >
          Seleccionar {busqueda ? 'coincidencias' : 'todo'}
        </button>
        <button
          type="button"
          onClick={() => actualizar([])}
          className="text-tinta-3 transition-colors hover:text-tinta"
        >
          Limpiar
        </button>
        {seleccionados.length > 0 && (
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-tinta-3">
            <input
              type="checkbox"
              checked={excluir}
              onChange={(evento) =>
                onCambiar({
                  tipo: TIPO_FILTRO.CATEGORICO,
                  valores: seleccionados,
                  excluir: evento.target.checked,
                  incluir_nulos: incluirNulos,
                })
              }
              className="size-3 accent-[var(--color-rojo)]"
            />
            Invertir (excluir)
          </label>
        )}
      </div>

      <ul className="flex max-h-56 flex-col gap-0.5 overflow-y-auto pr-1">
        {visibles.map((valor) => {
          const marcado = seleccionados.includes(valor);
          return (
            <li key={valor}>
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs
                  transition-colors hover:bg-superficie ${marcado ? 'text-tinta' : 'text-tinta-2'}`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={() => alternar(valor)}
                  className="size-3.5 shrink-0 accent-[var(--color-acento)]"
                />
                <span className="truncate" title={valor}>
                  {valor}
                </span>
              </label>
            </li>
          );
        })}

        {!coincidencias.length && (
          <li className="px-2 py-3 text-center text-xs text-tinta-3">Sin coincidencias.</li>
        )}
      </ul>

      {coincidencias.length > VISIBLES_INICIALES && (
        <button
          type="button"
          onClick={() => setVerTodas((previo) => !previo)}
          className="text-left text-[11px] text-acento transition-opacity hover:opacity-80"
        >
          {verTodas
            ? 'Ver menos'
            : `Ver las ${coincidencias.length} opciones`}
        </button>
      )}

      {opciones.tiene_nulos && (
        <label className="flex cursor-pointer items-center gap-2 border-t border-borde-suave pt-2 text-[11px] text-tinta-3">
          <input
            type="checkbox"
            checked={incluirNulos}
            onChange={(evento) =>
              actualizar(seleccionados, { incluir_nulos: evento.target.checked })
            }
            className="size-3.5 accent-[var(--color-ambar)]"
          />
          Incluir filas sin valor (vacíos)
        </label>
      )}

      {opciones.valores_truncados && (
        <p className="text-[10px] text-tinta-3">
          La columna tiene demasiados valores distintos; se listan los más frecuentes.
        </p>
      )}
    </div>
  );
}
