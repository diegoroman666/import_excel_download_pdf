'use client';

/** Barra de navegación fija que resalta la sección visible. */

import { SECCIONES } from '@/lib/constants';
import useSeccionActiva from '../scroll3d/useSeccionActiva';
import Icono from '../ui/Icono';

export default function Navegacion({ hayDatos, onReiniciar }) {
  const secciones = hayDatos ? SECCIONES : SECCIONES.slice(0, 2);
  const activa = useSeccionActiva(
    secciones.map((seccion) => seccion.id),
    { activo: true },
  );

  return (
    <header className="sin-impresion fixed inset-x-0 top-0 z-50">
      <div className="vidrio-sutil mx-auto mt-3 flex max-w-7xl items-center gap-3 rounded-2xl px-4 py-2.5">
        <a href="#inicio" className="flex shrink-0 items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-acento/15 text-acento">
            <Icono nombre="rayo" tamano={17} />
          </span>
          <span className="hidden text-sm font-semibold text-tinta sm:block">
            Procesador de Datos
          </span>
        </a>

        <nav aria-label="Secciones" className="min-w-0 flex-1 overflow-x-auto">
          <ul className="flex items-center gap-1">
            {secciones.map((seccion) => {
              const seleccionada = activa === seccion.id;
              return (
                <li key={seccion.id}>
                  <a
                    href={`#${seccion.id}`}
                    aria-current={seleccionada ? 'true' : undefined}
                    className={`block whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs transition-colors
                      ${seleccionada ? 'bg-acento/15 text-acento' : 'text-tinta-3 hover:text-tinta'}`}
                  >
                    {seccion.etiqueta}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {hayDatos && (
          <button
            type="button"
            onClick={onReiniciar}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs text-tinta-3 transition-colors hover:text-rojo"
          >
            <span className="hidden sm:inline">Nuevo análisis</span>
            <Icono nombre="reiniciar" tamano={15} className="sm:hidden" />
          </button>
        )}
      </div>
    </header>
  );
}
