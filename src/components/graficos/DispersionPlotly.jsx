// src/components/graficos/DispersionPlotly.jsx
import React, { useState } from "react";
import Plot from "react-plotly.js";
import VariableSelector from "../VariableSelector";

const DispersionPlotly = ({ data, columns }) => {
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
      <h2 className="text-xl font-bold mb-2">📌 Dispersión</h2>
      <p className="mb-4 text-gray-600">Muestra la relación entre <strong>{xKey}</strong> y <strong>{yKey}</strong>.</p>

      <VariableSelector columns={columns} xKey={xKey} yKey={yKey} onChange={handleChange} />

      <Plot
        data={[{ x, y, mode: "markers", type: "scatter", marker: { size: 8, color: "#ef4444" } }]}
        layout={{ title: "Gráfico de Dispersión" }}
        style={{ width: "100%", height: "400px" }}
      />
    </div>
  );
};
export default DispersionPlotly;
