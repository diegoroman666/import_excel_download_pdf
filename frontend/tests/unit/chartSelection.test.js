import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ajustarSeleccion, columnasCompatibles, seleccionInicial } from '../../lib/chartSelection.js';
import { GRAFICOS, GRAFICOS_POR_ID } from '../../components/charts/registry.js';

const COLUMNAS = [
  { nombre: 'ID', tipo: 'Cualitativo Nominal', rol: 'identificador', es_numerica: false, unicos: 100 },
  { nombre: 'Ciudad', tipo: 'Cualitativo Nominal', rol: 'categoria', es_numerica: false, unicos: 5 },
  { nombre: 'Nivel', tipo: 'Cualitativo Ordinal', rol: 'categoria', es_numerica: false, unicos: 3 },
  { nombre: 'Unidades', tipo: 'Cuantitativo Discreto', rol: 'conteo', es_numerica: true, unicos: 12 },
  { nombre: 'Importe', tipo: 'Cuantitativo Continuo', rol: 'medida', es_numerica: true, unicos: 90 },
];

describe('columnasCompatibles', () => {
  it('filtra por naturaleza numérica o categórica', () => {
    assert.equal(columnasCompatibles(COLUMNAS, 'numerica').length, 2);
    assert.equal(columnasCompatibles(COLUMNAS, 'categorica').length, 3);
    assert.equal(columnasCompatibles(COLUMNAS, 'cualquiera').length, 5);
  });
});

describe('seleccionInicial', () => {
  it('elige una categoría legible para el eje X, no un identificador', () => {
    const seleccion = seleccionInicial(GRAFICOS_POR_ID.barras, COLUMNAS);
    assert.notEqual(seleccion.x, 'ID');
    assert.ok(['Ciudad', 'Nivel'].includes(seleccion.x));
  });

  it('prefiere una medida continua para el eje Y', () => {
    const seleccion = seleccionInicial(GRAFICOS_POR_ID.barras, COLUMNAS);
    assert.equal(seleccion.y, 'Importe');
  });

  it('asigna columnas numéricas a los ejes de la regresión', () => {
    const seleccion = seleccionInicial(GRAFICOS_POR_ID.regresion, COLUMNAS);
    assert.ok(['Importe', 'Unidades'].includes(seleccion.x));
    assert.ok(['Importe', 'Unidades'].includes(seleccion.y));
    assert.notEqual(seleccion.x, seleccion.y);
  });

  it('todos los gráficos obtienen sus ejes obligatorios', () => {
    for (const grafico of GRAFICOS) {
      const seleccion = seleccionInicial(grafico, COLUMNAS);
      for (const clave of ['x', 'y', 'serie']) {
        const eje = grafico.ejes?.[clave];
        if (eje?.requerido) {
          assert.ok(seleccion[clave], `${grafico.id}: falta el eje ${clave}`);
        }
      }
    }
  });
});

describe('ajustarSeleccion', () => {
  it('conserva una elección válida al cambiar de gráfico', () => {
    const previa = { x: 'Ciudad', y: 'Importe', serie: '', agregacion: 'promedio' };
    const siguiente = ajustarSeleccion(GRAFICOS_POR_ID.lineas, COLUMNAS, previa);
    assert.equal(siguiente.x, 'Ciudad');
    assert.equal(siguiente.y, 'Importe');
    assert.equal(siguiente.agregacion, 'promedio');
  });

  it('sustituye un valor incompatible en un eje obligatorio', () => {
    // El histograma exige una variable numérica en X.
    const siguiente = ajustarSeleccion(GRAFICOS_POR_ID.histograma, COLUMNAS, { x: 'Ciudad' });
    assert.ok(['Importe', 'Unidades'].includes(siguiente.x));
  });

  it('vacía un eje opcional incompatible en lugar de inventarlo', () => {
    // En cajas, X es una agrupación categórica opcional.
    const siguiente = ajustarSeleccion(GRAFICOS_POR_ID.cajas, COLUMNAS, {
      x: 'Importe',
      y: 'Importe',
    });
    assert.equal(siguiente.x, '');
  });

  it('respeta un eje opcional vaciado a propósito', () => {
    const siguiente = ajustarSeleccion(GRAFICOS_POR_ID.barras, COLUMNAS, { x: 'Ciudad', y: '' });
    assert.equal(siguiente.y, '');
  });

  it('evita que el desglose repita la columna del eje X', () => {
    const siguiente = ajustarSeleccion(GRAFICOS_POR_ID.stacked, COLUMNAS, {
      x: 'Ciudad',
      serie: 'Ciudad',
    });
    assert.notEqual(siguiente.serie, 'Ciudad');
    assert.ok(siguiente.serie);
  });

  it('inicializa el modo de los gráficos que lo declaran', () => {
    const siguiente = ajustarSeleccion(GRAFICOS_POR_ID.heatmap, COLUMNAS, {});
    assert.equal(siguiente.modo, 'correlacion');
  });

  it('no falla cuando no hay columnas numéricas', () => {
    const soloTexto = COLUMNAS.filter((columna) => !columna.es_numerica);
    const siguiente = ajustarSeleccion(GRAFICOS_POR_ID.regresion, soloTexto, {});
    assert.equal(siguiente.x, '');
    assert.equal(siguiente.y, '');
  });
});
