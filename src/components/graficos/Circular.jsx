import React, { useMemo } from "react";
import { PieChart, Pie, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import { buildSeries, COLORS } from "./utils";
import "./Graficos.css";

export default function Circular({ data, columns, selectedColumn }) {
  const { series } = useMemo(
    () => buildSeries(data, columns, selectedColumn),
    [data, columns, selectedColumn]
  );

  if (!series.length) return <p>No hay datos para graficar.</p>;

  return (
    <div className="graficos-container" id="panel-circular">
      <div className="chart-card">
        <h4>Gráfico Circular</h4>
        <ResponsiveContainer width="100%" height={340}>
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={series} dataKey="value" nameKey="name" outerRadius={120} innerRadius={50} animationDuration={700}>
              {series.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
