'use client';

/**
 * Controles de ejes del gráfico activo.
 *
 * Cada tipo de gráfico declara qué ejes necesita (`grafico.ejes`), y aquí se
 * generan sólo esos controles, ofreciendo únicamente columnas compatibles.
 * En la versión original cada gráfico llevaba su propio selector interno y no
 * respetaba la selección del panel; ahora hay una única fuente de verdad.
 */

import { useMemo } from 'react';
import { AGREGACIONES } from '@/lib/aggregate';
import { META_TIPOS } from '@/lib/constants';
import Selector from '../ui/Selector';

/** Columnas admisibles para un eje según su filtro declarado. */
export function columnasCompatibles(columnas, filtro) {
  if (filtro === 'numerica') return columnas.filter((columna) => columna.es_numerica);
  if (filtro === 'categorica') return columnas.filter((columna) => !columna.es_numerica);
  return columnas;
}

function opcionesDe(columnas) {
  return columnas.map((columna) => ({
    valor: columna.nombre,
    etiqueta: `${columna.nombre} · ${META_TIPOS[columna.tipo]?.abreviatura ?? ''}`,
  }));
}

export default function ControlesEjes({ grafico, columnas, seleccion, onCambiar }) {
  const ejes = grafico.ejes ?? {};
  const modoActual = seleccion.modo ?? ejes.modo?.opciones?.[0]?.id;

  const controles = useMemo(() => {
    const lista = [];

    if (ejes.modo) {
      lista.push({
        clave: 'modo',
        etiqueta: ejes.modo.etiqueta,
        opciones: ejes.modo.opciones.map((opcion) => ({
          valor: opcion.id,
          etiqueta: opcion.nombre,
        })),
        valor: modoActual,
        placeholder: undefined,
      });
    }

    for (const clave of ['x', 'y', 'serie']) {
      const eje = ejes[clave];
      if (!eje) continue;
      // Algunos ejes sólo aplican a una lectura concreta del gráfico.
      if (eje.soloModo && eje.soloModo !== modoActual) continue;

      const disponibles = columnasCompatibles(columnas, eje.filtro);
      lista.push({
        clave,
        etiqueta: eje.etiqueta + (eje.requerido ? '' : ' (opcional)'),
        opciones: opcionesDe(disponibles),
        valor: seleccion[clave] ?? '',
        placeholder: eje.requerido ? undefined : '(ninguna)',
        vacio: disponibles.length === 0,
      });
    }

    return lista;
  }, [ejes, columnas, seleccion, modoActual]);

  const mostrarAgregacion =
    ejes.agregacion && Boolean(seleccion.y) && (!ejes.modo || modoActual === 'cruce' || !ejes.x?.soloModo);

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="controles-ejes">
      {controles.map((control) => (
        <Selector
          key={control.clave}
          etiqueta={control.etiqueta}
          valor={control.valor}
          placeholder={control.placeholder}
          opciones={control.opciones}
          deshabilitado={control.vacio}
          onChange={(valor) => onCambiar(control.clave, valor || '')}
        />
      ))}

      {mostrarAgregacion && (
        <Selector
          etiqueta="Agregación"
          valor={seleccion.agregacion}
          opciones={AGREGACIONES.map((opcion) => ({ valor: opcion.id, etiqueta: opcion.nombre }))}
          onChange={(valor) => onCambiar('agregacion', valor)}
        />
      )}

      {ejes.clases && (
        <Selector
          etiqueta="Nº de clases"
          valor={String(seleccion.clases ?? '')}
          placeholder="Automático (Sturges)"
          opciones={[5, 7, 10, 12, 15, 20, 30].map((n) => ({ valor: String(n), etiqueta: `${n} clases` }))}
          onChange={(valor) => onCambiar('clases', valor ? Number(valor) : null)}
        />
      )}

      {ejes.normalizar && (
        <label className="flex items-end gap-2 pb-2 text-xs text-tinta-2">
          <input
            type="checkbox"
            checked={Boolean(seleccion.normalizar)}
            onChange={(evento) => onCambiar('normalizar', evento.target.checked)}
            className="size-4 accent-[var(--color-acento)]"
          />
          Mostrar como 100 %
        </label>
      )}
    </div>
  );
}
