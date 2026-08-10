/** Mensaje de error, advertencia o información. */

import Icono from './Icono';

const TONOS = {
  error: { borde: 'border-rojo/40', fondo: 'bg-rojo/10', texto: 'text-rojo', icono: 'alerta' },
  aviso: { borde: 'border-ambar/40', fondo: 'bg-ambar/10', texto: 'text-ambar', icono: 'alerta' },
  info: { borde: 'border-acento-2/40', fondo: 'bg-acento-2/10', texto: 'text-acento-2', icono: 'info' },
  exito: { borde: 'border-lima/40', fondo: 'bg-lima/10', texto: 'text-lima', icono: 'check' },
};

export default function Aviso({ tono = 'info', titulo, children, onCerrar, className = '' }) {
  const estilo = TONOS[tono] ?? TONOS.info;

  return (
    <div
      role={tono === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm
        ${estilo.borde} ${estilo.fondo} ${className}`}
    >
      <Icono nombre={estilo.icono} tamano={18} className={`mt-0.5 shrink-0 ${estilo.texto}`} />
      <div className="min-w-0 flex-1">
        {titulo && <p className={`font-semibold ${estilo.texto}`}>{titulo}</p>}
        <div className="text-tinta-2">{children}</div>
      </div>
      {onCerrar && (
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar aviso"
          className="shrink-0 rounded-lg p-1 text-tinta-3 transition-colors hover:text-tinta"
        >
          <Icono nombre="cerrar" tamano={16} />
        </button>
      )}
    </div>
  );
}
