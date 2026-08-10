import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aplicarFiltros,
  describirFiltro,
  filtroEsActivo,
  filtrosActivos,
  metaDeColumnas,
  TIPO_FILTRO,
} from '../../lib/filters.js';

const FILAS = [
  { Ciudad: 'Lima', Ventas: 100, Fecha: '2024-01-01', Comentario: 'muy bueno', Nivel: 3 },
  { Ciudad: 'Cusco', Ventas: 250, Fecha: '2024-02-15', Comentario: 'Regular', Nivel: 1 },
  { Ciudad: 'Lima', Ventas: 80, Fecha: '2024-03-20', Comentario: 'excelente', Nivel: 2 },
  { Ciudad: null, Ventas: 500, Fecha: '2024-04-05', Comentario: 'malo', Nivel: 3 },
  { Ciudad: 'Piura', Ventas: null, Fecha: '2024-05-30', Comentario: 'bueno', Nivel: null },
];

const META = metaDeColumnas([
  { nombre: 'Ciudad', es_numerica: false, tipo: 'Cualitativo Nominal', dtype_pandas: 'str' },
  { nombre: 'Ventas', es_numerica: true, tipo: 'Cuantitativo Continuo', dtype_pandas: 'float64' },
  { nombre: 'Nivel', es_numerica: true, tipo: 'Cuantitativo Discreto', dtype_pandas: 'float64' },
]);

describe('aplicarFiltros', () => {
  it('sin filtros devuelve todas las filas', () => {
    assert.equal(aplicarFiltros(FILAS, [], META).length, 5);
  });

  it('filtro categórico incluye sólo lo seleccionado y descarta nulos', () => {
    const resultado = aplicarFiltros(
      FILAS,
      [{ columna: 'Ciudad', tipo: TIPO_FILTRO.CATEGORICO, valores: ['Lima'] }],
      META,
    );
    assert.deepEqual(resultado.map((f) => f.Ciudad), ['Lima', 'Lima']);
  });

  it('filtro categórico puede conservar los nulos', () => {
    const resultado = aplicarFiltros(
      FILAS,
      [{ columna: 'Ciudad', tipo: TIPO_FILTRO.CATEGORICO, valores: ['Lima'], incluir_nulos: true }],
      META,
    );
    assert.equal(resultado.length, 3);
  });

  it('filtro categórico invertido excluye lo seleccionado', () => {
    const resultado = aplicarFiltros(
      FILAS,
      [{ columna: 'Ciudad', tipo: TIPO_FILTRO.CATEGORICO, valores: ['Lima'], excluir: true }],
      META,
    );
    assert.deepEqual(resultado.map((f) => f.Ciudad), ['Cusco', 'Piura']);
  });

  it('compara numéricamente las categorías de columnas numéricas', () => {
    // El backend serializa los valores de una columna float como "3.0";
    // el cliente debe reconocerlos aunque en JSON lleguen como 3.
    const resultado = aplicarFiltros(
      FILAS,
      [{ columna: 'Nivel', tipo: TIPO_FILTRO.CATEGORICO, valores: ['3.0'] }],
      META,
    );
    assert.equal(resultado.length, 2);
  });

  it('filtro de rango respeta ambos extremos', () => {
    const resultado = aplicarFiltros(
      FILAS,
      [{ columna: 'Ventas', tipo: TIPO_FILTRO.RANGO, minimo: 90, maximo: 300 }],
      META,
    );
    assert.deepEqual(resultado.map((f) => f.Ventas), [100, 250]);
  });

  it('filtro de rango descarta los nulos salvo petición explícita', () => {
    const base = { columna: 'Ventas', tipo: TIPO_FILTRO.RANGO, minimo: 90 };
    assert.equal(aplicarFiltros(FILAS, [base], META).length, 3);
    assert.equal(aplicarFiltros(FILAS, [{ ...base, incluir_nulos: true }], META).length, 4);
  });

  it('filtro de fechas acota el intervalo', () => {
    const resultado = aplicarFiltros(
      FILAS,
      [{ columna: 'Fecha', tipo: TIPO_FILTRO.FECHA, desde: '2024-02-01', hasta: '2024-04-30' }],
      META,
    );
    assert.equal(resultado.length, 3);
  });

  it('filtro de texto ignora mayúsculas por defecto', () => {
    const resultado = aplicarFiltros(
      FILAS,
      [{ columna: 'Comentario', tipo: TIPO_FILTRO.TEXTO, contiene: 'BUENO' }],
      META,
    );
    assert.equal(resultado.length, 2);
  });

  it('filtro de texto puede distinguir mayúsculas', () => {
    const resultado = aplicarFiltros(
      FILAS,
      [
        {
          columna: 'Comentario',
          tipo: TIPO_FILTRO.TEXTO,
          contiene: 'BUENO',
          sensible_mayusculas: true,
        },
      ],
      META,
    );
    assert.equal(resultado.length, 0);
  });

  it('el texto se busca literalmente, no como expresión regular', () => {
    const resultado = aplicarFiltros(
      FILAS,
      [{ columna: 'Comentario', tipo: TIPO_FILTRO.TEXTO, contiene: '(' }],
      META,
    );
    assert.equal(resultado.length, 0);
  });

  it('los filtros se combinan con AND', () => {
    const resultado = aplicarFiltros(
      FILAS,
      [
        { columna: 'Ciudad', tipo: TIPO_FILTRO.CATEGORICO, valores: ['Lima'] },
        { columna: 'Ventas', tipo: TIPO_FILTRO.RANGO, minimo: 90 },
      ],
      META,
    );
    assert.equal(resultado.length, 1);
    assert.equal(resultado[0].Ventas, 100);
  });

  it('un filtro sin criterio no filtra nada', () => {
    const filtros = [{ columna: 'Ciudad', tipo: TIPO_FILTRO.CATEGORICO, valores: [] }];
    assert.equal(aplicarFiltros(FILAS, filtros, META).length, 5);
    assert.equal(filtrosActivos(filtros).length, 0);
    assert.equal(filtroEsActivo(filtros[0]), false);
  });

  it('el filtro de nulos descarta las filas sin valor', () => {
    const resultado = aplicarFiltros(
      FILAS,
      [{ columna: 'Ventas', tipo: TIPO_FILTRO.NULOS, incluir_nulos: false }],
      META,
    );
    assert.equal(resultado.length, 4);
  });
});

describe('describirFiltro', () => {
  it('resume una selección de categorías', () => {
    const texto = describirFiltro({
      columna: 'Ciudad',
      tipo: TIPO_FILTRO.CATEGORICO,
      valores: ['Lima', 'Cusco'],
    });
    assert.equal(texto, 'Ciudad: incluye Lima, Cusco');
  });

  it('indica cuando la selección es una exclusión', () => {
    const texto = describirFiltro({
      columna: 'Ciudad',
      tipo: TIPO_FILTRO.CATEGORICO,
      valores: ['a', 'b', 'c'],
      excluir: true,
    });
    assert.match(texto, /excluye 3 valores/);
  });

  it('describe un rango abierto por un extremo', () => {
    const texto = describirFiltro({ columna: 'Ventas', tipo: TIPO_FILTRO.RANGO, minimo: 10 });
    assert.match(texto, /10 — ∞/);
  });
});
