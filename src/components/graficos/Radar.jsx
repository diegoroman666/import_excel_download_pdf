import React, { useMemo } from "react";
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { buildSeries } from "./utils";
import "./Graficos.css";

export default function RadarComp({ data, columns, selectedColumn }) {
  const { series } = useMemo(
    () => buildSeries(data, columns, selectedColumn),
    [data, columns, selectedColumn]
  );

  if (!series.length) return <p>No hay datos para graficar.</p>;

  return (
    <div className="graficos-container" id="panel-radar">
      <div className="chart-card">
        <h4>Gráfico Radar</h4>
        <div style={{ width: "100%", height: 360 }}>
          <RadarChart data={series} cx="50%" cy="50%" outerRadius="75%" width={800} height={360}>
            <PolarGrid />
            <PolarAngleAxis dataKey="name" />
            <PolarRadiusAxis />
            <Radar dataKey="value" stroke="#4e79a7" fill="#4e79a7" fillOpacity={0.45} />
          </RadarChart>
        </div>
      </div>
    </div>
  );
}
