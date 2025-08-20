/**
 * src/data/Frecuencia.jsx
 *
 * Módulo para generar tablas de frecuencia (agrupadas y no agrupadas).
 */

// Utilidad: filtra y convierte a números válidos
function getNumericValues(data) {
  return data
    .map(value => {
      // Intenta convertir a número (admite "1.234,56" y "1,234.56")
      const s = String(value).trim();
      const norm = s.replace(/\./g, "").replace(",", ".");
      const n = parseFloat(norm);
      return Number.isNaN(n) ? parseFloat(s) : n;
    })
    .filter(value => !Number.isNaN(value));
}

/**
 * Genera una tabla de frecuencia no agrupada.
 * Ideal para datos categóricos o numéricos con pocas repeticiones.
 * @param {Array<any>} data El array de datos.
 * @returns {Array<Object>} Un array de objetos con el valor, frecuencia absoluta, relativa y acumulada.
 */
export function createUngroupedFrequencyTable(data) {
  if (!data || data.length === 0) {
    return [];
  }

  const counts = new Map();
  for (const item of data) {
    const key = (item === null || item === undefined) ? "(vacío)" : String(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const table = Array.from(counts.keys()).map(key => {
    return {
      value: key,
      absoluteFrequency: counts.get(key),
      relativeFrequency: counts.get(key) / data.length
    };
  }).sort((a, b) => a.value.localeCompare(b.value, undefined, { numeric: true })); // Ordena alfabéticamente/numéricamente

  // Calcula la frecuencia acumulada
  let cumulativeFrequency = 0;
  let cumulativeRelativeFrequency = 0;
  return table.map(row => {
    cumulativeFrequency += row.absoluteFrequency;
    cumulativeRelativeFrequency += row.relativeFrequency;
    return {
      ...row,
      cumulativeFrequency,
      relativeFrequency: parseFloat(row.relativeFrequency.toFixed(4)),
      cumulativeRelativeFrequency: parseFloat(cumulativeRelativeFrequency.toFixed(4))
    };
  });
}

/**
 * Genera una tabla de frecuencia agrupada.
 * Ideal para grandes conjuntos de datos numéricos. Utiliza la regla de Sturges para determinar el número de clases.
 * @param {Array<any>} data El array de datos.
 * @returns {Array<Object>|null} Un array de objetos con los intervalos, marca de clase, frecuencia, etc. o null si no hay datos.
 */
export function createGroupedFrequencyTable(data) {
  const numericValues = getNumericValues(data);
  if (numericValues.length === 0) {
    return null;
  }
  const n = numericValues.length;
  const sortedData = numericValues.sort((a, b) => a - b);
  const min = sortedData[0];
  const max = sortedData[n - 1];
  const range = max - min;

  if (n === 1 || range === 0) {
    // Si solo hay un valor o todos son iguales, no tiene sentido agrupar.
    return null;
  }

  // Regla de Sturges para el número de clases (k)
  const k = Math.ceil(1 + 3.322 * Math.log10(n));
  const classWidth = range / k;

  const table = [];
  let currentStart = min;
  let accumulatedCount = 0;
  let accumulatedRelative = 0;

  for (let i = 0; i < k; i++) {
    const start = currentStart;
    let end = start + classWidth;
    // El último intervalo debe incluir el valor máximo
    if (i === k - 1) {
      end = max;
    }

    const intervalData = sortedData.filter(value => value >= start && value <= end);
    const absoluteFrequency = intervalData.length;
    const relativeFrequency = absoluteFrequency / n;

    accumulatedCount += absoluteFrequency;
    accumulatedRelative += relativeFrequency;
    const classMark = (start + end) / 2;

    table.push({
      interval: `[${start.toFixed(2)} - ${end.toFixed(2)}]`,
      classMark: parseFloat(classMark.toFixed(2)),
      absoluteFrequency: absoluteFrequency,
      relativeFrequency: parseFloat(relativeFrequency.toFixed(4)),
      cumulativeFrequency: accumulatedCount,
      cumulativeRelativeFrequency: parseFloat(accumulatedRelative.toFixed(4))
    });
    
    currentStart = end;
  }
  return table;
}
