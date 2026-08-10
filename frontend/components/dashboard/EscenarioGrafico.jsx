'use client';

/** Lienzo del gráfico activo: construye la especificación y la dibuja. */

import { useMemo } from 'react';
import PlotlyChart from '../charts/PlotlyChart';
import EstadoVacio from '../ui/EstadoVacio';
import Icono from '../ui/Icono';

export default function EscenarioGrafico({ grafico, filas, seleccion, columnas, altura = 460 }) {
  // Se memoriza sobre una cadena estable: el informe del backend devuelve un
  // array nuevo en cada sincronización aunque el esquema no haya cambiado, y
  // eso obligaría a redibujar el gráfico sin motivo.
  const clavesNumericas = columnas
    .filter((columna) => columna.es_numerica)
    .map((columna) => columna.nombre)
    .join('|');

  const columnasNumericas = useMemo(
    () => (clavesNumericas ? clavesNumericas.split('|') : []),
    [clavesNumericas],
  );

  const ordenCategorias = useMemo(() => {
    const columna = columnas.find((c) => c.nombre === seleccion.x);
    return columna?.escala_orden?.length ? columna.escala_orden : null;
  }, [columnas, seleccion.x]);

  const especificacion = useMemo(() => {
    try {
      return grafico.construir({
        filas,
        columnasNumericas,
        ordenCategorias,
        ...seleccion,
      });
    } catch (causa) {
      // Un fallo al construir un gráfico no debe tumbar el dashboard entero.
      return { vacio: `No se pudo construir el gráfico: ${causa.message}` };
    }
  }, [grafico, filas, seleccion, columnasNumericas, ordenCategorias]);

  if (especificacion.vacio) {
    return (
      <EstadoVacio icono={grafico.icono} titulo="Ajuste la configuración" altura="py-20">
        {especificacion.vacio}
      </EstadoVacio>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* La clave fuerza un lienzo nuevo por tipo de gráfico: así ninguna
          configuración de ejes del gráfico anterior (por ejemplo el segundo eje
          del mixto) sobrevive al cambio. */}
      <PlotlyChart
        key={grafico.id}
        data={especificacion.data}
        layout={especificacion.layout}
        altura={altura}
        etiqueta={`${grafico.nombre}: ${grafico.descripcion}`}
      />

      {especificacion.nota && (
        <p className="flex items-start gap-2 text-[11px] text-tinta-3">
          <Icono nombre="info" tamano={13} className="mt-0.5 shrink-0" />
          {especificacion.nota}
        </p>
      )}
    </div>
  );
}
