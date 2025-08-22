import React, { useMemo } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toNumber, getNumericColumnKeys } from "./utils";
import "./Graficos.css";

export default function Dispersion({ data, columns, selectedColumn }) {
  const { points, xLabel, yLabel } = useMemo(() => {
    if (!data?.length || !columns?.length) return { points: [], xLabel: "", yLabel: "" };
    const numericKeys = getNumericColumnKeys(data, columns);
    if (!numericKeys.length) return { points: [], xLabel: "", yLabel: "" };

    let yKey = selectedColumn && numericKeys.includes(selectedColumn) ? selectedColumn : numericKeys[0];
    let xKey = numericKeys.find(k => k !== yKey) || null;

    // Si no hay otra numérica, usamos índice como X
    if (!xKey) {
      const pts = data
        .map((r, i) => {
          const y = toNumber(r?.[yKey]);
          return Number.isNaN(y) ? null : { x: i + 1, y };
        })
        .filter(Boolean);
      return { points: pts, xLabel: "Índice", yLabel: columns.find(c => c.key === yKey)?.name || yKey };
    }

    const pts = data
      .map(r => {
        const x = toNumber(r?.[xKey]);
        const y = toNumber(r?.[yKey]);
        return Number.isNaN(x) || Number.isNaN(y) ? null : { x, y };
      })
      .filter(Boolean);

    return {
      points: pts,
      xLabel: columns.find(c => c.key === xKey)?.name || xKey,
      yLabel: columns.find(c => c.key === yKey)?.name || yKey
    };
  }, [data, columns, selectedColumn]);

  if (!points.length) return <p>Para dispersión, se requieren al menos 1–2 columnas numéricas.</p>;

  return (
    <div className="graficos-container" id="panel-dispersion">
      <div className="chart-card">
        <h4>Gráfico de Dispersión</h4>
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="x" name={xLabel} />
            <YAxis dataKey="y" name={yLabel} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={points} fill="#4e79a7" animationDuration={700} />
          </ScatterChart>
        </ResponsiveContainer>
        <div className="axis-notes">
          <span className="axis-x">X: {xLabel}</span>
          <span className="axis-y">Y: {yLabel}</span>
        </div>
      </div>
    </div>
  );
}
