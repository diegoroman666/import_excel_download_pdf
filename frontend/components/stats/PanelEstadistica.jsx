'use client';

/**
 * Panel de estadística descriptiva.
 *
 * Conserva las cuatro vistas de la aplicación original —tendencia central,
 * posición, dispersión y tablas de frecuencia— pero los cálculos ahora los
 * hace Pandas sobre el conjunto filtrado, no el navegador sobre una columna
 * suelta.
 */

import { useEffect, useMemo, useState } from 'react';
import { descargarExport, obtenerFrecuencias } from '@/lib/api';
import { META_TIPOS } from '@/lib/constants';
import { entero, numero, porcentajeDirecto } from '@/lib/format';
import Aviso from '../ui/Aviso';
import Boton from '../ui/Boton';
import Cargando from '../ui/Cargando';
import EstadoVacio from '../ui/EstadoVacio';
import Icono from '../ui/Icono';
import Selector from '../ui/Selector';

const VISTAS = [
  { id: 'tendencia', etiqueta: 'Tendencia central', icono: 'calculadora' },
  { id: 'posicion', etiqueta: 'Posición', icono: 'diana' },
  { id: 'dispersion', etiqueta: 'Dispersión', icono: 'balanza' },
  { id: 'frecuencia', etiqueta: 'Frecuencias', icono: 'tabla' },
];

function Metrica({ etiqueta, valor, ayuda, destacada = false }) {
  return (
    <div
      className={`rounded-xl border p-3.5 ${
        destacada ? 'border-acento/30 bg-acento/[0.06]' : 'border-borde-suave bg-superficie/40'
      }`}
    >
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-tinta-3">
        {etiqueta}
        {ayuda && (
          <span title={ayuda} className="cursor-help">
            <Icono nombre="info" tamano={12} />
          </span>
        )}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums text-tinta">{valor}</p>
    </div>
  );
}

function Tabla({ cabeceras, filas, vacio }) {
  if (!filas.length) return <EstadoVacio icono="tabla">{vacio}</EstadoVacio>;

  return (
    <div className="overflow-x-auto rounded-xl border border-borde-suave">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-borde-suave bg-superficie/60">
            {cabeceras.map((cabecera) => (
              <th
                key={cabecera}
                scope="col"
                className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-tinta-3"
              >
                {cabecera}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, indice) => (
            <tr
              key={indice}
              className="border-b border-borde-suave/50 transition-colors last:border-0 hover:bg-superficie/40"
            >
              {fila.map((celda, columna) => (
                <td
                  key={columna}
                  className={`px-3 py-2 ${columna === 0 ? 'text-tinta' : 'tabular-nums text-tinta-2'}`}
                >
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VistaTendencia({ resumen }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Metrica
        etiqueta="Media"
        valor={numero(resumen.media)}
        ayuda="Promedio aritmético de los valores."
        destacada
      />
      <Metrica
        etiqueta="Mediana"
        valor={numero(resumen.mediana)}
        ayuda="Valor central: deja el 50 % de los datos a cada lado."
        destacada
      />
      <Metrica
        etiqueta="Moda"
        valor={resumen.moda.length ? resumen.moda.map((m) => numero(m)).join(' · ') : 'Sin moda'}
        ayuda="Valor o valores que más se repiten. Si ninguno se repite, no hay moda."
        destacada
      />
      <Metrica etiqueta="Nº de datos" valor={entero(resumen.conteo)} />
      <Metrica etiqueta="Suma" valor={numero(resumen.suma, { corto: true })} />
      <Metrica
        etiqueta="Asimetría"
        valor={numero(resumen.asimetria)}
        ayuda="0 ≈ simétrica; > 0 cola a la derecha; < 0 cola a la izquierda."
      />
    </div>
  );
}

function VistaPosicion({ resumen }) {
  const deciles = Object.entries(resumen.deciles ?? {});
  const percentiles = Object.entries(resumen.percentiles ?? {});

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Metrica etiqueta="Q1 (P25)" valor={numero(resumen.q1)} destacada />
        <Metrica etiqueta="Q2 (mediana)" valor={numero(resumen.q2)} destacada />
        <Metrica etiqueta="Q3 (P75)" valor={numero(resumen.q3)} destacada />
        <Metrica
          etiqueta="Rango intercuartílico"
          valor={numero(resumen.iqr)}
          ayuda="Q3 − Q1: amplitud del 50 % central de los datos."
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-3">
            Deciles
          </h5>
          <Tabla
            cabeceras={['Decil', 'Valor']}
            filas={deciles.map(([clave, valor]) => [clave.toUpperCase(), numero(valor)])}
            vacio="Sin datos numéricos."
          />
        </div>
        <div>
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-3">
            Percentiles
          </h5>
          <Tabla
            cabeceras={['Percentil', 'Valor']}
            filas={percentiles.map(([clave, valor]) => [clave.toUpperCase(), numero(valor)])}
            vacio="Sin datos numéricos."
          />
        </div>
      </div>
    </div>
  );
}

function VistaDispersion({ resumen }) {
  const cv = resumen.coeficiente_variacion;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Metrica etiqueta="Rango" valor={numero(resumen.rango)} destacada />
        <Metrica etiqueta="Varianza" valor={numero(resumen.varianza, { corto: true })} destacada />
        <Metrica
          etiqueta="Desviación estándar"
          valor={numero(resumen.desviacion_estandar)}
          destacada
        />
        <Metrica
          etiqueta="Coef. de variación"
          valor={cv === null || cv === undefined ? 'No aplica' : porcentajeDirecto(cv * 100)}
          ayuda="Desviación estándar relativa a la media. No se define si la media es 0."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metrica etiqueta="Mínimo" valor={numero(resumen.minimo)} />
        <Metrica etiqueta="Máximo" valor={numero(resumen.maximo)} />
        <Metrica
          etiqueta="Valores atípicos"
          valor={entero(resumen.atipicos)}
          ayuda="Fuera del intervalo [Q1 − 1,5·IQR, Q3 + 1,5·IQR]."
        />
        <Metrica
          etiqueta="Curtosis"
          valor={numero(resumen.curtosis)}
          ayuda="Mide cuánto pesan las colas frente a una distribución normal."
        />
      </div>
    </div>
  );
}

function VistaFrecuencias({ datasetId, columna, filtros }) {
  const [tablas, setTablas] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const firmaFiltros = useMemo(() => JSON.stringify(filtros), [filtros]);

  useEffect(() => {
    if (!datasetId || !columna) return undefined;

    const control = new AbortController();
    setCargando(true);
    setError(null);

    obtenerFrecuencias(datasetId, columna, {
      filtros: JSON.parse(firmaFiltros),
      señal: control.signal,
    })
      .then((respuesta) => setTablas(respuesta))
      .catch((causa) => {
        if (causa?.name !== 'AbortError') setError(causa.message);
      })
      .finally(() => {
        if (!control.signal.aborted) setCargando(false);
      });

    return () => control.abort();
  }, [datasetId, columna, firmaFiltros]);

  if (error) return <Aviso tono="error">{error}</Aviso>;
  if (cargando && !tablas) return <Cargando texto="Construyendo tablas de frecuencia…" />;
  if (!tablas) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-3">
          Distribución de frecuencias
        </h5>
        <Tabla
          cabeceras={['Valor', 'fi', 'hi', 'Fi', 'Hi']}
          filas={tablas.no_agrupada.map((fila) => [
            fila.valor,
            entero(fila.frecuencia_absoluta),
            numero(fila.frecuencia_relativa),
            entero(fila.frecuencia_acumulada),
            numero(fila.frecuencia_relativa_acumulada),
          ])}
          vacio="La columna no tiene valores con los filtros actuales."
        />
        <p className="mt-2 text-[11px] text-tinta-3">
          fi: frecuencia absoluta · hi: relativa · Fi: absoluta acumulada · Hi: relativa acumulada
        </p>
      </div>

      {tablas.agrupada && (
        <div>
          <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-tinta-3">
            Tabla agrupada por intervalos
          </h5>
          <Tabla
            cabeceras={['Intervalo', 'Marca de clase', 'fi', 'hi', 'Fi', 'Hi']}
            filas={tablas.agrupada.map((fila) => [
              fila.intervalo,
              numero(fila.marca_clase),
              entero(fila.frecuencia_absoluta),
              numero(fila.frecuencia_relativa),
              entero(fila.frecuencia_acumulada),
              numero(fila.frecuencia_relativa_acumulada),
            ])}
            vacio="No aplica."
          />
          <p className="mt-2 text-[11px] text-tinta-3">
            {tablas.clases_sturges} clases de amplitud {numero(tablas.amplitud_clase)} (regla de
            Sturges). Los intervalos son semiabiertos; el último incluye el máximo.
          </p>
        </div>
      )}
    </div>
  );
}

export default function PanelEstadistica({ datasetId, columnas, filtros, recalculando }) {
  const [vista, setVista] = useState('tendencia');
  const [columnaId, setColumnaId] = useState('');
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState(null);

  /**
   * Descarga toda la estadística en Excel.
   *
   * No exporta sólo lo que se ve en pantalla —una columna y una vista—, sino el
   * informe completo que calcula Pandas: clasificación de variables,
   * descriptivos de cada columna y tablas de frecuencia, siempre sobre las
   * filas que superan los filtros activos.
   */
  const descargarEstadistica = async () => {
    if (!datasetId) return;
    setDescargando(true);
    setErrorDescarga(null);
    try {
      await descargarExport(datasetId, 'informe', { filtros });
    } catch (causa) {
      setErrorDescarga(`No se pudo descargar la estadística: ${causa.message}`);
    } finally {
      setDescargando(false);
    }
  };

  const numericas = useMemo(() => columnas.filter((columna) => columna.es_numerica), [columnas]);

  // La columna activa se ajusta sola: numérica para las medidas, cualquiera
  // para las tablas de frecuencia.
  const candidatas = vista === 'frecuencia' ? columnas : numericas;

  useEffect(() => {
    if (!candidatas.length) {
      setColumnaId('');
      return;
    }
    if (!candidatas.some((columna) => columna.nombre === columnaId)) {
      setColumnaId(candidatas[0].nombre);
    }
  }, [candidatas, columnaId]);

  const columna = columnas.find((c) => c.nombre === columnaId);
  const resumen = columna?.resumen_numerico;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div
          role="tablist"
          aria-label="Vista estadística"
          className="flex flex-wrap gap-1.5 rounded-xl border border-borde-suave p-1"
        >
          {VISTAS.map((opcion) => {
            const activa = vista === opcion.id;
            return (
              <button
                key={opcion.id}
                role="tab"
                aria-selected={activa}
                onClick={() => setVista(opcion.id)}
                data-testid={`vista-${opcion.id}`}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs
                  transition-colors ${
                    activa ? 'bg-acento/15 text-acento' : 'text-tinta-3 hover:text-tinta-2'
                  }`}
              >
                <Icono nombre={opcion.icono} tamano={14} />
                {opcion.etiqueta}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <Selector
            etiqueta="Columna"
            valor={columnaId}
            opciones={candidatas.map((c) => ({
              valor: c.nombre,
              etiqueta: `${c.nombre} · ${META_TIPOS[c.tipo]?.abreviatura ?? ''}`,
            }))}
            onChange={setColumnaId}
            className="w-full sm:w-64"
          />

          <Boton
            icono="excel"
            cargando={descargando}
            disabled={!datasetId}
            onClick={descargarEstadistica}
            aria-label="Descargar la estadística descriptiva en Excel"
            title="Clasificación, descriptivos y frecuencias de todas las columnas, con los filtros aplicados"
          >
            Descargar estadística
          </Boton>
        </div>
      </div>

      {errorDescarga && (
        <Aviso tono="error" onCerrar={() => setErrorDescarga(null)}>
          {errorDescarga}
        </Aviso>
      )}

      {columna && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-tinta-3">
          <span
            className="rounded-md px-2 py-0.5 font-medium"
            style={{
              color: META_TIPOS[columna.tipo]?.color,
              backgroundColor: `color-mix(in oklab, ${META_TIPOS[columna.tipo]?.color} 12%, transparent)`,
            }}
          >
            {columna.tipo}
          </span>
          <span>{entero(columna.unicos)} valores únicos</span>
          <span>·</span>
          <span>{porcentajeDirecto(columna.porcentaje_nulos)} vacíos</span>
          {recalculando && <Cargando texto="Actualizando…" className="ml-auto" />}
        </div>
      )}

      {!candidatas.length && (
        <EstadoVacio icono="calculadora" titulo="Sin columnas aplicables">
          {vista === 'frecuencia'
            ? 'Cargue un archivo para construir tablas de frecuencia.'
            : 'Este dataset no tiene columnas numéricas para calcular medidas.'}
        </EstadoVacio>
      )}

      {vista === 'frecuencia' && columnaId && (
        <VistaFrecuencias datasetId={datasetId} columna={columnaId} filtros={filtros} />
      )}

      {vista !== 'frecuencia' && columna && !resumen && (
        <Aviso tono="aviso">
          «{columna.nombre}» no tiene valores numéricos con los filtros actuales.
        </Aviso>
      )}

      {vista === 'tendencia' && resumen && <VistaTendencia resumen={resumen} />}
      {vista === 'posicion' && resumen && <VistaPosicion resumen={resumen} />}
      {vista === 'dispersion' && resumen && <VistaDispersion resumen={resumen} />}
    </div>
  );
}
