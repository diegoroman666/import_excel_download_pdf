// src/components/graficos/RegresionPlotly.jsx
import React, { useState } from "react";
import Plot from "react-plotly.js";
import VariableSelector from "../VariableSelector";

const linearRegression = (x, y) => {
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((acc, val, i) => acc + val * y[i], 0);
  const sumXX = x.reduce((acc, val) => acc + val * val, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX ** 2);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
};

const RegresionPlotly = ({ data, columns }) => {
  const [xKey, setXKey] = useState(columns[0]?.name || "");
  const [yKey, setYKey] = useState(columns[1]?.name || "");

  const handleChange = (axis, value) => {
    if (axis === "x") setXKey(value);
    if (axis === "y") setYKey(value);
  };

  const x = xKey ? data.map((row) => parseFloat(row[xKey])).filter((v) => !isNaN(v)) : [];
  const y = yKey ? data.map((row) => parseFloat(row[yKey])).filter((v) => !isNaN(v)) : [];

  const { slope, intercept } = x.length && y.length ? linearRegression(x, y) : { slope: 0, intercept: 0 };
  const regressionLine = x.map((val) => slope * val + intercept);

  return (
    <div className="p-4 bg-white shadow rounded-2xl">
      <h2 className="text-xl font-bold mb-2">📈 Regresión Lineal</h2>
      <p className="mb-4 text-gray-600">Muestra relación entre <strong>{xKey}</strong> y <strong>{yKey}</strong> con línea de tendencia.</p>

      <VariableSelector columns={columns} xKey={xKey} yKey={yKey} onChange={handleChange} />

      <Plot
        data={[
          { x, y, mode: "markers", type: "scatter", name: "Datos", marker: { color: "#3b82f6" } },
          { x, y: regressionLine, mode: "lines", type: "scatter", name: "Regresión", line: { color: "red" } },
        ]}
        layout={{ title: "Regresión Lineal" }}
        style={{ width: "100%", height: "400px" }}
      />
    </div>
  );
};
export default RegresionPlotly;
