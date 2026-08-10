/** Estado vacío con explicación de qué hacer a continuación. */

import Icono from './Icono';

export default function EstadoVacio({ icono = 'info', titulo, children, altura = 'py-14' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${altura}`}>
      <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-superficie text-tinta-3">
        <Icono nombre={icono} tamano={26} />
      </span>
      {titulo && <p className="text-sm font-semibold text-tinta-2">{titulo}</p>}
      {children && <p className="mt-1.5 max-w-md text-sm text-tinta-3">{children}</p>}
    </div>
  );
}
