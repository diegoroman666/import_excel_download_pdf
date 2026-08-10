'use client';

/**
 * Historial de análisis guardados.
 *
 * Lista los archivos que este navegador ha analizado, permite reabrirlos —se
 * reprocesan con Pandas, no se muestra un resultado congelado— y borrarlos.
 *
 * Si el servicio no tiene base de datos configurada, el panel lo explica en
 * lugar de fallar: el resto de la aplicación funciona igual.
 */

import { useCallback, useEffect, useState } from 'react';
import { abrirDelHistorial, eliminarDelHistorial, obtenerHistorial, vaciarHistorial } from '@/lib/api';
import { META_TIPOS } from '@/lib/constants';
import { bytes, entero } from '@/lib/format';
import Aviso from '../ui/Aviso';
import Boton from '../ui/Boton';
import Cargando from '../ui/Cargando';
import EstadoVacio from '../ui/EstadoVacio';
import Icono from '../ui/Icono';

function fechaLegible(iso) {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Entrada({ entrada, ocupada, onAbrir, onEliminar }) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <li
      className="flex flex-wrap items-center gap-3 rounded-xl border border-borde-suave
        bg-superficie/40 p-3 transition-colors hover:border-acento/40"
      data-testid="entrada-historial"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-acento/10 text-acento">
        <Icono nombre="archivo" tamano={17} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-tinta" title={entrada.nombre_archivo}>
          {entrada.nombre_archivo}
        </p>
        <p className="text-[11px] text-tinta-3">
          {fechaLegible(entrada.creado_en)} · {entero(entrada.filas)} filas ·{' '}
          {entrada.columnas} columnas · {bytes(entrada.tamano_bytes)}
        </p>

        {/* Recuento por tipo de variable, sin reprocesar el archivo. */}
        <div className="mt-1.5 flex flex-wrap gap-1">
          {Object.entries(entrada.resumen_tipos || {}).map(([tipo, cantidad]) => {
            const meta = META_TIPOS[tipo];
            if (!meta) return null;
            return (
              <span
                key={tipo}
                title={`${cantidad} × ${tipo}`}
                className="rounded px-1.5 py-0.5 text-[9px] font-semibold"
                style={{
                  color: meta.color,
                  backgroundColor: `color-mix(in oklab, ${meta.color} 12%, transparent)`,
                }}
              >
                {cantidad} {meta.abreviatura}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Boton
          tamano="sm"
          variante="secundario"
          icono="ojo"
          cargando={ocupada === entrada.id}
          onClick={() => onAbrir(entrada)}
        >
          Abrir
        </Boton>

        {confirmando ? (
          <span className="flex items-center gap-1">
            <Boton
              tamano="sm"
              variante="peligro"
              onClick={() => {
                setConfirmando(false);
                onEliminar(entrada);
              }}
            >
              Confirmar
            </Boton>
            <Boton tamano="sm" variante="fantasma" onClick={() => setConfirmando(false)}>
              No
            </Boton>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            aria-label={`Borrar ${entrada.nombre_archivo}`}
            className="rounded-lg p-2 text-tinta-3 transition-colors hover:bg-rojo/10 hover:text-rojo"
          >
            <Icono nombre="cerrar" tamano={15} />
          </button>
        )}
      </div>
    </li>
  );
}

export default function PanelHistorial({ onAbrirAnalisis, recargar }) {
  const [estado, setEstado] = useState({ disponible: true, entradas: [], motivo: null });
  const [cargando, setCargando] = useState(true);
  const [ocupada, setOcupada] = useState(null);
  const [error, setError] = useState(null);

  const refrescar = useCallback(async (señal) => {
    try {
      const respuesta = await obtenerHistorial({ señal });
      setEstado(respuesta);
      setError(null);
    } catch (causa) {
      if (causa?.name !== 'AbortError') setError(causa.message);
    } finally {
      if (!señal?.aborted) setCargando(false);
    }
  }, []);

  useEffect(() => {
    const control = new AbortController();
    refrescar(control.signal);
    return () => control.abort();
    // `recargar` cambia tras cada subida, para que la lista se actualice sola.
  }, [refrescar, recargar]);

  const abrir = async (entrada) => {
    setOcupada(entrada.id);
    setError(null);
    try {
      onAbrirAnalisis(await abrirDelHistorial(entrada.id));
    } catch (causa) {
      setError(causa.message);
      // Si la entrada ya no existe, la lista se resincroniza.
      refrescar();
    } finally {
      setOcupada(null);
    }
  };

  const eliminar = async (entrada) => {
    setError(null);
    // Se quita de la lista al instante; si falla, se restaura al refrescar.
    setEstado((previo) => ({
      ...previo,
      entradas: previo.entradas.filter((e) => e.id !== entrada.id),
    }));
    try {
      await eliminarDelHistorial(entrada.id);
    } catch (causa) {
      setError(causa.message);
    } finally {
      refrescar();
    }
  };

  const vaciar = async () => {
    setError(null);
    try {
      await vaciarHistorial();
    } catch (causa) {
      setError(causa.message);
    } finally {
      refrescar();
    }
  };

  if (cargando) return <Cargando texto="Consultando el historial…" />;

  if (!estado.disponible) {
    return (
      <Aviso tono="info" titulo="Historial no disponible">
        {estado.motivo}
      </Aviso>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="panel-historial">
      {error && (
        <Aviso tono="error" onCerrar={() => setError(null)}>
          {error}
        </Aviso>
      )}

      {estado.entradas.length === 0 ? (
        <EstadoVacio icono="archivo" titulo="Todavía no hay análisis guardados" altura="py-10">
          Los archivos que suba quedarán aquí para volver a abrirlos sin tener que buscarlos de
          nuevo.
        </EstadoVacio>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-tinta-3">
              {estado.entradas.length} análisis guardado
              {estado.entradas.length === 1 ? '' : 's'} en este navegador
            </p>
            <Boton tamano="sm" variante="fantasma" icono="reiniciar" onClick={vaciar}>
              Vaciar historial
            </Boton>
          </div>

          <ul className="flex flex-col gap-2">
            {estado.entradas.map((entrada) => (
              <Entrada
                key={entrada.id}
                entrada={entrada}
                ocupada={ocupada}
                onAbrir={abrir}
                onEliminar={eliminar}
              />
            ))}
          </ul>
        </>
      )}

      <p className="text-[11px] text-tinta-3">
        El historial se guarda por navegador, sin cuentas. Al abrir un análisis el archivo se
        vuelve a procesar con Pandas, de modo que siempre refleja la versión actual del motor.
      </p>
    </div>
  );
}
