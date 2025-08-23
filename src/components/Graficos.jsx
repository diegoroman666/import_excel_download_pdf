// src/components/Graficos.jsx
import React, { useState } from "react";

// importar todos los gráficos en Plotly
import AreaPlotly from "./graficos/AreaPlotly";
import BarrasPlotly from "./graficos/BarrasPlotly";
import CajasPlotly from "./graficos/CajasPlotly";
import CircularPlotly from "./graficos/CircularPlotly";
import DispersionPlotly from "./graficos/DispersionPlotly";
import HeatmapPlotly from "./graficos/HeatmapPlotly";
import HistogramaPlotly from "./graficos/HistogramaPlotly";
import LineasPlotly from "./graficos/LineasPlotly";
import MixtoPlotly from "./graficos/MixtoPlotly";
import RadarPlotly from "./graficos/RadarPlotly";
import RegresionPlotly from "./graficos/RegresionPlotly";
import StackedPlotly from "./graficos/StackedPlotly";

// lista de gráficos disponibles
const graficosDisponibles = [
  { id: "area", nombre: "Área", componente: AreaPlotly },
  { id: "barras", nombre: "Barras", componente: BarrasPlotly },
  { id: "cajas", nombre: "Cajas", componente: CajasPlotly },
  { id: "circular", nombre: "Circular", componente: CircularPlotly },
  { id: "dispersion", nombre: "Dispersión", componente: DispersionPlotly },
  { id: "heatmap", nombre: "Heatmap", componente: HeatmapPlotly },
  { id: "histograma", nombre: "Histograma", componente: HistogramaPlotly },
  { id: "lineas", nombre: "Líneas", componente: LineasPlotly },
  { id: "mixto", nombre: "Mixto", componente: MixtoPlotly },
  { id: "radar", nombre: "Radar", componente: RadarPlotly },
  { id: "regresion", nombre: "Regresión", componente: RegresionPlotly },
  { id: "stacked", nombre: "Barras Apiladas", componente: StackedPlotly },
];

const Graficos = () => {
  const [graficoSeleccionado, setGraficoSeleccionado] = useState("area");

  // datos de ejemplo
  const [data] = useState([
    { categoria: "A", valor1: 10, valor2: 20, valor3: 15 },
    { categoria: "B", valor1: 15, valor2: 25, valor3: 10 },
    { categoria: "C", valor1: 20, valor2: 30, valor3: 12 },
    { categoria: "D", valor1: 25, valor2: 35, valor3: 18 },
    { categoria: "E", valor1: 30, valor2: 40, valor3: 22 },
  ]);

  const [columns] = useState([
    { name: "categoria" },
    { name: "valor1" },
    { name: "valor2" },
    { name: "valor3" },
  ]);

  // encontrar componente del gráfico seleccionado
  const grafico = graficosDisponibles.find((g) => g.id === graficoSeleccionado);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-center mb-6">📊 Visualizador de Gráficos (Plotly.js)</h1>

      {/* selector de gráfico */}
      <div className="mb-6 flex justify-center">
        <select
          value={graficoSeleccionado}
          onChange={(e) => setGraficoSeleccionado(e.target.value)}
          className="px-4 py-2 border rounded-lg shadow"
        >
          {graficosDisponibles.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </select>
      </div>

      {/* render dinámico del gráfico */}
      <div className="bg-white p-4 rounded-2xl shadow-lg">
        {grafico && <grafico.componente data={data} columns={columns} />}
      </div>
    </div>
  );
};

export default Graficos;
