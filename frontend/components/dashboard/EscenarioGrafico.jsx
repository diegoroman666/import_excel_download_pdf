'use client';

/** Lienzo del gráfico activo: construye la especificación y la dibuja. */

import { useCallback, useMemo, useRef, useState } from 'react';
import PlotlyChart from '../charts/PlotlyChart';
import Boton from '../ui/Boton';
import EstadoVacio from '../ui/EstadoVacio';
import Icono from '../ui/Icono';

/** Nombre de archivo sin caracteres problemáticos en Windows ni en macOS. */
function nombreSeguro(texto) {
  return (texto || 'grafico')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tildes y diéresis ya separadas por NFD
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'grafico';
}

export default function EscenarioGrafico({
  grafico,
  filas,
  seleccion,
  columnas,
  altura = 460,
  nombreArchivo,
}) {
  const lienzo = useRef(null);
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState(null);

  const descargarImagen = useCallback(async () => {
    setDescargando(true);
    setErrorDescarga(null);
    try {
      const partes = [nombreArchivo, grafico.id, seleccion.x, seleccion.y].filter(Boolean);
      await lienzo.current?.descargarImagen(nombreSeguro(partes.join('-')));
    } catch (causa) {
      setErrorDescarga(causa?.message || 'No se pudo generar la imagen.');
    } finally {
      setDescargando(false);
    }
  }, [grafico.id, nombreArchivo, seleccion.x, seleccion.y]);

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
        ref={lienzo}
        key={grafico.id}
        data={especificacion.data}
        layout={especificacion.layout}
        altura={altura}
        etiqueta={`${grafico.nombre}: ${grafico.descripcion}`}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {especificacion.nota ? (
          <p className="flex min-w-0 flex-1 items-start gap-2 text-[11px] text-tinta-3">
            <Icono nombre="info" tamano={13} className="mt-0.5 shrink-0" />
            {especificacion.nota}
          </p>
        ) : (
          <span />
        )}

        <Boton
          tamano="sm"
          variante="secundario"
          icono="descargar"
          cargando={descargando}
          onClick={descargarImagen}
          aria-label="Descargar el gráfico actual como imagen PNG"
          title="Descarga el gráfico tal como se ve ahora, con los filtros aplicados"
          className="shrink-0"
        >
          Descargar gráfico
        </Boton>
      </div>

      {errorDescarga && <p className="text-[11px] text-rojo">{errorDescarga}</p>}
    </div>
  );
}
