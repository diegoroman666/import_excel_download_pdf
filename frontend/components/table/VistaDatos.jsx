'use client';

/**
 * Vista tabular de los datos filtrados.
 *
 * Pagina en cliente y ordena por cualquier columna. Reemplaza a la cuadrícula
 * editable original: la edición de celdas se retiró porque los cálculos ahora
 * los hace el backend sobre el archivo cargado, y permitir ediciones locales
 * dejaría las métricas del servidor describiendo datos distintos a los que se
 * ven en pantalla.
 */

import { useMemo, useState } from 'react';
import { META_TIPOS } from '@/lib/constants';
import { celda, entero } from '@/lib/format';
import EstadoVacio from '../ui/EstadoVacio';
import Icono from '../ui/Icono';
import Selector from '../ui/Selector';

const TAMANOS_PAGINA = [25, 50, 100, 250];

export default function VistaDatos({ filas, columnas, columnasOrden }) {
  const [pagina, setPagina] = useState(0);
  const [porPagina, setPorPagina] = useState(25);
  const [orden, setOrden] = useState({ columna: null, ascendente: true });

  const nombres = columnasOrden?.length
    ? columnasOrden
    : columnas.map((columna) => columna.nombre);

  const metaPorNombre = useMemo(
    () => Object.fromEntries(columnas.map((columna) => [columna.nombre, columna])),
    [columnas],
  );

  const ordenadas = useMemo(() => {
    if (!orden.columna) return filas;

    const numerica = metaPorNombre[orden.columna]?.es_numerica;
    const factor = orden.ascendente ? 1 : -1;

    return [...filas].sort((a, b) => {
      const valorA = a[orden.columna];
      const valorB = b[orden.columna];

      // Los vacíos van siempre al final, con independencia del sentido.
      const vacioA = valorA === null || valorA === undefined || valorA === '';
      const vacioB = valorB === null || valorB === undefined || valorB === '';
      if (vacioA && vacioB) return 0;
      if (vacioA) return 1;
      if (vacioB) return -1;

      if (numerica) return (Number(valorA) - Number(valorB)) * factor;
      return String(valorA).localeCompare(String(valorB), 'es', { numeric: true }) * factor;
    });
  }, [filas, orden, metaPorNombre]);

  const totalPaginas = Math.max(1, Math.ceil(ordenadas.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas - 1);
  const visibles = ordenadas.slice(paginaActual * porPagina, (paginaActual + 1) * porPagina);

  const alternarOrden = (columna) => {
    setOrden((previo) =>
      previo.columna === columna
        ? { columna, ascendente: !previo.ascendente }
        : { columna, ascendente: true },
    );
    setPagina(0);
  };

  if (!filas.length) {
    return (
      <EstadoVacio icono="tabla" titulo="Sin filas que mostrar">
        Ninguna fila supera los filtros activos.
      </EstadoVacio>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-xl border border-borde-suave">
        <table className="w-full text-sm" data-testid="tabla-datos">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-borde bg-superficie">
              <th scope="col" className="w-12 px-3 py-2.5 text-left text-[11px] text-tinta-3">
                #
              </th>
              {nombres.map((nombre) => {
                const meta = META_TIPOS[metaPorNombre[nombre]?.tipo];
                const activa = orden.columna === nombre;
                return (
                  <th key={nombre} scope="col" className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => alternarOrden(nombre)}
                      className="group flex w-full items-center gap-1.5 text-left"
                      title={`Ordenar por ${nombre}`}
                    >
                      <span className="truncate text-xs font-semibold text-tinta">{nombre}</span>
                      {meta && (
                        <span
                          className="shrink-0 rounded px-1 text-[9px] font-semibold"
                          style={{
                            color: meta.color,
                            backgroundColor: `color-mix(in oklab, ${meta.color} 12%, transparent)`,
                          }}
                        >
                          {meta.abreviatura}
                        </span>
                      )}
                      <Icono
                        nombre="chevron"
                        tamano={11}
                        className={`ml-auto shrink-0 transition-all ${
                          activa
                            ? `text-acento ${orden.ascendente ? '-rotate-90' : 'rotate-90'}`
                            : 'text-tinta-3 opacity-0 group-hover:opacity-60'
                        }`}
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibles.map((fila, indice) => (
              <tr
                key={paginaActual * porPagina + indice}
                className="border-b border-borde-suave/40 transition-colors last:border-0 hover:bg-superficie/40"
              >
                <td className="px-3 py-1.5 text-[11px] tabular-nums text-tinta-3">
                  {paginaActual * porPagina + indice + 1}
                </td>
                {nombres.map((nombre) => {
                  const valor = fila[nombre];
                  const vacio = valor === null || valor === undefined || valor === '';
                  return (
                    <td
                      key={nombre}
                      className={`whitespace-nowrap px-3 py-1.5 ${
                        vacio
                          ? 'text-tinta-3/50'
                          : metaPorNombre[nombre]?.es_numerica
                            ? 'tabular-nums text-tinta-2'
                            : 'text-tinta-2'
                      }`}
                    >
                      {celda(valor)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-tinta-3">
          Mostrando {entero(paginaActual * porPagina + 1)}–
          {entero(Math.min((paginaActual + 1) * porPagina, ordenadas.length))} de{' '}
          {entero(ordenadas.length)} filas
        </p>

        <div className="flex items-center gap-3">
          <Selector
            valor={String(porPagina)}
            opciones={TAMANOS_PAGINA.map((n) => ({ valor: String(n), etiqueta: `${n} / página` }))}
            onChange={(valor) => {
              setPorPagina(Number(valor));
              setPagina(0);
            }}
            className="w-32"
          />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(0, p - 1))}
              disabled={paginaActual === 0}
              aria-label="Página anterior"
              className="rounded-lg border border-borde-suave p-1.5 text-tinta-2 transition-colors
                hover:border-acento hover:text-acento disabled:opacity-40"
            >
              <Icono nombre="chevron" tamano={14} className="rotate-180" />
            </button>
            <span className="min-w-20 text-center text-xs tabular-nums text-tinta-3">
              {paginaActual + 1} / {totalPaginas}
            </span>
            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
              disabled={paginaActual >= totalPaginas - 1}
              aria-label="Página siguiente"
              className="rounded-lg border border-borde-suave p-1.5 text-tinta-2 transition-colors
                hover:border-acento hover:text-acento disabled:opacity-40"
            >
              <Icono nombre="chevron" tamano={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
