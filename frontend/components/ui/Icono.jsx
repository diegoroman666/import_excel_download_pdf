/**
 * Iconografía en SVG en línea.
 *
 * Se define aquí en lugar de instalar una librería de iconos: son pocos trazos,
 * heredan `currentColor` y no añaden peso ni una dependencia más al bundle.
 */

const TRAZOS = {
  subir: 'M12 16V4m0 0L7 9m5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  archivo: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5',
  barras: 'M4 20V10m5 10V4m5 16v-7m5 7V7',
  circular: 'M12 3a9 9 0 1 0 9 9h-9z M12 3v9h9A9 9 0 0 0 12 3',
  histograma: 'M4 20V13m4 7V8m4 12V5m4 15v-9m4 9v-5',
  lineas: 'M4 16l4-5 4 3 4-7 4 4',
  dispersion: 'M6 17a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M11 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M16 16a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M18 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3',
  area: 'M4 17l5-6 4 3 6-8v13H4z',
  radar: 'M12 3l8 6-3 10H7L4 9zM12 3v18M4 9h16',
  stacked: 'M5 20v-5h4v5zM5 15v-4h4v4zM15 20v-8h4v8zM15 12V8h4v4z',
  mixto: 'M4 20V12h3v8zm6 0V8h3v12zm6 0v-6h3v6zM4 9l6-4 6 3 4-3',
  cajas: 'M9 5v14M15 5v14M9 8h6M9 16h6M12 3v2M12 19v2',
  heatmap: 'M4 4h5v5H4zM10 4h5v5h-5zM16 4h4v5h-4zM4 10h5v5H4zM10 10h5v5h-5zM16 10h4v5h-4zM4 16h5v4H4zM10 16h5v4h-5zM16 16h4v4h-4z',
  regresion: 'M4 20L20 6M5 17a1 1 0 1 0 0-2 1 1 0 0 0 0 2M10 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2M15 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  filtro: 'M3 5h18l-7 8v6l-4 2v-8z',
  descargar: 'M12 4v12m0 0 5-5m-5 5-5-5M4 20h16',
  excel: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5M9 12l5 6m0-6-5 6',
  csv: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5M8 17h8M8 14h8',
  pdf: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zm0 0v5h5M9 17v-4h1.5a1.5 1.5 0 0 1 0 3H9m5 1v-4h2',
  escudo: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  tabla: 'M4 5h16v14H4zM4 10h16M10 10v9',
  calculadora: 'M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01',
  diana: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2',
  balanza: 'M12 4v16M7 20h10M12 7l-6 2 3 5a3 3 0 0 0 6 0zm0 0 6 2-3 5a3 3 0 0 1-6 0z',
  alerta: 'M12 4l9 16H3zM12 10v4M12 17h.01',
  check: 'M4 13l5 5L20 7',
  cerrar: 'M6 6l12 12M18 6L6 18',
  chevron: 'M9 6l6 6-6 6',
  buscar: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16M21 21l-4.5-4.5',
  rayo: 'M13 3L5 14h6l-1 7 8-11h-6z',
  capas: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  reiniciar: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 11v5M12 8h.01',
  ojo: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
};

export default function Icono({ nombre, tamano = 20, className = '', ...resto }) {
  const trazo = TRAZOS[nombre];
  if (!trazo) return null;

  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...resto}
    >
      <path d={trazo} />
    </svg>
  );
}

export const NOMBRES_ICONO = Object.keys(TRAZOS);
