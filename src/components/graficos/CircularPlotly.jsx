// src/components/graficos/CircularPlotly.jsx
import React, { useState } from "react";
import Plot from "react-plotly.js";
import VariableSelector from "../VariableSelector";

const CircularPlotly = ({ data, columns }) => {
  const [nameKey, setNameKey] = useState(columns[0]?.name || "");
  const [valueKey, setValueKey] = useState(columns[1]?.name || "");

  const handleChange = (axis, value) => {
    if (axis === "x") setNameKey(value);
    if (axis === "y") setValueKey(value);
  };

  const labels = nameKey ? data.map((row) => row[nameKey]) : [];
  const values = valueKey ? data.map((row) => row[valueKey]) : [];

  return (
    <div className="p-4 bg-white shadow rounded-2xl">
      <h2 className="text-xl font-bold mb-2">🥧 Gráfico Circular</h2>
      <p className="mb-4 text-gray-600">Muestra la proporción de <strong>{valueKey}</strong> agrupada por <strong>{nameKey}</strong>.</p>

      <VariableSelector columns={columns} xKey={nameKey} yKey={valueKey} onChange={handleChange} />

      <Plot
        data={[{ labels, values, type: "pie", hole: 0.4 }]}
        layout={{ title: "Gráfico Circular (Dona)" }}
        style={{ width: "100%", height: "400px" }}
      />
    </div>
  );
};
export default CircularPlotly;
