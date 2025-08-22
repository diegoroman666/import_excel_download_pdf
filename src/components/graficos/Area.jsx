import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { buildSeries } from "./utils";
import "./Graficos.css";

export default function AreaChartComp({ data, columns, selectedColumn }) {
  const { series } = useMemo(
    () => buildSeries(data, columns, selectedColumn),
    [data, columns, selectedColumn]
  );

  if (!series.length) return <p>No hay datos para graficar.</p>;

  return (
    <div className="graficos-container" id="panel-area">
      <div className="chart-card">
        <h4>Gráfico de Área</h4>
        <ResponsiveContainer width="100%" height={340}>
          <AreaChart data={series}>
            <defs>
              <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4e79a7" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#4e79a7" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="value" stroke="#4e79a7" fill="url(#areaFill)" strokeWidth={2} animationDuration={700} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
