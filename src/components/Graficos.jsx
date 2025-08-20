import React, { useMemo } from "react";
import "./Graficos.css";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";

// Utilidad: intenta convertir a número (admite "1.234,56" y "1,234.56")
function toNumber(val) {
  if (val === null || val === undefined) return NaN;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (!s) return NaN;
  // normaliza decimales con coma
  const norm = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(norm);
  return Number.isNaN(n) ? parseFloat(s) : n;
}

// Detecta columnas numéricas basadas en tasa de valores convertibles
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
    if (max > 0 && countNumeric / max >= threshold) {
      numericKeys.push(key);
    }
  }
  return numericKeys;
}

// Elige una columna categórica (no numérica) si existe, si no usa el índice
function getCategoryKey(data, columns, numericKeys) {
  const nonNumeric = columns.map(c => c.key).filter(k => !numericKeys.includes(k));
  if (nonNumeric.length > 0) return nonNumeric[0];
  return null; // forzaremos histograma si no hay categórica
}

// Agrega por categoría (suma)
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
  // limita a top 12 para legibilidad
  arr.sort((a,b) => b.value - a.value);
  return arr.slice(0, 12);
}

// Genera bins para histograma (si no hay categórica)
function histogram(data, valKey, bins = 8) {
  const values = data.map(r => toNumber(r?.[valKey])).filter(v => !Number.isNaN(v));
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    // todos iguales → un solo bin
    return [{ name: `${min}`, value: values.length }];
  }
  const width = (max - min) / bins;
  const result = Array.from({ length: bins }, (_, i) => {
    const from = min + i * width;
    const to = i === bins - 1 ? max : from + width;
    return { from, to, count: 0 };
  });
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

function Graficos({ data, columns }) {
  // Computa datasets en función de data/columns
  const { barData, pieData, xLabel, yLabel, mode } = useMemo(() => {
    if (!data || !columns || data.length === 0 || columns.length === 0) {
      return { barData: [], pieData: [], xLabel: "", yLabel: "", mode: "empty" };
    }

    const numericKeys = getNumericColumnKeys(data, columns);
    // label de columnas
    const byKey = new Map(columns.map(c => [c.key, c.name || c.key]));

    if (numericKeys.length === 0) {
      // Sin numéricas → conteo por primera columna como categorías
      const catKey = columns[0].key;
      const countMap = new Map();
      for (const r of data) {
        const cat = String(r?.[catKey] ?? "(vacío)");
        countMap.set(cat, (countMap.get(cat) || 0) + 1);
      }
      const arr = Array.from(countMap, ([name, value]) => ({ name, value }))
        .sort((a,b)=>b.value-a.value)
        .slice(0, 12);
      return {
        barData: arr,
        pieData: arr,
        xLabel: byKey.get(catKey),
        yLabel: "Conteo",
        mode: "count"
      };
    }

    // Tenemos numéricas: usamos la primera para Y
    const yKey = numericKeys[0];
    const catKey = getCategoryKey(data, columns, numericKeys);

    if (catKey) {
      // Agregar por categoría
      const agg = aggregateByCategory(data, catKey, yKey);
      return {
        barData: agg,
        pieData: agg,
        xLabel: byKey.get(catKey),
        yLabel: byKey.get(yKey),
        mode: "cat-sum"
      };
    } else {
      // Sin categóricas → histograma de la numérica
      const hist = histogram(data, yKey, 8);
      return {
        barData: hist,
        pieData: hist,
        xLabel: byKey.get(yKey) + " (bins)",
        yLabel: "Conteo",
        mode: "hist"
      };
    }
  }, [data, columns]);

  return (
    <div className="graficos-container">
      <div className="graficos-header">
        <h3>Visualización automática</h3>
        <p className="subtitle">
          {mode === "cat-sum" && "Agregación por categoría (suma del valor)."}
          {mode === "hist" && "Distribución (histograma) de la columna numérica."}
          {mode === "count" && "Conteo por categoría en la primera columna."}
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
              <Bar dataKey="value" animationDuration={700} />
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
                isAnimationActive
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
