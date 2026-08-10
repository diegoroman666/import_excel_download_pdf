'use client';

/**
 * Estado central del dataset activo.
 *
 * Reparto de responsabilidades:
 *  - **Cliente**: filtra las filas que ya tiene en memoria, para que gráficos y
 *    KPIs respondan en el mismo fotograma en que se mueve un filtro.
 *  - **Servidor (Pandas)**: recalcula el informe completo —clasificación,
 *    descriptivos, frecuencias— con un pequeño retardo, y su resultado
 *    sustituye a cualquier cálculo local.
 *
 * Las peticiones en vuelo se cancelan al llegar un cambio nuevo, de modo que
 * una respuesta lenta nunca pisa a otra más reciente.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as api from './api';
import { aplicarFiltros, filtrosActivos, metaDeColumnas } from './filters';

const RETARDO_RECALCULO = 260;

const ESTADO_INICIAL = {
  metadatos: null,
  informe: null,
  filas: [],
  columnasOrden: [],
  avisos: [],
};

export default function useDataset() {
  const [datos, setDatos] = useState(ESTADO_INICIAL);
  const [filtros, setFiltros] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [error, setError] = useState(null);

  const peticionAnalisis = useRef(null);
  const peticionSubida = useRef(null);

  // --- Carga de archivo ----------------------------------------------------
  const subir = useCallback(async (archivo) => {
    peticionSubida.current?.abort();
    const control = new AbortController();
    peticionSubida.current = control;

    setSubiendo(true);
    setError(null);

    try {
      const respuesta = await api.subirArchivo(archivo, { señal: control.signal });
      setDatos({
        metadatos: respuesta.metadatos,
        informe: respuesta.informe,
        filas: respuesta.filas,
        columnasOrden: respuesta.columnas_orden,
        avisos: respuesta.avisos ?? [],
      });
      setFiltros([]);
      return respuesta;
    } catch (causa) {
      if (causa?.name === 'AbortError') return null;
      setError({ mensaje: causa.message, detalle: causa.detalle });
      return null;
    } finally {
      if (peticionSubida.current === control) {
        peticionSubida.current = null;
        setSubiendo(false);
      }
    }
  }, []);

  const reiniciar = useCallback(() => {
    peticionSubida.current?.abort();
    peticionAnalisis.current?.abort();
    if (datos.metadatos?.dataset_id) api.liberarDataset(datos.metadatos.dataset_id);
    setDatos(ESTADO_INICIAL);
    setFiltros([]);
    setError(null);
  }, [datos.metadatos]);

  // --- Filtros -------------------------------------------------------------
  const aplicarFiltro = useCallback((columna, cambios) => {
    setFiltros((previos) => {
      const indice = previos.findIndex((filtro) => filtro.columna === columna);
      if (indice === -1) return [...previos, { columna, ...cambios }];

      const copia = [...previos];
      copia[indice] = { ...copia[indice], ...cambios };
      return copia;
    });
  }, []);

  const quitarFiltro = useCallback((columna) => {
    setFiltros((previos) => previos.filter((filtro) => filtro.columna !== columna));
  }, []);

  const limpiarFiltros = useCallback(() => setFiltros([]), []);

  // --- Derivados en cliente (inmediatos) -----------------------------------
  const metaColumnas = useMemo(
    () => metaDeColumnas(datos.informe?.columnas ?? []),
    [datos.informe],
  );

  const activos = useMemo(() => filtrosActivos(filtros), [filtros]);

  const filasFiltradas = useMemo(
    () => aplicarFiltros(datos.filas, activos, metaColumnas),
    [datos.filas, activos, metaColumnas],
  );

  // --- Recálculo en servidor (con retardo) ---------------------------------
  const datasetId = datos.metadatos?.dataset_id;
  // Firma estable: evita recalcular cuando el array cambia de identidad sin
  // que haya cambiado ningún criterio real.
  const firmaFiltros = useMemo(() => JSON.stringify(activos), [activos]);

  useEffect(() => {
    if (!datasetId) return undefined;

    const temporizador = setTimeout(async () => {
      peticionAnalisis.current?.abort();
      const control = new AbortController();
      peticionAnalisis.current = control;

      setRecalculando(true);
      try {
        const respuesta = await api.analizar(datasetId, {
          filtros: JSON.parse(firmaFiltros),
          señal: control.signal,
        });
        setDatos((previos) =>
          previos.metadatos?.dataset_id === datasetId
            ? { ...previos, informe: respuesta.informe }
            : previos,
        );
        setError(null);
      } catch (causa) {
        if (causa?.name !== 'AbortError') {
          setError({ mensaje: causa.message, detalle: causa.detalle });
        }
      } finally {
        if (peticionAnalisis.current === control) {
          peticionAnalisis.current = null;
          setRecalculando(false);
        }
      }
    }, RETARDO_RECALCULO);

    return () => clearTimeout(temporizador);
  }, [datasetId, firmaFiltros]);

  // Cancela cualquier petición pendiente al desmontar.
  useEffect(
    () => () => {
      peticionSubida.current?.abort();
      peticionAnalisis.current?.abort();
    },
    [],
  );

  const columnas = datos.informe?.columnas ?? [];

  return {
    // Datos
    metadatos: datos.metadatos,
    informe: datos.informe,
    columnas,
    columnasOrden: datos.columnasOrden,
    filas: datos.filas,
    filasFiltradas,
    avisos: datos.avisos,

    // Estado
    hayDatos: Boolean(datos.metadatos),
    subiendo,
    recalculando,
    error,
    limpiarError: () => setError(null),

    // Filtros
    filtros,
    filtrosActivos: activos,
    aplicarFiltro,
    quitarFiltro,
    limpiarFiltros,

    // Acciones
    subir,
    reiniciar,
  };
}
