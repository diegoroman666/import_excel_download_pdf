// src/components/graficos/HistogramaPlotly.jsx
import React, { useState } from "react";
import Plot from "react-plotly.js";
import VariableSelector from "../VariableSelector";

const HistogramaPlotly = ({ data, columns }) => {
  const [yKey, setYKey] = useState(columns[0]?.name || "");
  const handleChange = (axis, value) => setYKey(value);

  const values = yKey ? data.map((row) => row[yKey]) : [];

  return (
    <div className="p-4 bg-white shadow rounded-2xl">
      <h2 className="text-xl font-bold mb-2">📊 Histograma</h2>
      <p className="mb-4 text-gray-600">Distribución de <strong>{yKey}</strong>.</p>

      <VariableSelector columns={columns} yKey={yKey} onChange={handleChange} />

      <Plot
        data={[{ x: values, type: "histogram", marker: { color: "#3b82f6" } }]}
        layout={{ title: "Histograma" }}
        style={{ width: "100%", height: "400px" }}
      />
    </div>
  );
};
export default HistogramaPlotly;
