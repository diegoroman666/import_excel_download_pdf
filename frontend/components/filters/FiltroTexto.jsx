'use client';

/** Búsqueda por subcadena (no interpreta expresiones regulares). */

import { useEffect, useState } from 'react';
import { TIPO_FILTRO } from '@/lib/filters';
import Icono from '../ui/Icono';

export default function FiltroTexto({ opciones, filtro, onCambiar, onQuitar }) {
  const [texto, setTexto] = useState(filtro?.contiene ?? '');

  useEffect(() => {
    setTexto(filtro?.contiene ?? '');
  }, [filtro?.contiene]);

  // El propio panel ya aplica un retardo antes de llamar al backend, así que
  // aquí se propaga cada pulsación: el filtrado en cliente es inmediato.
  const alEscribir = (valor) => {
    setTexto(valor);
    if (!valor.trim()) {
      onQuitar();
      return;
    }
    onCambiar({
      tipo: TIPO_FILTRO.TEXTO,
      contiene: valor,
      sensible_mayusculas: filtro?.sensible_mayusculas ?? false,
      incluir_nulos: false,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Icono
          nombre="buscar"
          tamano={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-tinta-3"
        />
        <input
          type="search"
          value={texto}
          onChange={(evento) => alEscribir(evento.target.value)}
          placeholder="El texto contiene…"
          aria-label={`Filtrar ${opciones.columna} por texto`}
          className="w-full rounded-lg border border-borde-suave bg-abismo-2/60 py-1.5 pl-8 pr-2
            text-xs text-tinta placeholder:text-tinta-3 focus:border-acento"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-[11px] text-tinta-3">
        <input
          type="checkbox"
          checked={filtro?.sensible_mayusculas ?? false}
          onChange={(evento) =>
            onCambiar({
              tipo: TIPO_FILTRO.TEXTO,
              contiene: texto,
              sensible_mayusculas: evento.target.checked,
              incluir_nulos: false,
            })
          }
          disabled={!texto.trim()}
          className="size-3.5 accent-[var(--color-acento)]"
        />
        Distinguir mayúsculas
      </label>
    </div>
  );
}
