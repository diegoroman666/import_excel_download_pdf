/**
 * src/data/MTP.jsx
 *
 * Módulo para calcular Medidas de Posición (MTP):
 * percentiles, cuartiles y deciles.
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
 * Calcula el percentil de un array de números.
 * @param {Array<any>} data El array de datos.
 * @param {number} percentile El percentil a calcular (de 0 a 100).
 * @returns {number|null} El valor del percentil o null si los datos no son válidos.
 */
export function calculatePercentile(data, percentile) {
  const numericValues = getNumericValues(data);
  if (numericValues.length === 0 || percentile < 0 || percentile > 100) {
    return null;
  }
  const sortedData = numericValues.slice().sort((a, b) => a - b);
  const n = sortedData.length;
  const rank = (percentile / 100) * (n - 1);
  const i = Math.floor(rank);
  const remainder = rank - i;

  if (i + 1 < n) {
    return sortedData[i] + remainder * (sortedData[i + 1] - sortedData[i]);
  } else {
    return sortedData[i];
  }
}

/**
 * Calcula los cuartiles de un array de números.
 * @param {Array<any>} data El array de datos.
 * @returns {Object|null} Un objeto con los cuartiles (Q1, Q2, Q3) o null.
 */
export function calculateQuartiles(data) {
  const numericValues = getNumericValues(data);
  if (numericValues.length === 0) {
    return null;
  }
  return {
    q1: calculatePercentile(numericValues, 25),
    q2: calculatePercentile(numericValues, 50),
    q3: calculatePercentile(numericValues, 75)
  };
}

/**
 * Calcula los deciles de un array de números.
 * @param {Array<any>} data El array de datos.
 * @returns {Object|null} Un objeto con los deciles (D1 a D10) o null.
 */
export function calculateDeciles(data) {
  const numericValues = getNumericValues(data);
  if (numericValues.length === 0) {
    return null;
  }
  const deciles = {};
  for (let i = 1; i <= 10; i++) {
    deciles[`d${i}`] = calculatePercentile(numericValues, i * 10);
  }
  return deciles;
}

