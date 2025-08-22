export function toNumber(val) {
  if (val === null || val === undefined) return NaN;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (!s) return NaN;
  const norm = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(norm);
  return Number.isNaN(n) ? parseFloat(s) : n;
}

export function getNumericColumnKeys(data, columns, sampleSize = 100, threshold = 0.6) {
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

export function countByCategory(data, catKey) {
  const map = new Map();
  for (const r of data) {
    const catRaw = r?.[catKey];
    const cat = (catRaw === null || catRaw === undefined || catRaw === "") ? "(vacío)" : String(catRaw);
    map.set(cat, (map.get(cat) || 0) + 1);
  }
  const arr = Array.from(map, ([name, value]) => ({ name, value }));
  arr.sort((a, b) => b.value - a.value);
  return arr.slice(0, 12);
}

export function aggregateByCategory(data, catKey, valKey) {
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

export function histogram(data, valKey, bins = 8) {
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

export const COLORS = [
  "#4e79a7","#f28e2c","#e15759","#76b7b2","#59a14f",
  "#edc949","#af7aa1","#ff9da7","#9c755f","#bab0ab",
  "#6b83b7","#73c2b0"
];

/**
 * Devuelve: 
 *  - si selectedColumn no es numérica => conteo por categoría de esa columna
 *  - si es numérica + existe columna categórica => suma por categoría
 *  - si es numérica y NO hay categórica => histograma
 */
export function buildSeries(data, columns, selectedColumn) {
  if (!data?.length || !columns?.length || !selectedColumn) return { kind: "empty", series: [] };
  const numericKeys = getNumericColumnKeys(data, columns);
  const isNumeric = numericKeys.includes(selectedColumn);

  if (!isNumeric) {
    return { kind: "count", series: countByCategory(data, selectedColumn) };
  }

  const catKey = columns.find(c => c.key !== selectedColumn && !numericKeys.includes(c.key))?.key;
  if (catKey) {
    return { kind: "cat-sum", series: aggregateByCategory(data, catKey, selectedColumn), catKey };
  }
  return { kind: "hist", series: histogram(data, selectedColumn) };
}
