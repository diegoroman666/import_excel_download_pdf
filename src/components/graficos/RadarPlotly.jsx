// src/components/graficos/RadarPlotly.jsx
import React, { useState } from "react";
import Plot from "react-plotly.js";
import VariableSelector from "../VariableSelector";

const RadarPlotly = ({ data, columns }) => {
  const [angleKey, setAngleKey] = useState(columns[0]?.name || "");
  const [valueKey, setValueKey] = useState(columns[1]?.name || "");

  const handleChange = (axis, value) => {
    if (axis === "x") setAngleKey(value);
    if (axis === "y") setValueKey(value);
  };

  const categories = angleKey ? data.map((row) => row[angleKey]) : [];
  const values = valueKey ? data.map((row) => row[valueKey]) : [];

  return (
    <div className="p-4 bg-white shadow rounded-2xl">
      <h2 className="text-xl font-bold mb-2">📡 Radar</h2>
      <p className="mb-4 text-gray-600">Comparación de <strong>{valueKey}</strong> en categorías de <strong>{angleKey}</strong>.</p>

      <VariableSelector columns={columns} xKey={angleKey} yKey={valueKey} onChange={handleChange} />

      <Plot
        data={[{ type: "scatterpolar", r: values, theta: categories, fill: "toself", name: valueKey }]}
        layout={{ polar: { radialaxis: { visible: true } }, title: "Radar" }}
        style={{ width: "100%", height: "400px" }}
      />
    </div>
  );
};
export default RadarPlotly;
