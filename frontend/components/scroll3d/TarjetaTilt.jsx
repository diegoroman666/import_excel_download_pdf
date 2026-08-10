'use client';

/**
 * Tarjeta que se inclina siguiendo al puntero.
 *
 * Como en `Capa3D`, el ángulo viaja por variables CSS y se limita a un rango
 * pequeño: un giro exagerado dificulta leer los datos que contiene.
 * El efecto se desactiva en dispositivos táctiles y con movimiento reducido.
 */

import { useCallback, useRef } from 'react';

export default function TarjetaTilt({
  children,
  intensidad = 6,
  className = '',
  ...resto
}) {
  const nodo = useRef(null);
  const pendiente = useRef(0);

  const alMover = useCallback(
    (evento) => {
      const elemento = nodo.current;
      if (!elemento) return;
      if (window.matchMedia('(hover: none), (prefers-reduced-motion: reduce)').matches) return;

      const { clientX, clientY } = evento;
      cancelAnimationFrame(pendiente.current);
      pendiente.current = requestAnimationFrame(() => {
        const caja = elemento.getBoundingClientRect();
        const x = (clientX - caja.left) / caja.width;
        const y = (clientY - caja.top) / caja.height;

        elemento.style.setProperty('--tilt-y', `${(x - 0.5) * intensidad * 2}deg`);
        elemento.style.setProperty('--tilt-x', `${(0.5 - y) * intensidad * 2}deg`);
        elemento.style.setProperty('--brillo-x', `${x * 100}%`);
        elemento.style.setProperty('--brillo-y', `${y * 100}%`);
        elemento.dataset.activa = 'true';
      });
    },
    [intensidad],
  );

  const alSalir = useCallback(() => {
    const elemento = nodo.current;
    if (!elemento) return;
    cancelAnimationFrame(pendiente.current);
    elemento.style.setProperty('--tilt-x', '0deg');
    elemento.style.setProperty('--tilt-y', '0deg');
    elemento.dataset.activa = 'false';
  }, []);

  return (
    <div
      ref={nodo}
      onPointerMove={alMover}
      onPointerLeave={alSalir}
      className={`tarjeta-tilt ${className}`}
      {...resto}
    >
      {children}
    </div>
  );
}
