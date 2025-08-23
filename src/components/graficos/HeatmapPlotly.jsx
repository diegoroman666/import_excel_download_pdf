// src/components/graficos/HeatmapPlotly.jsx
import React from "react";
import Plot from "react-plotly.js";

const HeatmapPlotly = ({ data, columns }) => {
  const numericCols = columns.filter((col) => data.every((row) => !isNaN(parseFloat(row[col.name]))));
  if (numericCols.length < 2) return <p>No hay suficientes columnas numéricas.</p>;

  const matrix = numericCols.map((col) => data.map((row) => parseFloat(row[col.name]) || 0));

  return (
    <div className="p-4 bg-white shadow rounded-2xl">
      <h2 className="text-xl font-bold mb-2">🔥 Heatmap</h2>
      <p className="mb-4 text-gray-600">Muestra patrones e intensidades en varias variables.</p>

      <Plot
        data={[{ z: matrix, x: numericCols.map((c) => c.name), y: data.map((_, i) => `Fila ${i + 1}`), type: "heatmap", colorscale: "Viridis" }]}
        layout={{ title: "Mapa de Calor" }}
        style={{ width: "100%", height: "400px" }}
      />
    </div>
  );
};
export default HeatmapPlotly;
