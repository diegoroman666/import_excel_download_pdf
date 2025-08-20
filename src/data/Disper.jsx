/**
 * src/data/Disper.jsx
 *
 * Módulo para calcular Medidas de Dispersión:
 * varianza, desviación estándar, rango y coeficiente de variación.
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
 * Calcula el rango de un array de números.
 * @param {Array<any>} data El array de datos.
 * @returns {number|null} El rango o null si los datos no son válidos.
 */
export function calculateRange(data) {
  const numericValues = getNumericValues(data);
  if (numericValues.length === 0) {
    return null;
  }
  const min = Math.min(...numericValues);
  const max = Math.max(...numericValues);
  return max - min;
}

/**
 * Calcula la varianza de un array de números.
 * @param {Array<any>} data El array de datos.
 * @returns {number|null} La varianza o null si los datos no son válidos.
 */
export function calculateVariance(data) {
  const numericValues = getNumericValues(data);
  if (numericValues.length < 2) {
    return null;
  }
  const mean = numericValues.reduce((acc, curr) => acc + curr, 0) / numericValues.length;
  const sumOfSquares = numericValues.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0);
  return sumOfSquares / (numericValues.length - 1); // Varianza muestral
}

/**
 * Calcula la desviación estándar de un array de números.
 * @param {Array<any>} data El array de datos.
 * @returns {number|null} La desviación estándar o null si los datos no son válidos.
 */
export function calculateStandardDeviation(data) {
  const variance = calculateVariance(data);
  if (variance === null) {
    return null;
  }
  return Math.sqrt(variance);
}

/**
 * Calcula el coeficiente de variación de un array de números.
 * @param {Array<any>} data El array de datos.
 * @returns {number|null} El coeficiente de variación o null si los datos no son válidos.
 */
export function calculateCoefficientOfVariation(data) {
  const numericValues = getNumericValues(data);
  if (numericValues.length < 2) {
    return null;
  }
  const mean = numericValues.reduce((acc, curr) => acc + curr, 0) / numericValues.length;
  const standardDeviation = calculateStandardDeviation(numericValues);

  if (mean === 0) {
    return Infinity;
  }
  
  return standardDeviation / Math.abs(mean);
}
