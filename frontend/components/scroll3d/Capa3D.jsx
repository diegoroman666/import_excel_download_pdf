'use client';

/**
 * Capa con profundidad reactiva al scroll.
 *
 * En lugar de animar propiedades desde React (que provocaría un render por
 * fotograma), el componente escribe una única variable CSS `--progreso` sobre
 * el nodo. La transformación 3D vive en la hoja de estilos, de modo que el
 * trabajo recae en el compositor del navegador.
 *
 * `IntersectionObserver` actúa como interruptor: sólo se calcula la posición de
 * los elementos que están en pantalla.
 */

import { useEffect, useRef } from 'react';

export default function Capa3D({
  children,
  as: Etiqueta = 'div',
  giro = 9,
  profundidad = 130,
  className = '',
  ...resto
}) {
  const nodo = useRef(null);

  useEffect(() => {
    const elemento = nodo.current;
    if (!elemento) return undefined;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      elemento.style.setProperty('--progreso', '1');
      elemento.dataset.visible = 'true';
      elemento.dataset.asentada = 'true';
      return undefined;
    }

    let visible = false;
    let pendiente = 0;

    const actualizar = () => {
      pendiente = 0;
      const caja = elemento.getBoundingClientRect();
      const alturaVentana = window.innerHeight || 1;

      // 0 cuando el elemento asoma por abajo, 1 cuando alcanza la zona central.
      const distancia = caja.top - alturaVentana * 0.85;
      const recorrido = alturaVentana * 0.55;
      const progreso = Math.min(1, Math.max(0, 1 - distancia / recorrido));

      elemento.style.setProperty('--progreso', progreso.toFixed(3));

      // Al completarse el recorrido la capa se declara asentada y deja de
      // estar transformada, para que los controles de su interior reciban las
      // pulsaciones donde el usuario los ve. El umbral no es 1: el último
      // tramo de la interpolación es visualmente imperceptible, y adelantar el
      // asentamiento reduce la ventana en la que una pulsación podría caer
      // fuera del control.
      elemento.dataset.asentada = progreso >= 0.9 ? 'true' : 'false';
    };

    const alDesplazar = () => {
      if (!visible || pendiente) return;
      pendiente = requestAnimationFrame(actualizar);
    };

    const observador = new IntersectionObserver(
      ([entrada]) => {
        visible = entrada.isIntersecting;
        elemento.dataset.visible = String(visible);
        if (visible) actualizar();
      },
      { rootMargin: '15% 0px 15% 0px', threshold: 0 },
    );

    observador.observe(elemento);
    actualizar();

    window.addEventListener('scroll', alDesplazar, { passive: true });
    window.addEventListener('resize', alDesplazar);

    return () => {
      cancelAnimationFrame(pendiente);
      observador.disconnect();
      window.removeEventListener('scroll', alDesplazar);
      window.removeEventListener('resize', alDesplazar);
    };
  }, []);

  return (
    <Etiqueta
      ref={nodo}
      className={`capa-3d ${className}`}
      style={{ '--giro': `${giro}deg`, '--profundidad': `${profundidad}px` }}
      {...resto}
    >
      {children}
    </Etiqueta>
  );
}
