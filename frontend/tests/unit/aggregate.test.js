import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  agruparPor,
  agruparPorDos,
  correlacionPearson,
  histograma,
  matrizCorrelacion,
  paresNumericos,
  regresionLineal,
  serieNumerica,
} from '../../lib/aggregate.js';

const FILAS = [
  { cat: 'A', sub: 'x', valor: 10 },
  { cat: 'A', sub: 'y', valor: 20 },
  { cat: 'B', sub: 'x', valor: 5 },
  { cat: 'B', sub: 'y', valor: 15 },
  { cat: 'B', sub: 'y', valor: 25 },
  { cat: null, sub: 'x', valor: null },
];

describe('agruparPor', () => {
  it('suma la medida por categoría y ordena de mayor a menor', () => {
    const { categorias, valores } = agruparPor(FILAS, 'cat', 'valor');
    assert.deepEqual(categorias, ['B', 'A']);
    assert.deepEqual(valores, [45, 30]);
  });

  it('cuenta las filas cuando no hay medida', () => {
    const { categorias, valores } = agruparPor(FILAS, 'cat', null);
    assert.equal(categorias.length, 3);
    assert.equal(valores.reduce((a, b) => a + b, 0), 6);
  });

  it('agrupa los vacíos bajo una etiqueta propia', () => {
    const { categorias } = agruparPor(FILAS, 'cat', null);
    assert.ok(categorias.includes('(vacío)'));
  });

  it('calcula el promedio cuando se pide', () => {
    const { categorias, valores } = agruparPor(FILAS, 'cat', 'valor', { agregacion: 'promedio' });
    const indiceA = categorias.indexOf('A');
    assert.equal(valores[indiceA], 15);
  });

  it('respeta el orden de una escala ordinal', () => {
    const filas = [
      { nivel: 'Alto', v: 1 },
      { nivel: 'Bajo', v: 5 },
      { nivel: 'Medio', v: 3 },
    ];
    const { categorias } = agruparPor(filas, 'nivel', 'v', {
      ordenCategorias: ['Bajo', 'Medio', 'Alto'],
    });
    assert.deepEqual(categorias, ['Bajo', 'Medio', 'Alto']);
  });

  it('indica cuándo se truncaron categorías', () => {
    const muchas = Array.from({ length: 40 }, (_, i) => ({ cat: `c${i}`, valor: i }));
    const resultado = agruparPor(muchas, 'cat', 'valor', { limite: 10 });
    assert.equal(resultado.categorias.length, 10);
    assert.equal(resultado.truncado, true);
    assert.equal(resultado.totalCategorias, 40);
  });
});

describe('agruparPorDos', () => {
  it('construye la matriz categoría × serie', () => {
    const { categorias, series, matriz } = agruparPorDos(FILAS, 'cat', 'sub', 'valor');
    assert.equal(matriz.length, series.length);
    assert.equal(matriz[0].length, categorias.length);

    const indiceB = categorias.indexOf('B');
    const indiceY = series.indexOf('y');
    assert.equal(matriz[indiceY][indiceB], 40);
  });

  it('rellena con cero las combinaciones inexistentes', () => {
    const { categorias, series, matriz } = agruparPorDos(
      [{ c: 'A', s: 'x', v: 1 }, { c: 'B', s: 'y', v: 2 }],
      'c',
      's',
      'v',
    );
    const fila = matriz[series.indexOf('x')];
    assert.equal(fila[categorias.indexOf('B')], 0);
  });
});

describe('paresNumericos', () => {
  it('descarta la fila entera si falta cualquiera de los dos valores', () => {
    const filas = [
      { x: 1, y: 2 },
      { x: null, y: 3 },
      { x: 4, y: null },
      { x: 5, y: 6 },
    ];
    const { x, y } = paresNumericos(filas, 'x', 'y');
    assert.deepEqual(x, [1, 5]);
    assert.deepEqual(y, [2, 6]);
  });
});

describe('serieNumerica', () => {
  it('descarta valores no numéricos', () => {
    const valores = serieNumerica([{ v: 1 }, { v: 'texto' }, { v: null }, { v: 3.5 }], 'v');
    assert.deepEqual(valores, [1, 3.5]);
  });
});

describe('histograma', () => {
  it('reparte todos los valores sin duplicar los límites', () => {
    const valores = Array.from({ length: 100 }, (_, i) => i);
    const { conteos, etiquetas } = histograma(valores);
    assert.equal(conteos.reduce((a, b) => a + b, 0), 100);
    assert.equal(conteos.length, etiquetas.length);
  });

  it('respeta el número de clases pedido', () => {
    const { conteos } = histograma([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    assert.equal(conteos.length, 5);
  });

  it('devuelve una sola clase si todos los valores son iguales', () => {
    const { conteos } = histograma([7, 7, 7]);
    assert.deepEqual(conteos, [3]);
  });
});

describe('regresionLineal', () => {
  it('recupera una recta exacta', () => {
    const x = [1, 2, 3, 4, 5];
    const y = x.map((v) => 3 * v + 2);
    const ajuste = regresionLineal(x, y);
    assert.ok(Math.abs(ajuste.pendiente - 3) < 1e-9);
    assert.ok(Math.abs(ajuste.intercepto - 2) < 1e-9);
    assert.ok(Math.abs(ajuste.r2 - 1) < 1e-9);
  });

  it('devuelve null si la variable independiente no varía', () => {
    assert.equal(regresionLineal([2, 2, 2], [1, 2, 3]), null);
  });

  it('devuelve null con menos de dos puntos', () => {
    assert.equal(regresionLineal([1], [1]), null);
  });
});

describe('correlación', () => {
  it('detecta una relación inversa perfecta', () => {
    assert.ok(Math.abs(correlacionPearson([1, 2, 3], [3, 2, 1]) + 1) < 1e-9);
  });

  it('devuelve null si una serie es constante', () => {
    assert.equal(correlacionPearson([1, 1, 1], [1, 2, 3]), null);
  });

  it('la matriz es simétrica y con diagonal 1', () => {
    const filas = [
      { a: 1, b: 2, c: 9 },
      { a: 2, b: 4, c: 3 },
      { a: 3, b: 6, c: 5 },
    ];
    const { columnas, valores } = matrizCorrelacion(filas, ['a', 'b', 'c']);
    assert.deepEqual(columnas, ['a', 'b', 'c']);
    for (let i = 0; i < 3; i += 1) {
      assert.equal(valores[i][i], 1);
      for (let j = 0; j < 3; j += 1) {
        assert.equal(valores[i][j], valores[j][i]);
      }
    }
    assert.ok(Math.abs(valores[0][1] - 1) < 1e-9);
  });
});
