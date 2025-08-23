// src/components/graficos/BarrasPlotly.jsx
import React, { useState } from "react";
import Plot from "react-plotly.js";
import VariableSelector from "../VariableSelector";

const BarrasPlotly = ({ data, columns }) => {
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
      <h2 className="text-xl font-bold mb-2">📊 Gráfico de Barras</h2>
      <p className="mb-4 text-gray-600">
        Compara valores de <strong>{yKey}</strong> en función de <strong>{xKey}</strong>.
      </p>

      <VariableSelector columns={columns} xKey={xKey} yKey={yKey} onChange={handleChange} />

      <Plot
        data={[
          {
            x,
            y,
            type: "bar",
            marker: { color: "#10b981" },
          },
        ]}
        layout={{ title: "Gráfico de Barras", autosize: true }}
        style={{ width: "100%", height: "400px" }}
      />
    </div>
  );
};
export default BarrasPlotly;
