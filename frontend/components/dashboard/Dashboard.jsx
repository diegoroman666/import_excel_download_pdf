'use client';

/**
 * Dashboard reactivo.
 *
 * Une el panel de filtros, las métricas, el selector de gráficos y el lienzo.
 * Todo se recalcula a partir de un único estado: las filas filtradas y la
 * selección de ejes.
 */

import { useCallback, useMemo, useState } from 'react';
import { ajustarSeleccion } from '@/lib/chartSelection';
import { GRAFICOS_POR_ID, obtenerGrafico } from '../charts/registry';
import Cargando from '../ui/Cargando';
import Icono from '../ui/Icono';
import Tarjeta from '../ui/Tarjeta';
import ChipsFiltros from '../filters/ChipsFiltros';
import PanelFiltros from '../filters/PanelFiltros';
import ControlesEjes from './ControlesEjes';
import EscenarioGrafico from './EscenarioGrafico';
import FilaKpis from './FilaKpis';
import SelectorGrafico from './SelectorGrafico';

export default function Dashboard({
  informe,
  columnas,
  filas,
  filasFiltradas,
  filtros,
  onAplicarFiltro,
  onQuitarFiltro,
  onLimpiarFiltros,
  recalculando,
  nombreArchivo,
}) {
  const [graficoId, setGraficoId] = useState('barras');
  // Guarda lo que el usuario ha elegido de forma explícita. Los ejes que
  // realmente se dibujan se derivan de aquí en cada render.
  const [seleccionUsuario, setSeleccionUsuario] = useState({});

  const grafico = obtenerGrafico(graficoId);

  // Firma estable del esquema: el array de columnas cambia de identidad con
  // cada respuesta del backend aunque el esquema sea el mismo.
  const firmaColumnas = useMemo(
    () => columnas.map((columna) => `${columna.nombre}:${columna.tipo}`).join('|'),
    [columnas],
  );

  // La adaptación de los ejes se calcula durante el render, no en un efecto.
  // Hacerlo en un efecto dejaba un fotograma dibujado con la selección del
  // gráfico anterior: al pasar a un gráfico con otros requisitos (por ejemplo
  // el mixto, que necesita dos medidas numéricas) se llegaba a construir una
  // serie vacía sobre un eje superpuesto.
  const seleccion = useMemo(
    () => ajustarSeleccion(GRAFICOS_POR_ID[graficoId], columnas, seleccionUsuario),
    // `firmaColumnas` sustituye a `columnas` para no recalcular en cada sincronización.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [graficoId, firmaColumnas, seleccionUsuario],
  );

  const cambiarSeleccion = useCallback((clave, valor) => {
    setSeleccionUsuario((previa) => ({ ...previa, [clave]: valor }));
  }, []);

  const cambiarGrafico = useCallback((id) => setGraficoId(id), []);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]">
      <PanelFiltros
        filtrosDisponibles={informe?.filtros_disponibles ?? []}
        columnas={columnas}
        filtros={filtros}
        onAplicar={onAplicarFiltro}
        onQuitar={onQuitarFiltro}
        onLimpiar={onLimpiarFiltros}
        filasFiltradas={filasFiltradas.length}
        filasTotales={filas.length}
      />

      <div className="flex min-w-0 flex-col gap-5">
        <FilaKpis
          filas={filasFiltradas}
          filasTotales={filas.length}
          columnas={columnas}
          medida={seleccion.y}
          resumen={informe?.resumen}
        />

        <ChipsFiltros
          filtros={filtros}
          onQuitar={onQuitarFiltro}
          onLimpiar={onLimpiarFiltros}
        />

        <Tarjeta
          titulo={grafico.nombre}
          descripcion={grafico.descripcion}
          icono={grafico.icono}
          acciones={
            recalculando ? <Cargando texto="Sincronizando con Pandas…" /> : null
          }
        >
          <div className="flex flex-col gap-5">
            <SelectorGrafico seleccionado={graficoId} onSeleccionar={cambiarGrafico} />

            <div className="rounded-xl border border-borde-suave bg-abismo-2/40 p-4">
              <ControlesEjes
                grafico={grafico}
                columnas={columnas}
                seleccion={seleccion}
                onCambiar={cambiarSeleccion}
              />
            </div>

            {filasFiltradas.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Icono nombre="filtro" tamano={28} className="text-tinta-3" />
                <p className="text-sm font-semibold text-tinta-2">
                  Ninguna fila supera los filtros actuales
                </p>
                <button
                  type="button"
                  onClick={onLimpiarFiltros}
                  className="text-xs text-acento hover:underline"
                >
                  Limpiar todos los filtros
                </button>
              </div>
            ) : (
              <EscenarioGrafico
                grafico={grafico}
                filas={filasFiltradas}
                seleccion={seleccion}
                columnas={columnas}
                nombreArchivo={nombreArchivo}
              />
            )}
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}
