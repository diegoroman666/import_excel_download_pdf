'use client';

/** Rango de fechas (inclusive en ambos extremos). */

import { TIPO_FILTRO } from '@/lib/filters';

export default function FiltroFecha({ opciones, filtro, onCambiar, onQuitar }) {
  const desde = filtro?.desde ?? '';
  const hasta = filtro?.hasta ?? '';

  const aplicar = (nuevoDesde, nuevoHasta) => {
    if (!nuevoDesde && !nuevoHasta) {
      onQuitar();
      return;
    }
    onCambiar({
      tipo: TIPO_FILTRO.FECHA,
      desde: nuevoDesde || null,
      hasta: nuevoHasta || null,
      incluir_nulos: filtro?.incluir_nulos ?? false,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-[11px] text-tinta-3">
        <span className="w-10 shrink-0">Desde</span>
        <input
          type="date"
          value={desde}
          max={hasta || undefined}
          onChange={(evento) => aplicar(evento.target.value, hasta)}
          aria-label={`Fecha inicial de ${opciones.columna}`}
          className="flex-1 rounded-lg border border-borde-suave bg-abismo-2/60 px-2 py-1.5
            text-xs text-tinta focus:border-acento"
        />
      </label>
      <label className="flex items-center gap-2 text-[11px] text-tinta-3">
        <span className="w-10 shrink-0">Hasta</span>
        <input
          type="date"
          value={hasta}
          min={desde || undefined}
          onChange={(evento) => aplicar(desde, evento.target.value)}
          aria-label={`Fecha final de ${opciones.columna}`}
          className="flex-1 rounded-lg border border-borde-suave bg-abismo-2/60 px-2 py-1.5
            text-xs text-tinta focus:border-acento"
        />
      </label>
    </div>
  );
}
