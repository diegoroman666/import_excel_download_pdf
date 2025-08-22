import React, { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { toNumber, getNumericColumnKeys } from "./utils";
import "./Graficos.css";

export default function Stacked({ data, columns, selectedColumn }) {
  const { stackedData, seriesKeys } = useMemo(() => {
    if (!data?.length || !columns?.length) return { stackedData: [], seriesKeys: [] };
    const numericKeys = getNumericColumnKeys(data, columns);
    const catKey = columns.find(c => !numericKeys.includes(c.key))?.key; // primera categórica
    if (!catKey && numericKeys.length < 2) return { stackedData: [], seriesKeys: [] };

    // Elegimos hasta 3 series numéricas (incluyendo la seleccionada si es numérica)
    const ordered = [...numericKeys];
    if (selectedColumn && numericKeys.includes(selectedColumn)) {
      // Llevar la seleccionada al frente
      ordered.sort((a, b) => (a === selectedColumn ? -1 : b === selectedColumn ? 1 : 0));
    }
    const chosen = ordered.slice(0, 3);
    // Si no hay categórica, sintetizamos categoría por bins del primer numérico
    if (!catKey) {
      // agrupamos por rango del primer numérico para simular categorías
      const baseKey = chosen[0];
      const values = data.map(r => toNumber(r?.[baseKey])).filter(v => !Number.isNaN(v));
      if (!values.length) return { stackedData: [], seriesKeys: [] };
      const min = Math.min(...values);
      const max = Math.max(...values);
      if (min === max) {
        const single = {};
        chosen.forEach(k => {
          single.name = `${min}`;
          single[k] = data
            .map(r => toNumber(r?.[k]))
            .filter(v => !Number.isNaN(v))
            .reduce((a, b) => a + b, 0);
        });
        return { stackedData: [single], seriesKeys: chosen };
      }
      const bins = 6;
      const width = (max - min) / bins;
      const buckets = Array.from({ length: bins }, (_, i) => ({
        name: `[${Number((min + i * width).toFixed(2))} – ${Number((min + (i + 1) * width).toFixed(2))})`
      }));
      data.forEach(r => {
        const val = toNumber(r?.[baseKey]);
        if (Number.isNaN(val)) return;
        const idx = Math.min(Math.floor((val - min) / width), bins - 1);
        chosen.forEach(k => {
          const v = toNumber(r?.[k]);
          if (!Number.isNaN(v)) buckets[idx][k] = (buckets[idx][k] || 0) + v;
        });
      });
      return { stackedData: buckets, seriesKeys: chosen };
    }

    // Con categórica real: agregamos sumas por categoría y por serie
    const groups = new Map();
    data.forEach(r => {
      const catRaw = r?.[catKey];
      const cat = (catRaw === null || catRaw === undefined || catRaw === "") ? "(vacío)" : String(catRaw);
      if (!groups.has(cat)) groups.set(cat, { name: cat });
      const obj = groups.get(cat);
      chosen.forEach(k => {
        const v = toNumber(r?.[k]);
        if (!Number.isNaN(v)) obj[k] = (obj[k] || 0) + v;
      });
    });

    const arr = Array.from(groups.values());
    // ordenar por suma total desc y recortar a 12 categorías
    arr.sort((a, b) => {
      const sa = chosen.reduce((acc, k) => acc + (a[k] || 0), 0);
      const sb = chosen.reduce((acc, k) => acc + (b[k] || 0), 0);
      return sb - sa;
    });
    return { stackedData: arr.slice(0, 12), seriesKeys: chosen };
  }, [data, columns, selectedColumn]);

  if (!stackedData.length || !seriesKeys.length) return <p>Se requieren al menos 1 columna categórica y 2 numéricas (o 2 numéricas para agrupar por rangos).</p>;

  return (
    <div className="graficos-container" id="panel-stacked">
      <div className="chart-card">
        <h4>Barras Apiladas</h4>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={stackedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            {seriesKeys.map((k, i) => (
              <Bar key={k} stackId="total" dataKey={k} fill={["#4e79a7","#f28e2c","#59a14f","#e15759"][i % 4]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
