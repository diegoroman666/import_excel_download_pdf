import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { buildSeries } from "./utils";
import "./Graficos.css";

export default function Histograma({ data, columns, selectedColumn }) {
  const { kind, series } = useMemo(
    () => buildSeries(data, columns, selectedColumn),
    [data, columns, selectedColumn]
  );

  const isHist = kind === "hist";
  if (!series.length || !isHist) {
    // Si el usuario eligió una columna no numérica, mostramos mensaje dirigido
    return <p>Para histograma, selecciona una columna numérica o carga datos numéricos.</p>;
  }

  return (
    <div className="graficos-container" id="panel-histograma">
      <div className="chart-card">
        <h4>Histograma</h4>
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#4e79a7" animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
