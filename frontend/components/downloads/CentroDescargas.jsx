'use client';

/**
 * Centro de descargas.
 *
 * Dos bloques: los archivos de muestra que genera Pandas (5 en Excel y 5 en
 * CSV, los mismos datasets en ambos formatos) y la exportación del análisis en
 * curso, que respeta los filtros activos.
 */

import { useEffect, useState } from 'react';
import { descargarExport, obtenerMuestras } from '@/lib/api';
import { describirFiltro } from '@/lib/filters';
import { exportarPdf } from '@/lib/exportPdf';
import { entero } from '@/lib/format';
import Aviso from '../ui/Aviso';
import Boton from '../ui/Boton';
import Cargando from '../ui/Cargando';
import Icono from '../ui/Icono';
import Tarjeta from '../ui/Tarjeta';

function TarjetaMuestra({ muestra, formato, descargando, onDescargar }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-borde-suave bg-superficie/40 p-3
      transition-colors hover:border-acento/40">
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg ${
          formato === 'xlsx' ? 'bg-lima/10 text-lima' : 'bg-acento-2/10 text-acento-2'
        }`}
      >
        <Icono nombre={formato === 'xlsx' ? 'excel' : 'csv'} tamano={17} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-tinta">{muestra.nombre}</p>
        <p className="truncate text-[11px] text-tinta-3">{muestra.descripcion}</p>
        <p className="mt-0.5 text-[10px] text-tinta-3">
          {entero(muestra.filas)} filas · {muestra.columnas} columnas
        </p>
      </div>

      <Boton
        tamano="sm"
        variante="secundario"
        icono="descargar"
        cargando={descargando}
        onClick={() => onDescargar(muestra)}
        aria-label={`Descargar ${muestra.nombre} en ${formato.toUpperCase()}`}
      >
        {formato.toUpperCase()}
      </Boton>
    </li>
  );
}

export default function CentroDescargas({ datasetId, filtros, filas, columnas, nombreArchivo }) {
  const [catalogo, setCatalogo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [descargando, setDescargando] = useState(null);

  useEffect(() => {
    const control = new AbortController();

    obtenerMuestras({ señal: control.signal })
      .then(setCatalogo)
      .catch((causa) => {
        if (causa?.name !== 'AbortError') setError(causa.message);
      })
      .finally(() => {
        if (!control.signal.aborted) setCargando(false);
      });

    return () => control.abort();
  }, []);

  const descargarMuestra = async (muestra) => {
    setDescargando(`${muestra.id}-${muestra.formato}`);
    setError(null);
    try {
      const respuesta = await fetch(muestra.url);
      if (!respuesta.ok) throw new Error(`El servidor respondió ${respuesta.status}.`);

      const blob = await respuesta.blob();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `${muestra.id}.${muestra.formato}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (causa) {
      setError(`No se pudo descargar «${muestra.nombre}»: ${causa.message}`);
    } finally {
      setDescargando(null);
    }
  };

  const exportar = async (formato) => {
    if (!datasetId) return;
    setDescargando(formato);
    setError(null);
    try {
      if (formato === 'pdf') {
        await exportarPdf({
          filas,
          columnas,
          nombreArchivo: `${nombreArchivo || 'datos'}_filtrado`,
          titulo: `Informe · ${nombreArchivo || 'datos'}`,
          filtros,
          descripcionFiltros: filtros.map(describirFiltro),
        });
      } else {
        await descargarExport(datasetId, formato, { filtros });
      }
    } catch (causa) {
      setError(`No se pudo exportar: ${causa.message}`);
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <Aviso tono="error" onCerrar={() => setError(null)}>
          {error}
        </Aviso>
      )}

      {datasetId && (
        <Tarjeta
          titulo="Exportar el análisis actual"
          descripcion="Los archivos incluyen únicamente las filas que superan los filtros activos."
          icono="descargar"
          padding="p-5"
        >
          <div className="flex flex-wrap gap-2">
            <Boton
              variante="principal"
              icono="excel"
              cargando={descargando === 'xlsx'}
              onClick={() => exportar('xlsx')}
            >
              Excel filtrado
            </Boton>
            <Boton
              icono="csv"
              cargando={descargando === 'csv'}
              onClick={() => exportar('csv')}
            >
              CSV filtrado
            </Boton>
            <Boton
              icono="pdf"
              cargando={descargando === 'pdf'}
              onClick={() => exportar('pdf')}
            >
              PDF de la tabla
            </Boton>
            <Boton
              icono="capas"
              cargando={descargando === 'informe'}
              onClick={() => exportar('informe')}
            >
              Informe completo (.xlsx)
            </Boton>
          </div>
          <p className="mt-3 text-[11px] text-tinta-3">
            El informe completo añade hojas de clasificación de variables, estadística descriptiva
            y tablas de frecuencia.
          </p>
        </Tarjeta>
      )}

      {cargando && <Cargando texto="Cargando catálogo de muestras…" />}

      {catalogo && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Tarjeta
            titulo="5 archivos Excel de muestra"
            descripcion="Generados con Pandas. Cada uno cubre los cuatro tipos de variable."
            icono="excel"
            padding="p-5"
          >
            <ul className="flex flex-col gap-2">
              {catalogo.excel.map((muestra) => (
                <TarjetaMuestra
                  key={muestra.id}
                  muestra={muestra}
                  formato="xlsx"
                  descargando={descargando === `${muestra.id}-xlsx`}
                  onDescargar={descargarMuestra}
                />
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta
            titulo="5 archivos CSV de muestra"
            descripcion="Los mismos datasets en texto delimitado, codificados en UTF-8."
            icono="csv"
            padding="p-5"
          >
            <ul className="flex flex-col gap-2">
              {catalogo.csv.map((muestra) => (
                <TarjetaMuestra
                  key={muestra.id}
                  muestra={muestra}
                  formato="csv"
                  descargando={descargando === `${muestra.id}-csv`}
                  onDescargar={descargarMuestra}
                />
              ))}
            </ul>
          </Tarjeta>
        </div>
      )}
    </div>
  );
}
