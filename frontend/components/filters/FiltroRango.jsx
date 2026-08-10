'use client';

/** Rango numérico con deslizadores y entrada manual. */

import { useEffect, useState } from 'react';
import { numero } from '@/lib/format';
import { TIPO_FILTRO } from '@/lib/filters';

export default function FiltroRango({ opciones, filtro, onCambiar, onQuitar }) {
  const limiteMin = opciones.minimo ?? 0;
  const limiteMax = opciones.maximo ?? 0;
  const paso = opciones.paso || (limiteMax - limiteMin) / 100 || 1;

  const minimo = filtro?.minimo ?? limiteMin;
  const maximo = filtro?.maximo ?? limiteMax;

  // Estado local para que el campo de texto acepte valores intermedios
  // mientras se escribe (p. ej. "-" o "1.").
  const [borrador, setBorrador] = useState({ minimo: String(minimo), maximo: String(maximo) });

  useEffect(() => {
    setBorrador({ minimo: String(minimo), maximo: String(maximo) });
  }, [minimo, maximo]);

  const aplicar = (nuevoMin, nuevoMax) => {
    const inferior = Math.min(nuevoMin, nuevoMax);
    const superior = Math.max(nuevoMin, nuevoMax);

    // Si el rango cubre todo el dominio, el filtro deja de tener efecto.
    if (inferior <= limiteMin && superior >= limiteMax) {
      onQuitar();
      return;
    }
    onCambiar({
      tipo: TIPO_FILTRO.RANGO,
      minimo: inferior,
      maximo: superior,
      incluir_nulos: filtro?.incluir_nulos ?? false,
    });
  };

  const confirmarTexto = (clave) => {
    const valor = Number(borrador[clave]);
    if (!Number.isFinite(valor)) {
      setBorrador({ minimo: String(minimo), maximo: String(maximo) });
      return;
    }
    const acotado = Math.min(Math.max(valor, limiteMin), limiteMax);
    aplicar(clave === 'minimo' ? acotado : minimo, clave === 'maximo' ? acotado : maximo);
  };

  const anchoSeleccion =
    limiteMax === limiteMin ? 100 : ((maximo - minimo) / (limiteMax - limiteMin)) * 100;
  const inicioSeleccion =
    limiteMax === limiteMin ? 0 : ((minimo - limiteMin) / (limiteMax - limiteMin)) * 100;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2 text-xs tabular-nums text-tinta-2">
        <span>{numero(minimo, { corto: true })}</span>
        <span className="text-tinta-3">—</span>
        <span>{numero(maximo, { corto: true })}</span>
      </div>

      {/* Barra que representa la porción del dominio seleccionada. */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-superficie-2">
        <div
          className="absolute h-full rounded-full bg-acento transition-all duration-200"
          style={{ left: `${inicioSeleccion}%`, width: `${Math.max(anchoSeleccion, 1)}%` }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-[11px] text-tinta-3">
          <span className="w-10 shrink-0">Desde</span>
          <input
            type="range"
            min={limiteMin}
            max={limiteMax}
            step={paso}
            value={minimo}
            onChange={(evento) => aplicar(Number(evento.target.value), maximo)}
            aria-label={`Valor mínimo de ${opciones.columna}`}
            className="h-1 flex-1 accent-[var(--color-acento)]"
          />
        </label>
        <label className="flex items-center gap-2 text-[11px] text-tinta-3">
          <span className="w-10 shrink-0">Hasta</span>
          <input
            type="range"
            min={limiteMin}
            max={limiteMax}
            step={paso}
            value={maximo}
            onChange={(evento) => aplicar(minimo, Number(evento.target.value))}
            aria-label={`Valor máximo de ${opciones.columna}`}
            className="h-1 flex-1 accent-[var(--color-acento)]"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {['minimo', 'maximo'].map((clave) => (
          <input
            key={clave}
            type="number"
            value={borrador[clave]}
            step={paso}
            onChange={(evento) => setBorrador((previo) => ({ ...previo, [clave]: evento.target.value }))}
            onBlur={() => confirmarTexto(clave)}
            onKeyDown={(evento) => evento.key === 'Enter' && confirmarTexto(clave)}
            aria-label={`${clave === 'minimo' ? 'Mínimo' : 'Máximo'} de ${opciones.columna}`}
            className="w-full rounded-lg border border-borde-suave bg-abismo-2/60 px-2 py-1.5
              text-xs tabular-nums text-tinta focus:border-acento"
          />
        ))}
      </div>

      {opciones.tiene_nulos && (
        <label className="flex cursor-pointer items-center gap-2 border-t border-borde-suave pt-2 text-[11px] text-tinta-3">
          <input
            type="checkbox"
            checked={filtro?.incluir_nulos ?? false}
            onChange={(evento) =>
              onCambiar({
                tipo: TIPO_FILTRO.RANGO,
                minimo,
                maximo,
                incluir_nulos: evento.target.checked,
              })
            }
            className="size-3.5 accent-[var(--color-ambar)]"
          />
          Incluir filas sin valor
        </label>
      )}
    </div>
  );
}
