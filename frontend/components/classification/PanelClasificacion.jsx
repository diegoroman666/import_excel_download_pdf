'use client';

/**
 * Ficha de clasificación de variables.
 *
 * Para cada columna muestra el tipo estadístico detectado, el grado de
 * confianza y la razón concreta por la que el motor decidió ese tipo, de modo
 * que el usuario pueda auditar el resultado en lugar de aceptarlo a ciegas.
 */

import { useMemo, useState } from 'react';
import { META_ROLES, META_TIPOS, TIPOS_VARIABLE } from '@/lib/constants';
import { capitalizar, entero, numero, porcentajeDirecto } from '@/lib/format';
import EstadoVacio from '../ui/EstadoVacio';
import Icono from '../ui/Icono';
import Insignia from '../ui/Insignia';
import TarjetaTilt from '../scroll3d/TarjetaTilt';

const ORDEN_TIPOS = [
  TIPOS_VARIABLE.NOMINAL,
  TIPOS_VARIABLE.ORDINAL,
  TIPOS_VARIABLE.DISCRETA,
  TIPOS_VARIABLE.CONTINUA,
];

function BarraConfianza({ valor }) {
  const porcentaje = Math.round(valor * 100);
  const tono = valor >= 0.85 ? 'var(--color-lima)' : valor >= 0.6 ? 'var(--color-ambar)' : 'var(--color-rojo)';

  return (
    <div className="flex items-center gap-2" title={`Confianza de la detección: ${porcentaje} %`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-superficie-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${porcentaje}%`, backgroundColor: tono }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-tinta-3">{porcentaje} %</span>
    </div>
  );
}

function ResumenColumna({ columna }) {
  const resumen = columna.resumen_numerico;

  if (resumen) {
    return (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-tinta-3">Media</dt>
          <dd className="tabular-nums text-tinta-2">{numero(resumen.media, { corto: true })}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-tinta-3">Mediana</dt>
          <dd className="tabular-nums text-tinta-2">{numero(resumen.mediana, { corto: true })}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-tinta-3">Mínimo</dt>
          <dd className="tabular-nums text-tinta-2">{numero(resumen.minimo, { corto: true })}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-tinta-3">Máximo</dt>
          <dd className="tabular-nums text-tinta-2">{numero(resumen.maximo, { corto: true })}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-tinta-3">Desv. est.</dt>
          <dd className="tabular-nums text-tinta-2">
            {numero(resumen.desviacion_estandar, { corto: true })}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-tinta-3">Atípicos</dt>
          <dd className="tabular-nums text-tinta-2">{entero(resumen.atipicos)}</dd>
        </div>
      </dl>
    );
  }

  if (columna.top_categorias?.length) {
    return (
      <ul className="flex flex-col gap-1.5">
        {columna.top_categorias.slice(0, 4).map((categoria) => (
          <li key={categoria.valor} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-tinta-2" title={categoria.valor}>
              {categoria.valor}
            </span>
            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-superficie-2">
              <div
                className="h-full rounded-full bg-acento/70"
                style={{ width: `${Math.round(categoria.frecuencia_relativa * 100)}%` }}
              />
            </div>
            <span className="w-10 text-right tabular-nums text-tinta-3">
              {porcentajeDirecto(categoria.frecuencia_relativa * 100, { decimales: 0 })}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  return <p className="text-xs text-tinta-3">Sin valores para resumir.</p>;
}

function TarjetaColumna({ columna }) {
  const meta = META_TIPOS[columna.tipo];
  const [abierta, setAbierta] = useState(false);

  return (
    <TarjetaTilt
      intensidad={4}
      className="vidrio flex h-full flex-col gap-4 rounded-carta p-4"
      data-testid="tarjeta-columna"
    >
      <div className="elevar-contenido flex flex-col gap-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="truncate font-semibold text-tinta" title={columna.nombre}>
              {columna.nombre}
            </h4>
            <p className="mt-0.5 text-[11px] text-tinta-3">
              {META_ROLES[columna.rol] ?? columna.rol} · {columna.dtype_pandas}
            </p>
          </div>
          <Insignia color={meta?.color} titulo={meta?.descripcion}>
            {meta?.abreviatura}
          </Insignia>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium" style={{ color: meta?.color }}>
            {columna.tipo}
          </span>
          <BarraConfianza valor={columna.confianza} />
        </div>

        {columna.escala_orden?.length > 0 && (
          <div className="flex flex-wrap items-center gap-1">
            {columna.escala_orden.slice(0, 6).map((nivel, indice) => (
              <span key={nivel} className="flex items-center gap-1">
                {indice > 0 && <Icono nombre="chevron" tamano={11} className="text-tinta-3" />}
                <span className="rounded-md bg-superficie-2 px-1.5 py-0.5 text-[10px] text-tinta-2">
                  {capitalizar(nivel)}
                </span>
              </span>
            ))}
            {columna.escala_orden.length > 6 && (
              <span className="text-[10px] text-tinta-3">+{columna.escala_orden.length - 6}</span>
            )}
          </div>
        )}

        <ResumenColumna columna={columna} />

        <footer className="mt-auto flex flex-col gap-2 border-t border-borde-suave pt-3">
          <div className="flex items-center justify-between text-[11px] text-tinta-3">
            <span>{entero(columna.unicos)} valores únicos</span>
            <span className={columna.porcentaje_nulos > 15 ? 'text-ambar' : ''}>
              {porcentajeDirecto(columna.porcentaje_nulos)} vacíos
            </span>
          </div>

          <button
            type="button"
            onClick={() => setAbierta((previo) => !previo)}
            aria-expanded={abierta}
            className="flex items-center gap-1.5 text-left text-[11px] text-tinta-3
              transition-colors hover:text-acento"
          >
            <Icono
              nombre="chevron"
              tamano={12}
              className={`transition-transform ${abierta ? 'rotate-90' : ''}`}
            />
            ¿Por qué este tipo?
          </button>

          {abierta && (
            <p className="animar-aparecer rounded-lg bg-superficie/70 p-2.5 text-[11px] leading-relaxed text-tinta-2">
              {columna.justificacion}
            </p>
          )}
        </footer>
      </div>
    </TarjetaTilt>
  );
}

export default function PanelClasificacion({ columnas }) {
  const [tipoActivo, setTipoActivo] = useState('todos');

  const conteos = useMemo(() => {
    const mapa = Object.fromEntries(ORDEN_TIPOS.map((tipo) => [tipo, 0]));
    for (const columna of columnas) mapa[columna.tipo] = (mapa[columna.tipo] ?? 0) + 1;
    return mapa;
  }, [columnas]);

  const visibles = useMemo(
    () => (tipoActivo === 'todos' ? columnas : columnas.filter((c) => c.tipo === tipoActivo)),
    [columnas, tipoActivo],
  );

  if (!columnas.length) {
    return (
      <EstadoVacio icono="capas" titulo="Sin variables que clasificar">
        Cargue un archivo para que el motor identifique el tipo de cada columna.
      </EstadoVacio>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Leyenda: los cuatro tipos, con su definición y su recuento. */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ORDEN_TIPOS.map((tipo) => {
          const meta = META_TIPOS[tipo];
          const activo = tipoActivo === tipo;
          return (
            <button
              key={tipo}
              type="button"
              onClick={() => setTipoActivo(activo ? 'todos' : tipo)}
              aria-pressed={activo}
              className={`vidrio-sutil rounded-xl p-4 text-left transition-all duration-200
                hover:-translate-y-0.5 ${activo ? 'ring-1 ring-acento' : ''}`}
              style={activo ? { borderColor: meta.color } : undefined}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold" style={{ color: meta.color }}>
                  {tipo}
                </span>
                <span className="text-lg font-bold tabular-nums text-tinta">{conteos[tipo]}</span>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-tinta-3">{meta.descripcion}</p>
              <p className="mt-1 text-[10px] italic text-tinta-3/80">Ej.: {meta.ejemplo}</p>
            </button>
          );
        })}
      </div>

      {tipoActivo !== 'todos' && (
        <div className="flex items-center gap-2 text-xs text-tinta-3">
          <span>Filtrando por «{tipoActivo}»</span>
          <button
            type="button"
            onClick={() => setTipoActivo('todos')}
            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-acento hover:bg-acento/10"
          >
            <Icono nombre="cerrar" tamano={12} /> Ver todas
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visibles.map((columna) => (
          <TarjetaColumna key={columna.nombre} columna={columna} />
        ))}
      </div>
    </div>
  );
}
