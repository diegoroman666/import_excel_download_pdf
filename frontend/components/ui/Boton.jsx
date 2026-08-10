/** Botón con variantes de énfasis. */

import Icono from './Icono';

const VARIANTES = {
  principal:
    'bg-acento text-abismo hover:bg-acento-2 shadow-[0_10px_30px_-12px_rgba(45,212,191,0.7)] font-semibold',
  secundario: 'vidrio-sutil text-tinta hover:border-acento/60 hover:text-acento',
  fantasma: 'text-tinta-2 hover:text-acento hover:bg-superficie/60',
  peligro: 'border border-rojo/40 text-rojo hover:bg-rojo/10',
};

const TAMANOS = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2.5 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2.5',
};

export default function Boton({
  children,
  variante = 'secundario',
  tamano = 'md',
  icono,
  cargando = false,
  className = '',
  type = 'button',
  ...resto
}) {
  return (
    <button
      type={type}
      disabled={cargando || resto.disabled}
      className={`inline-flex items-center justify-center rounded-xl transition-all duration-200
        disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]
        ${VARIANTES[variante]} ${TAMANOS[tamano]} ${className}`}
      {...resto}
    >
      {cargando ? (
        <span className="animar-girar inline-block size-4 rounded-full border-2 border-current/30 border-t-current" />
      ) : (
        icono && <Icono nombre={icono} tamano={tamano === 'sm' ? 14 : 18} />
      )}
      {children}
    </button>
  );
}
