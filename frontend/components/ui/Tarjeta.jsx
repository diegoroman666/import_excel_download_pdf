/** Contenedor de cristal con cabecera opcional. */

import Icono from './Icono';

export default function Tarjeta({
  titulo,
  descripcion,
  icono,
  acciones,
  children,
  className = '',
  padding = 'p-5 sm:p-6',
}) {
  return (
    <section className={`vidrio rounded-carta ${padding} ${className}`}>
      {(titulo || acciones) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {icono && (
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-acento/10 text-acento">
                <Icono nombre={icono} tamano={20} />
              </span>
            )}
            <div>
              {titulo && <h3 className="text-base font-semibold text-tinta">{titulo}</h3>}
              {descripcion && <p className="mt-1 text-sm text-tinta-3">{descripcion}</p>}
            </div>
          </div>
          {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
