/** Contenedor de sección con título y profundidad 3D al desplazarse. */

import Capa3D from '../scroll3d/Capa3D';
import Icono from '../ui/Icono';

export default function Seccion({
  id,
  titulo,
  descripcion,
  icono,
  numero,
  acciones,
  children,
  className = '',
}) {
  return (
    <section id={id} className={`escena-3d scroll-mt-24 ${className}`}>
      <Capa3D>
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-start gap-4">
            {icono && (
              <span className="relative grid size-12 shrink-0 place-items-center rounded-xl bg-acento/10 text-acento">
                <Icono nombre={icono} tamano={22} />
                {numero && (
                  <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center
                    rounded-full bg-acento text-[10px] font-bold text-abismo">
                    {numero}
                  </span>
                )}
              </span>
            )}
            <div>
              <h2 className="text-xl font-bold text-tinta sm:text-2xl">{titulo}</h2>
              {descripcion && (
                <p className="mt-1 max-w-2xl text-sm text-tinta-3">{descripcion}</p>
              )}
            </div>
          </div>
          {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
        </header>

        {children}
      </Capa3D>
    </section>
  );
}
