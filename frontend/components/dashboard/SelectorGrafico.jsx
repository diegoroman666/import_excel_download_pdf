'use client';

/** Menú de tipos de gráfico: los doce de la aplicación original. */

import { GRAFICOS } from '../charts/registry';
import Icono from '../ui/Icono';

export default function SelectorGrafico({ seleccionado, onSeleccionar }) {
  return (
    <div
      role="tablist"
      aria-label="Tipo de gráfico"
      className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
    >
      {GRAFICOS.map((grafico) => {
        const activo = grafico.id === seleccionado;
        return (
          <button
            key={grafico.id}
            role="tab"
            aria-selected={activo}
            title={grafico.descripcion}
            onClick={() => onSeleccionar(grafico.id)}
            data-testid={`grafico-${grafico.id}`}
            className={`group flex flex-col items-center gap-1.5 rounded-xl border p-2.5
              transition-all duration-200 hover:-translate-y-0.5
              ${activo
                ? 'border-acento bg-acento/10 text-acento shadow-[0_8px_24px_-14px_var(--color-acento)]'
                : 'border-borde-suave text-tinta-3 hover:border-borde hover:text-tinta-2'}`}
          >
            <Icono nombre={grafico.icono} tamano={20} />
            <span className="text-center text-[10px] leading-tight">{grafico.nombre}</span>
          </button>
        );
      })}
    </div>
  );
}
