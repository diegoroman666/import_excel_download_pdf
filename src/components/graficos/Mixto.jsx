import React, { useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { toNumber, getNumericColumnKeys } from "./utils";
import "./Graficos.css";

export default function Mixto({ data, columns, selectedColumn }) {
  const { mixedData, barKey, lineKey } = useMemo(() => {
    if (!data?.length || !columns?.length) return { mixedData: [], barKey: null, lineKey: null };
    const numericKeys = getNumericColumnKeys(data, columns);
    if (!numericKeys.length) return { mixedData: [], barKey: null, lineKey: null };

    // Elegimos barKey y lineKey
    let barK = selectedColumn && numericKeys.includes(selectedColumn) ? selectedColumn : numericKeys[0];
    let lineK = numericKeys.find(k => k !== barK) || barK;

    // Buscar una categórica
    const catKey = columns.find(c => !numericKeys.includes(c.key))?.key;
    if (!catKey) {
      // sin categórica: indexamos
      const arr = data.map((r, i) => {
        const a = toNumber(r?.[barK]);
        const b = toNumber(r?.[lineK]);
        return {
          name: `#${i + 1}`,
          [barK]: Number.isNaN(a) ? 0 : a,
          [lineK]: Number.isNaN(b) ? 0 : b
        };
      });
      return { mixedData: arr, barKey: barK, lineKey: lineK };
    }

    const map = new Map();
    data.forEach(r => {
      const catRaw = r?.[catKey];
      const cat = (catRaw === null || catRaw === undefined || catRaw === "") ? "(vacío)" : String(catRaw);
      if (!map.has(cat)) map.set(cat, { name: cat, [barK]: 0, [lineK]: 0 });
      const obj = map.get(cat);
      const a = toNumber(r?.[barK]); if (!Number.isNaN(a)) obj[barK] += a;
      const b = toNumber(r?.[lineK]); if (!Number.isNaN(b)) obj[lineK] += b;
    });

    const arr = Array.from(map.values());
    // ordenar por barKey desc y tomar top 12
    arr.sort((a, b) => (b[barK] || 0) - (a[barK] || 0));
    return { mixedData: arr.slice(0, 12), barKey: barK, lineKey: lineK };
  }, [data, columns, selectedColumn]);

  if (!mixedData.length || !barKey || !lineKey) return <p>Se requiere al menos una columna numérica. Para mostrar línea distinta, agrega otra columna numérica.</p>;

  return (
    <div className="graficos-container" id="panel-mixto">
      <div className="chart-card">
        <h4>Gráfico Mixto (Barras + Línea)</h4>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={mixedData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey={barKey} fill="#4e79a7" />
            <Line type="monotone" dataKey={lineKey} stroke="#f28e2c" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
