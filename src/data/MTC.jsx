/**
 * src/data/MTC.jsx
 *
 * Módulo para calcular Medidas de Tendencia Central (MTC):
 * media, mediana y moda.
 *
 * @param {Array<number>} data Array de números.
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
 * Calcula la media (promedio) de un array de números.
 * @param {Array<any>} data El array de datos.
 * @returns {number|null} La media o null si los datos no son válidos.
 */
export function calculateMean(data) {
  const numericValues = getNumericValues(data);
  if (numericValues.length === 0) {
    return null;
  }
  const sum = numericValues.reduce((acc, curr) => acc + curr, 0);
  return sum / numericValues.length;
}

/**
 * Calcula la mediana de un array de números.
 * @param {Array<any>} data El array de datos.
 * @returns {number|null} La mediana o null si los datos no son válidos.
 */
export function calculateMedian(data) {
  const numericValues = getNumericValues(data);
  if (numericValues.length === 0) {
    return null;
  }
  const sortedData = numericValues.slice().sort((a, b) => a - b);
  const mid = Math.floor(sortedData.length / 2);

  if (sortedData.length % 2 === 0) {
    // Par: promedio de los dos del medio
    return (sortedData[mid - 1] + sortedData[mid]) / 2;
  } else {
    // Impar: el del medio
    return sortedData[mid];
  }
}

/**
 * Calcula la moda de un array de números.
 * Puede haber más de una moda (multimodal).
 * @param {Array<any>} data El array de datos.
 * @returns {Array<number>|null} Un array con las modas o null si los datos no son válidos.
 */
export function calculateMode(data) {
  const numericValues = getNumericValues(data);
  if (numericValues.length === 0) {
    return null;
  }

  const counts = {};
  numericValues.forEach(value => {
    counts[value] = (counts[value] || 0) + 1;
  });

  let maxCount = 0;
  let modes = [];

  for (const key in counts) {
    const value = Number(key);
    const count = counts[key];
    if (count > maxCount) {
      maxCount = count;
      modes = [value];
    } else if (count === maxCount && maxCount > 1) {
      modes.push(value);
    }
  }
  
  // Si todos los valores aparecen una sola vez, no hay moda
  if (modes.length === numericValues.length) {
    return null;
  }

  return modes.length > 0 ? modes.sort((a, b) => a - b) : null;
}
