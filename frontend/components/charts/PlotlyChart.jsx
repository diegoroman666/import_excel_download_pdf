'use client';

/**
 * Envoltorio propio sobre `plotly.js`.
 *
 * Se carga la librería de forma diferida (sólo en cliente y sólo cuando hay un
 * gráfico que dibujar), lo que evita el problema de SSR de `react-plotly.js` y
 * reduce el JavaScript inicial en unos 3 MB. Los redibujados usan
 * `Plotly.react`, que reutiliza el lienzo existente en lugar de recrearlo.
 */

import { useEffect, useRef, useState } from 'react';
import { CONFIG_BASE } from './theme';

let plotlyPromesa = null;

/** Carga `plotly.js` una sola vez y comparte la promesa entre instancias. */
function cargarPlotly() {
  if (!plotlyPromesa) {
    plotlyPromesa = import('plotly.js-dist-min').then((modulo) => modulo.default || modulo);
  }
  return plotlyPromesa;
}

export default function PlotlyChart({ data, layout, config, altura = 420, etiqueta }) {
  const contenedor = useRef(null);
  const plotly = useRef(null);
  // El primer dibujo debe completarse antes de aceptar redimensionados.
  const dibujado = useRef(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  // Dibujo y redibujado.
  useEffect(() => {
    let cancelado = false;
    const nodo = contenedor.current;
    if (!nodo) return undefined;

    cargarPlotly()
      .then((Plotly) => {
        if (cancelado || !contenedor.current) return;
        plotly.current = Plotly;
        return Plotly.react(nodo, data, layout, { ...CONFIG_BASE, ...config });
      })
      .then(() => {
        if (!cancelado) {
          dibujado.current = true;
          setCargando(false);
          setError(null);
        }
      })
      .catch((causa) => {
        if (cancelado) return;
        setCargando(false);
        setError(causa?.message || 'No se pudo dibujar el gráfico.');
      });

    return () => {
      cancelado = true;
    };
  }, [data, layout, config]);

  // El gráfico vive dentro de paneles redimensionables: se reajusta al ancho
  // real del contenedor, no al de la ventana.
  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo || typeof ResizeObserver === 'undefined') return undefined;

    let pendiente = 0;
    const observador = new ResizeObserver(() => {
      cancelAnimationFrame(pendiente);
      pendiente = requestAnimationFrame(() => {
        const actual = contenedor.current;
        if (!plotly.current || !actual || !actual.isConnected) return;

        // `ResizeObserver` emite una primera medición en cuanto se observa el
        // nodo, que puede llegar antes de que termine el dibujo inicial.
        // Redimensionar un gráfico a medio construir deja ejes sin rango y
        // Plotly genera rutas SVG con NaN.
        if (!dibujado.current) return;

        // Lo mismo ocurre si el contenedor está colapsado (por ejemplo,
        // mientras una sección aún se está revelando).
        if (actual.clientWidth < 1 || actual.clientHeight < 1) return;

        plotly.current.Plots.resize(actual);
      });
    });

    observador.observe(nodo);
    return () => {
      cancelAnimationFrame(pendiente);
      observador.disconnect();
    };
  }, []);

  // Libera el lienzo y sus listeners al desmontar.
  useEffect(() => {
    const nodo = contenedor.current;
    return () => {
      if (plotly.current && nodo) plotly.current.purge(nodo);
    };
  }, []);

  return (
    <div className="relative w-full" style={{ height: altura }}>
      <div
        ref={contenedor}
        className="h-full w-full"
        role="img"
        aria-label={etiqueta || 'Gráfico de datos'}
        data-testid="lienzo-grafico"
      />

      {cargando && !error && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-abismo/40">
          <div className="flex items-center gap-3 text-sm text-tinta-3">
            <span className="animar-girar inline-block size-4 rounded-full border-2 border-borde border-t-acento" />
            Preparando el gráfico…
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center">
          <p className="text-sm text-rojo">{error}</p>
        </div>
      )}
    </div>
  );
}
