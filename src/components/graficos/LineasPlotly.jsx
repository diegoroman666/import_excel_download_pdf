// src/components/graficos/LineasPlotly.jsx
import React, { useState } from "react";
import Plot from "react-plotly.js";
import VariableSelector from "../VariableSelector";

const LineasPlotly = ({ data, columns }) => {
  const [xKey, setXKey] = useState(columns[0]?.name || "");
  const [yKey, setYKey] = useState(columns[1]?.name || "");

  const handleChange = (axis, value) => {
    if (axis === "x") setXKey(value);
    if (axis === "y") setYKey(value);
  };

  const x = xKey ? data.map((row) => row[xKey]) : [];
  const y = yKey ? data.map((row) => row[yKey]) : [];

  return (
    <div className="p-4 bg-white shadow rounded-2xl">
      <h2 className="text-xl font-bold mb-2">📈 Gráfico de Líneas</h2>
      <p className="mb-4 text-gray-600">Evolución de <strong>{yKey}</strong> respecto a <strong>{xKey}</strong>.</p>

      <VariableSelector columns={columns} xKey={xKey} yKey={yKey} onChange={handleChange} />

      <Plot
        data={[{ x, y, type: "scatter", mode: "lines+markers", line: { color: "#16a34a", width: 3 } }]}
        layout={{ title: "Gráfico de Líneas" }}
        style={{ width: "100%", height: "400px" }}
      />
    </div>
  );
};
export default LineasPlotly;
