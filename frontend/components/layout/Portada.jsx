'use client';

/** Portada: presenta el producto y lleva a la zona de carga. */

import Capa3D from '../scroll3d/Capa3D';
import TarjetaTilt from '../scroll3d/TarjetaTilt';
import { META_TIPOS, TIPOS_VARIABLE } from '@/lib/constants';
import Icono from '../ui/Icono';

const CAPACIDADES = [
  {
    icono: 'capas',
    titulo: 'Clasificación automática',
    texto: 'Identifica si cada columna es nominal, ordinal, discreta o continua, y explica por qué.',
  },
  {
    icono: 'filtro',
    titulo: 'Filtros reactivos',
    texto: 'Segmentaciones por columna que recalculan métricas y gráficos al instante.',
  },
  {
    icono: 'barras',
    titulo: 'Doce visualizaciones',
    texto: 'Barras, circular, histograma, cajas, correlación, regresión y seis más.',
  },
  {
    icono: 'escudo',
    titulo: 'Control de calidad',
    texto: 'Valida los valores contra catálogos de referencia y detecta inconsistencias.',
  },
];

const TIPOS = [
  TIPOS_VARIABLE.NOMINAL,
  TIPOS_VARIABLE.ORDINAL,
  TIPOS_VARIABLE.DISCRETA,
  TIPOS_VARIABLE.CONTINUA,
];

export default function Portada() {
  return (
    <section id="inicio" className="escena-3d relative flex min-h-[88vh] flex-col justify-center pt-24">
      <Capa3D giro={6} profundidad={90}>
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-borde-suave
            bg-superficie/60 px-3 py-1 text-xs text-tinta-3">
            <span className="size-1.5 animate-pulse rounded-full bg-acento" />
            Motor de análisis sobre Python · Pandas
          </span>

          <h1 className="mt-6 text-4xl font-bold leading-[1.1] sm:text-6xl">
            <span className="texto-degradado">Procesador inteligente</span>
            <br />
            <span className="text-tinta">de datos</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base text-tinta-2 sm:text-lg">
            Suba un Excel o un CSV y obtenga, en un solo paso, la clasificación estadística de cada
            variable, un dashboard con filtros reactivos y un informe descargable.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="#cargar"
              className="inline-flex items-center gap-2 rounded-xl bg-acento px-6 py-3 text-sm
                font-semibold text-abismo transition-all hover:bg-acento-2
                hover:shadow-[0_14px_40px_-16px_var(--color-acento)]"
            >
              <Icono nombre="subir" tamano={18} />
              Empezar a analizar
            </a>
            <a
              href="#descargas"
              className="inline-flex items-center gap-2 rounded-xl border border-borde px-6 py-3
                text-sm text-tinta-2 transition-colors hover:border-acento/60 hover:text-acento"
            >
              <Icono nombre="descargar" tamano={18} />
              Descargar datos de muestra
            </a>
          </div>

          {/* Los cuatro tipos que el motor distingue. */}
          <ul className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {TIPOS.map((tipo) => (
              <li
                key={tipo}
                className="rounded-lg border px-2.5 py-1 text-[11px]"
                style={{
                  color: META_TIPOS[tipo].color,
                  borderColor: `color-mix(in oklab, ${META_TIPOS[tipo].color} 30%, transparent)`,
                  backgroundColor: `color-mix(in oklab, ${META_TIPOS[tipo].color} 8%, transparent)`,
                }}
              >
                {tipo}
              </li>
            ))}
          </ul>
        </div>
      </Capa3D>

      <Capa3D className="mt-16" giro={11} profundidad={160}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPACIDADES.map((capacidad) => (
            <li key={capacidad.titulo}>
              <TarjetaTilt intensidad={7} className="vidrio h-full rounded-carta p-5">
                <div className="elevar-contenido">
                  <span className="grid size-10 place-items-center rounded-xl bg-acento/10 text-acento">
                    <Icono nombre={capacidad.icono} tamano={19} />
                  </span>
                  <h3 className="mt-3.5 text-sm font-semibold text-tinta">{capacidad.titulo}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-tinta-3">{capacidad.texto}</p>
                </div>
              </TarjetaTilt>
            </li>
          ))}
        </ul>
      </Capa3D>

      <div className="mt-14 flex justify-center">
        <a
          href="#cargar"
          aria-label="Ir a la zona de carga"
          className="animar-flotar text-tinta-3 transition-colors hover:text-acento"
        >
          <Icono nombre="chevron" tamano={26} className="rotate-90" />
        </a>
      </div>
    </section>
  );
}
