// src/components/graficos/AreaPlotly.jsx
import React, { useState } from "react";
import Plot from "react-plotly.js";
import VariableSelector from "../VariableSelector";

const AreaPlotly = ({ data, columns }) => {
  const [xKey, setXKey] = useState(columns[0]?.name || "");
  const [yKey, setYKey] = useState(columns[1]?.name || "");

  const handleChange = (axis, value) => {
    if (axis === "x") setXKey(value);
    if (axis === "y") setYKey(value);
  };

  if (!data || data.length === 0) return <p>No hay datos suficientes.</p>;

  const x = xKey ? data.map((row) => row[xKey]) : [];
  const y = yKey ? data.map((row) => row[yKey]) : [];

  return (
    <div className="p-4 bg-white shadow-lg rounded-2xl">
      <h2 className="text-xl font-bold mb-2">📊 Gráfico de Área</h2>
      <p className="mb-4 text-gray-600">
        Similar al gráfico de líneas, pero el área bajo la curva de{" "}
        <strong>{yKey}</strong> se rellena.  
        Ideal para mostrar acumulación o volumen de datos en función de{" "}
        <strong>{xKey}</strong>.
      </p>

      {/* Selector dinámico */}
      <VariableSelector
        columns={columns}
        xKey={xKey}
        yKey={yKey}
        onChange={handleChange}
      />

      {/* Gráfico */}
      <Plot
        data={[
          {
            x,
            y,
            type: "scatter",
            mode: "lines",
            fill: "tozeroy",
            line: { color: "#3b82f6" },
          },
        ]}
        layout={{
          title: "Gráfico de Área",
          autosize: true,
          margin: { t: 40, l: 40, r: 20, b: 40 },
        }}
        style={{ width: "100%", height: "400px" }}
        config={{ responsive: true }}
      />
    </div>
  );
};

export default AreaPlotly;
