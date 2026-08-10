'use client';

/**
 * Devuelve el identificador de la sección visible para resaltarla en la
 * navegación. Usa `IntersectionObserver` con una banda estrecha centrada en el
 * viewport, de modo que la sección activa cambia cuando realmente domina la
 * pantalla.
 */

import { useEffect, useState } from 'react';

export default function useSeccionActiva(identificadores, { activo = true } = {}) {
  const [activa, setActiva] = useState(identificadores[0]);
  const clave = identificadores.join('|');

  useEffect(() => {
    if (!activo) return undefined;

    const ids = clave.split('|');
    const nodos = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    if (!nodos.length) return undefined;

    const visibles = new Map();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          visibles.set(entrada.target.id, entrada.isIntersecting ? entrada.intersectionRatio : 0);
        }

        let mejor = null;
        let mayor = 0;
        for (const [id, proporcion] of visibles) {
          if (proporcion > mayor) {
            mayor = proporcion;
            mejor = id;
          }
        }
        if (mejor) setActiva(mejor);
      },
      { rootMargin: '-35% 0px -45% 0px', threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    nodos.forEach((nodo) => observador.observe(nodo));
    return () => observador.disconnect();
  }, [clave, activo]);

  return activa;
}
