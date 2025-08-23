// src/components/graficos/MixtoPlotly.jsx
import React, { useState } from "react";
import Plot from "react-plotly.js";
import VariableSelector from "../VariableSelector";

const MixtoPlotly = ({ data, columns }) => {
  const [xKey, setXKey] = useState(columns[0]?.name || "");
  const [barKey, setBarKey] = useState(columns[1]?.name || "");

  const handleChange = (axis, value) => {
    if (axis === "x") setXKey(value);
    if (axis === "y") setBarKey(value);
  };

  const x = xKey ? data.map((row) => row[xKey]) : [];
  const bars = barKey ? data.map((row) => row[barKey]) : [];

  return (
    <div className="p-4 bg-white shadow rounded-2xl">
      <h2 className="text-xl font-bold mb-2">📊 Gráfico Mixto</h2>
      <p className="mb-4 text-gray-600">Barras (<strong>{barKey}</strong>) + Línea (<strong>{xKey}</strong>).</p>

      <VariableSelector columns={columns} xKey={xKey} yKey={barKey} onChange={handleChange} />

      <Plot
        data={[
          { x, y: bars, type: "bar", name: barKey, marker: { color: "#f59e0b" } },
          { x, y: x, type: "scatter", mode: "lines", name: xKey, line: { color: "#4f46e5" } },
        ]}
        layout={{ title: "Gráfico Mixto" }}
        style={{ width: "100%", height: "400px" }}
      />
    </div>
  );
};
export default MixtoPlotly;
