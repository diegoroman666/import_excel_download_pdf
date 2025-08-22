// src/components/Graficos.jsx
import React, { useMemo } from "react";
import "./Graficos.css";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

// ------------------- Utilidades -------------------
function toNumber(val) {
  if (val === null || val === undefined) return NaN;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (!s) return NaN;
  const norm = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(norm);
  return Number.isNaN(n) ? parseFloat(s) : n;
}

function getNumericColumnKeys(data, columns, sampleSize = 100, threshold = 0.6) {
  const keys = columns.map(c => c.key);
  const max = Math.min(sampleSize, data.length);
  const numericKeys = [];

  for (const key of keys) {
    let countNumeric = 0;
    for (let i = 0; i < max; i++) {
      const v = data[i]?.[key];
      if (!Number.isNaN(toNumber(v))) countNumeric++;
    }
    if (max > 0 && countNumeric / max >= threshold) numericKeys.push(key);
  }
  return numericKeys;
}

function aggregateByCategory(data, catKey, valKey) {
  const map = new Map();
  for (const row of data) {
    const catRaw = row?.[catKey];
    const cat = (catRaw === null || catRaw === undefined || catRaw === "") ? "(vacío)" : String(catRaw);
    const y = toNumber(row?.[valKey]);
    if (!Number.isNaN(y)) {
      map.set(cat, (map.get(cat) || 0) + y);
    }
  }
  const arr = Array.from(map, ([name, value]) => ({ name, value }));
  arr.sort((a, b) => b.value - a.value);
  return arr.slice(0, 12);
}

function histogram(data, valKey, bins = 8) {
  const values = data.map(r => toNumber(r?.[valKey])).filter(v => !Number.isNaN(v));
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) return [{ name: `${min}`, value: values.length }];
  const width = (max - min) / bins;
  const result = Array.from({ length: bins }, (_, i) => ({
    from: min + i * width,
    to: i === bins - 1 ? max : min + (i + 1) * width,
    count: 0
  }));
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / width), bins - 1);
    result[idx].count++;
  }
  return result.map(bin => ({
    name: `[${Number(bin.from.toFixed(2))} – ${Number(bin.to.toFixed(2))})`,
    value: bin.count
  }));
}

const COLORS = [
  "#4e79a7","#f28e2c","#e15759","#76b7b2","#59a14f",
  "#edc949","#af7aa1","#ff9da7","#9c755f","#bab0ab",
  "#6b83b7","#73c2b0"
];

// ------------------- Componente principal -------------------
function Graficos({ data, columns, selectedColumn }) {
  const { barData, pieData, xLabel, yLabel, mode } = useMemo(() => {
    if (!data || !columns || data.length === 0 || columns.length === 0) {
      return { barData: [], pieData: [], xLabel: "", yLabel: "", mode: "empty" };
    }

    const numericKeys = getNumericColumnKeys(data, columns);
    const byKey = new Map(columns.map(c => [c.key, c.name || c.key]));

    // Caso 1: Si el usuario selecciona una columna categórica → contamos
    if (selectedColumn && !numericKeys.includes(selectedColumn)) {
      const countMap = new Map();
      for (const r of data) {
        const cat = String(r?.[selectedColumn] ?? "(vacío)");
        countMap.set(cat, (countMap.get(cat) || 0) + 1);
      }
      const arr = Array.from(countMap, ([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12);
      return { barData: arr, pieData: arr, xLabel: byKey.get(selectedColumn), yLabel: "Conteo", mode: "count" };
    }

    // Caso 2: Si selecciona o existe columna numérica
    let yKey = selectedColumn && numericKeys.includes(selectedColumn) ? selectedColumn : numericKeys[0] || null;
    if (!yKey) {
      return { barData: [], pieData: [], xLabel: "", yLabel: "", mode: "empty" };
    }

    // Buscar categórica para eje X
    const catKey = columns.find(c => c.key !== yKey && !numericKeys.includes(c.key))?.key;
    if (catKey) {
      const agg = aggregateByCategory(data, catKey, yKey);
      return { barData: agg, pieData: agg, xLabel: byKey.get(catKey), yLabel: byKey.get(yKey), mode: "cat-sum" };
    } else {
      const hist = histogram(data, yKey, 8);
      return { barData: hist, pieData: hist, xLabel: byKey.get(yKey) + " (bins)", yLabel: "Conteo", mode: "hist" };
    }
  }, [data, columns, selectedColumn]);

  if (!barData.length) return <p>No hay datos para graficar.</p>;

  return (
    <div className="graficos-container">
      <div className="graficos-header">
        <h3>Visualización automática</h3>
        <p className="subtitle">
          {mode === "cat-sum" && "Agregación por categoría (suma del valor)."}
          {mode === "hist" && "Distribución (histograma) de la columna numérica."}
          {mode === "count" && "Conteo por categoría."}
        </p>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h4>Gráfico de Barras</h4>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={0} height={50} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" animationDuration={700} fill="#4e79a7" />
            </BarChart>
          </ResponsiveContainer>
          <div className="axis-notes">
            <span className="axis-x">X: {xLabel || "Categoría"}</span>
            <span className="axis-y">Y: {yLabel || "Valor"}</span>
          </div>
        </div>

        <div className="chart-card">
          <h4>Gráfico Circular</h4>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Tooltip />
              <Legend />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                outerRadius={110}
                innerRadius={40}
                animationDuration={700}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`slice-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Graficos;
