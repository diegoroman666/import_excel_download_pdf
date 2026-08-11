'use client';

/**
 * Página principal.
 *
 * Orquesta el recorrido completo: portada, carga del archivo, clasificación de
 * variables, dashboard reactivo, estadística descriptiva, control de calidad y
 * descargas. Todo el estado vive en `useDataset`.
 */

import { useCallback, useRef } from 'react';
import useDataset from '@/lib/useDataset';
import PanelClasificacion from '@/components/classification/PanelClasificacion';
import PanelHistorial from '@/components/history/PanelHistorial';
import Dashboard from '@/components/dashboard/Dashboard';
import CentroDescargas from '@/components/downloads/CentroDescargas';
import Navegacion from '@/components/layout/Navegacion';
import Portada from '@/components/layout/Portada';
import Seccion from '@/components/layout/Seccion';
import ValidadorConsistencia from '@/components/quality/ValidadorConsistencia';
import PanelEstadistica from '@/components/stats/PanelEstadistica';
import VistaDatos from '@/components/table/VistaDatos';
import Adjuntador from '@/components/upload/Adjuntador';
import Aviso from '@/components/ui/Aviso';
import Tarjeta from '@/components/ui/Tarjeta';

export default function Pagina() {
  const dataset = useDataset();
  const seccionVariables = useRef(null);

  const irAResultados = useCallback(() => {
    requestAnimationFrame(() => {
      seccionVariables.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const alSubir = useCallback(
    async (archivo) => {
      const respuesta = await dataset.subir(archivo);
      // Tras un análisis correcto se lleva al usuario al resultado.
      if (respuesta) irAResultados();
    },
    [dataset, irAResultados],
  );

  const alAbrirDelHistorial = useCallback(
    (respuesta) => {
      dataset.adoptar(respuesta);
      irAResultados();
    },
    [dataset, irAResultados],
  );

  const { metadatos, informe, columnas, filas, filasFiltradas, filtros } = dataset;
  const datasetId = metadatos?.dataset_id;

  return (
    <>
      <Navegacion hayDatos={dataset.hayDatos} onReiniciar={dataset.reiniciar} />

      <main id="contenido" className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6">
        <Portada />

        {/* ---------------------------------------------------------------- */}
        <Seccion
          id="cargar"
          numero="1"
          icono="subir"
          titulo="Adjuntador inteligente"
          descripcion="El archivo se procesa con Pandas: se normalizan encabezados, se infieren tipos y se calcula la estadística de cada columna."
          className="pt-16"
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <Adjuntador
              onArchivo={alSubir}
              subiendo={dataset.subiendo}
              error={dataset.error}
              onLimpiarError={dataset.limpiarError}
              metadatos={metadatos}
            />

            <Tarjeta titulo="Qué ocurre al subir" icono="rayo" padding="p-5">
              <ol className="flex flex-col gap-3 text-sm text-tinta-3">
                {[
                  'Lectura del archivo y limpieza de filas y columnas vacías.',
                  'Inferencia de tipos: números en formato local y fechas.',
                  'Clasificación de cada variable en uno de los cuatro tipos estadísticos.',
                  'Cálculo de descriptivos, frecuencias y correlaciones.',
                ].map((paso, indice) => (
                  <li key={paso} className="flex gap-3">
                    <span className="grid size-5 shrink-0 place-items-center rounded-full
                      bg-acento/15 text-[10px] font-bold text-acento">
                      {indice + 1}
                    </span>
                    {paso}
                  </li>
                ))}
              </ol>
            </Tarjeta>
          </div>

          {dataset.avisos.length > 0 && (
            <div className="mt-5 flex flex-col gap-2">
              {dataset.avisos.map((aviso) => (
                <Aviso key={aviso} tono="info">
                  {aviso}
                </Aviso>
              ))}
            </div>
          )}
        </Seccion>

        {/* ---------------------------------------------------------------- */}
        <Seccion
          id="historial"
          icono="reiniciar"
          titulo="Historial de análisis"
          descripcion="Los archivos que analice quedan guardados en este navegador para volver a abrirlos sin buscarlos de nuevo."
          className="pt-20"
        >
          <Tarjeta padding="p-5 sm:p-6">
            <PanelHistorial
              onAbrirAnalisis={alAbrirDelHistorial}
              recargar={dataset.version}
            />
          </Tarjeta>
        </Seccion>

        {dataset.hayDatos && (
          <>
            {/* ------------------------------------------------------------ */}
            <div ref={seccionVariables}>
              <Seccion
                id="variables"
                numero="2"
                icono="capas"
                titulo="Clasificación de variables"
                descripcion="Cada columna se clasifica como cualitativa (nominal u ordinal) o cuantitativa (discreta o continua), con el motivo de la decisión."
                className="pt-20"
              >
                <PanelClasificacion columnas={columnas} />
              </Seccion>
            </div>

            {/* ------------------------------------------------------------ */}
            <Seccion
              id="dashboard"
              numero="3"
              icono="barras"
              titulo="Dashboard reactivo"
              descripcion="Segmente por cualquier columna: las métricas y los gráficos se recalculan al instante sobre el subconjunto resultante."
              className="pt-20"
            >
              <Dashboard
                informe={informe}
                columnas={columnas}
                filas={filas}
                filasFiltradas={filasFiltradas}
                filtros={filtros}
                onAplicarFiltro={dataset.aplicarFiltro}
                onQuitarFiltro={dataset.quitarFiltro}
                onLimpiarFiltros={dataset.limpiarFiltros}
                recalculando={dataset.recalculando}
                nombreArchivo={metadatos?.nombre_archivo?.replace(/\.[^.]+$/, '')}
              />
            </Seccion>

            {/* ------------------------------------------------------------ */}
            <Seccion
              id="estadistica"
              numero="4"
              icono="calculadora"
              titulo="Estadística descriptiva"
              descripcion="Tendencia central, posición, dispersión y tablas de frecuencia, calculadas sobre las filas filtradas."
              className="pt-20"
            >
              <Tarjeta padding="p-5 sm:p-6">
                <PanelEstadistica
                  datasetId={datasetId}
                  columnas={columnas}
                  filtros={dataset.filtrosActivos}
                  recalculando={dataset.recalculando}
                />
              </Tarjeta>
            </Seccion>

            {/* ------------------------------------------------------------ */}
            <Seccion
              id="calidad"
              numero="5"
              icono="escudo"
              titulo="Control de calidad"
              descripcion="Validación de consistencia mediante scraping simulado contra catálogos de referencia embebidos."
              className="pt-20"
            >
              <Tarjeta padding="p-5 sm:p-6">
                <ValidadorConsistencia datasetId={datasetId} filtros={dataset.filtrosActivos} />
              </Tarjeta>
            </Seccion>

            {/* ------------------------------------------------------------ */}
            <Seccion
              id="datos"
              numero="6"
              icono="tabla"
              titulo="Datos"
              descripcion={`Filas que superan los filtros activos${
                metadatos?.truncado
                  ? '. El navegador recibió una muestra del archivo; las métricas usan el total.'
                  : '.'
              }`}
              className="pt-20"
            >
              <Tarjeta padding="p-4 sm:p-5">
                <VistaDatos
                  filas={filasFiltradas}
                  columnas={columnas}
                  columnasOrden={dataset.columnasOrden}
                />
              </Tarjeta>
            </Seccion>
          </>
        )}

        {/* ---------------------------------------------------------------- */}
        <Seccion
          id="descargas"
          icono="descargar"
          titulo="Descargas"
          descripcion="Datasets de muestra generados con Pandas y exportación del análisis en curso."
          className="pt-20"
        >
          <CentroDescargas
            datasetId={datasetId}
            filtros={dataset.filtrosActivos}
            filas={filasFiltradas}
            columnas={columnas}
            nombreArchivo={metadatos?.nombre_archivo?.replace(/\.[^.]+$/, '')}
            // Analizar una muestra usa el mismo manejador que un archivo
            // adjuntado: mismo análisis, mismo historial y mismo salto al
            // resultado.
            onAnalizarMuestra={alSubir}
          />
        </Seccion>
      </main>

      <footer className="sin-impresion border-t border-borde-suave py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-xs text-tinta-3 sm:px-6">
          Procesador Inteligente de Datos · Next.js y Tailwind en el cliente, Python y Pandas en el
          motor de análisis.
        </div>
      </footer>
    </>
  );
}
