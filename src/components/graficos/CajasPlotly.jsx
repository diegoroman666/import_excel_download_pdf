// src/components/graficos/CajasPlotly.jsx
import React, { useState } from "react";
import Plot from "react-plotly.js";
import VariableSelector from "../VariableSelector";

const CajasPlotly = ({ data, columns }) => {
  const [yKey, setYKey] = useState(columns[0]?.name || "");

  const handleChange = (axis, value) => {
    if (axis === "y") setYKey(value);
  };

  const y = yKey ? data.map((row) => row[yKey]) : [];

  return (
    <div className="p-4 bg-white shadow rounded-2xl">
      <h2 className="text-xl font-bold mb-2">📦 Diagrama de Cajas</h2>
      <p className="mb-4 text-gray-600">
        Resume la distribución de <strong>{yKey}</strong>, mostrando mediana, cuartiles y valores atípicos.
      </p>

      <VariableSelector columns={columns} yKey={yKey} onChange={handleChange} />

      <Plot
        data={[{ y, type: "box", boxpoints: "outliers", marker: { color: "#f59e0b" } }]}
        layout={{ title: "Diagrama de Cajas" }}
        style={{ width: "100%", height: "400px" }}
      />
    </div>
  );
};
export default CajasPlotly;
