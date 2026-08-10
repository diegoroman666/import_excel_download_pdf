'use client';

/**
 * Fondo animado en `<canvas>`.
 *
 * Combina tres capas: manchas de color a la deriva, una malla de partículas que
 * se enlazan al acercarse y un ligero desplazamiento por scroll (parallax).
 *
 * Decisiones de rendimiento:
 *  - Un único `requestAnimationFrame` para todo el fondo.
 *  - La densidad de partículas se calcula a partir del área real del viewport.
 *  - La animación se detiene cuando la pestaña deja de estar visible.
 *  - Con `prefers-reduced-motion` se pinta un único fotograma estático.
 */

import { useEffect, useRef } from 'react';

const MANCHAS = [
  { color: [45, 212, 191], radio: 0.42, velocidad: 0.000045, fase: 0 },
  { color: [167, 139, 250], radio: 0.38, velocidad: 0.000062, fase: 2.1 },
  { color: [56, 189, 248], radio: 0.32, velocidad: 0.000038, fase: 4.2 },
];

const DENSIDAD_PARTICULAS = 1 / 16000; // partículas por píxel CSS
const MAX_PARTICULAS = 110;
const DISTANCIA_ENLACE = 132;

export default function FondoAnimado() {
  const lienzo = useRef(null);

  useEffect(() => {
    const canvas = lienzo.current;
    if (!canvas) return undefined;

    const contexto = canvas.getContext('2d', { alpha: true });
    if (!contexto) return undefined;

    const preferenciaMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animacion = 0;
    let particulas = [];
    let ancho = 0;
    let alto = 0;
    let desplazamiento = 0;

    const redimensionar = () => {
      const proporcion = Math.min(window.devicePixelRatio || 1, 2);
      ancho = canvas.clientWidth;
      alto = canvas.clientHeight;
      canvas.width = Math.floor(ancho * proporcion);
      canvas.height = Math.floor(alto * proporcion);
      contexto.setTransform(proporcion, 0, 0, proporcion, 0, 0);

      const cantidad = Math.min(MAX_PARTICULAS, Math.round(ancho * alto * DENSIDAD_PARTICULAS));
      particulas = Array.from({ length: cantidad }, () => ({
        x: Math.random() * ancho,
        y: Math.random() * alto,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        radio: Math.random() * 1.4 + 0.5,
      }));
    };

    const dibujarManchas = (tiempo) => {
      for (const mancha of MANCHAS) {
        const angulo = tiempo * mancha.velocidad + mancha.fase;
        const x = ancho * (0.5 + 0.32 * Math.cos(angulo));
        const y = alto * (0.45 + 0.28 * Math.sin(angulo * 1.3)) - desplazamiento * 0.12;
        const radio = Math.max(ancho, alto) * mancha.radio;

        const degradado = contexto.createRadialGradient(x, y, 0, x, y, radio);
        const [r, g, b] = mancha.color;
        degradado.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.20)`);
        degradado.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.06)`);
        degradado.addColorStop(1, 'rgba(0, 0, 0, 0)');

        contexto.fillStyle = degradado;
        contexto.fillRect(0, 0, ancho, alto);
      }
    };

    const dibujarParticulas = (avanzar) => {
      const desfase = desplazamiento * 0.05;

      for (const particula of particulas) {
        if (avanzar) {
          particula.x += particula.vx;
          particula.y += particula.vy;

          // Rebote suave en los bordes para mantener la malla homogénea.
          if (particula.x < 0 || particula.x > ancho) particula.vx *= -1;
          if (particula.y < 0 || particula.y > alto) particula.vy *= -1;
        }

        contexto.beginPath();
        contexto.arc(particula.x, particula.y - desfase, particula.radio, 0, Math.PI * 2);
        contexto.fillStyle = 'rgba(182, 192, 228, 0.32)';
        contexto.fill();
      }

      for (let i = 0; i < particulas.length; i += 1) {
        for (let j = i + 1; j < particulas.length; j += 1) {
          const dx = particulas[i].x - particulas[j].x;
          const dy = particulas[i].y - particulas[j].y;
          const distancia = Math.hypot(dx, dy);
          if (distancia > DISTANCIA_ENLACE) continue;

          contexto.beginPath();
          contexto.moveTo(particulas[i].x, particulas[i].y - desfase);
          contexto.lineTo(particulas[j].x, particulas[j].y - desfase);
          contexto.strokeStyle = `rgba(45, 212, 191, ${0.14 * (1 - distancia / DISTANCIA_ENLACE)})`;
          contexto.lineWidth = 0.7;
          contexto.stroke();
        }
      }
    };

    const pintar = (tiempo, avanzar = true) => {
      contexto.clearRect(0, 0, ancho, alto);
      dibujarManchas(tiempo);
      dibujarParticulas(avanzar);
    };

    const bucle = (tiempo) => {
      pintar(tiempo);
      animacion = requestAnimationFrame(bucle);
    };

    const detener = () => {
      cancelAnimationFrame(animacion);
      animacion = 0;
    };

    const arrancar = () => {
      if (animacion || preferenciaMovimiento.matches) return;
      animacion = requestAnimationFrame(bucle);
    };

    const alCambiarVisibilidad = () => {
      if (document.hidden) detener();
      else arrancar();
    };

    const alDesplazar = () => {
      desplazamiento = window.scrollY;
    };

    const alCambiarPreferencia = () => {
      detener();
      if (preferenciaMovimiento.matches) pintar(0, false);
      else arrancar();
    };

    const alRedimensionar = () => {
      redimensionar();
      if (preferenciaMovimiento.matches) pintar(0, false);
    };

    redimensionar();
    if (preferenciaMovimiento.matches) pintar(0, false);
    else arrancar();

    window.addEventListener('resize', alRedimensionar);
    window.addEventListener('scroll', alDesplazar, { passive: true });
    document.addEventListener('visibilitychange', alCambiarVisibilidad);
    preferenciaMovimiento.addEventListener('change', alCambiarPreferencia);

    return () => {
      detener();
      window.removeEventListener('resize', alRedimensionar);
      window.removeEventListener('scroll', alDesplazar);
      document.removeEventListener('visibilitychange', alCambiarVisibilidad);
      preferenciaMovimiento.removeEventListener('change', alCambiarPreferencia);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Base sólida: el lienzo dibuja sobre ella con transparencia. */}
      <div className="absolute inset-0 bg-abismo" />
      <canvas ref={lienzo} className="absolute inset-0 size-full" />
      {/* Rejilla técnica y viñeta para dar profundidad. */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(36, 45, 82, 0.35) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(36, 45, 82, 0.35) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, #000 30%, transparent 75%)',
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,transparent_35%,var(--color-abismo)_88%)]" />
    </div>
  );
}
