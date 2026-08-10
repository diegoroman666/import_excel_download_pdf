import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bytes, capitalizar, celda, compacto, entero, numero, porcentaje, porcentajeDirecto, truncar } from '../../lib/format.js';

describe('formato de números', () => {
  it('marca los valores ausentes con un guion', () => {
    assert.equal(numero(null), '—');
    assert.equal(numero(undefined), '—');
    assert.equal(numero(NaN), '—');
    assert.equal(entero(null), '—');
  });

  it('abrevia las magnitudes grandes', () => {
    assert.match(compacto(2_500_000), /M$/);
    assert.match(compacto(45_000), /k$/);
    assert.equal(compacto(999), '999');
  });

  it('convierte fracciones y valores base 100', () => {
    assert.equal(porcentaje(0.25), '25 %');
    assert.equal(porcentajeDirecto(25), '25 %');
  });

  it('describe tamaños de archivo', () => {
    assert.equal(bytes(1024), '1 KB');
    assert.match(bytes(5 * 1024 * 1024), /MB$/);
  });
});

describe('celda', () => {
  it('muestra un guion en los vacíos', () => {
    assert.equal(celda(null), '—');
    assert.equal(celda(''), '—');
  });

  it('acorta las fechas ISO a medianoche', () => {
    assert.equal(celda('2024-05-01T00:00:00'), '2024-05-01');
  });

  it('traduce los booleanos', () => {
    assert.equal(celda(true), 'Sí');
    assert.equal(celda(false), 'No');
  });
});

describe('texto', () => {
  it('trunca conservando el inicio', () => {
    assert.equal(truncar('abcdefghij', 5), 'abcd…');
    assert.equal(truncar('abc', 5), 'abc');
  });

  it('capitaliza escalas normalizadas', () => {
    assert.equal(capitalizar('bajo'), 'Bajo');
    assert.equal(capitalizar(''), '');
  });
});
