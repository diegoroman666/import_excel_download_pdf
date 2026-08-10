/** Lista desplegable con etiqueta accesible. */

import { useId } from 'react';

export default function Selector({
  etiqueta,
  valor,
  onChange,
  opciones,
  placeholder,
  deshabilitado = false,
  className = '',
}) {
  const id = useId();

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {etiqueta && (
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-tinta-3">
          {etiqueta}
        </label>
      )}
      <select
        id={id}
        value={valor ?? ''}
        disabled={deshabilitado}
        onChange={(evento) => onChange(evento.target.value)}
        className="w-full rounded-xl border border-borde-suave bg-superficie/80 px-3 py-2 text-sm
          text-tinta transition-colors hover:border-borde focus:border-acento
          disabled:cursor-not-allowed disabled:opacity-50"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {opciones.map((opcion) => (
          <option key={opcion.valor ?? opcion} value={opcion.valor ?? opcion}>
            {opcion.etiqueta ?? opcion}
          </option>
        ))}
      </select>
    </div>
  );
}
