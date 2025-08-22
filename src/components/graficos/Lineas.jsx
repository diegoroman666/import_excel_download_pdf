import React, { useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { buildSeries } from "./utils";
import "./Graficos.css";

export default function Lineas({ data, columns, selectedColumn }) {
  const { series } = useMemo(
    () => buildSeries(data, columns, selectedColumn),
    [data, columns, selectedColumn]
  );

  if (!series.length) return <p>No hay datos para graficar.</p>;

  return (
    <div className="graficos-container" id="panel-lineas">
      <div className="chart-card">
        <h4>Gráfico de Líneas</h4>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="value" dot={false} stroke="#4e79a7" strokeWidth={2} animationDuration={700} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
