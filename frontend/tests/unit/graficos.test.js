import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { GRAFICOS, GRAFICOS_POR_ID, obtenerGrafico } from '../../components/charts/registry.js';
import { seleccionInicial } from '../../lib/chartSelection.js';

const COLUMNAS = [
  { nombre: 'Ciudad', tipo: 'Cualitativo Nominal', rol: 'categoria', es_numerica: false, unicos: 3 },
  { nombre: 'Nivel', tipo: 'Cualitativo Ordinal', rol: 'categoria', es_numerica: false, unicos: 3 },
  { nombre: 'Unidades', tipo: 'Cuantitativo Discreto', rol: 'conteo', es_numerica: true, unicos: 6 },
  { nombre: 'Importe', tipo: 'Cuantitativo Continuo', rol: 'medida', es_numerica: true, unicos: 12 },
];

const NUMERICAS = ['Unidades', 'Importe'];

const FILAS = [
  { Ciudad: 'Lima', Nivel: 'Alto', Unidades: 3, Importe: 120.5 },
  { Ciudad: 'Cusco', Nivel: 'Medio', Unidades: 1, Importe: 45 },
  { Ciudad: 'Lima', Nivel: 'Bajo', Unidades: 5, Importe: 310.75 },
  { Ciudad: 'Piura', Nivel: 'Alto', Unidades: 2, Importe: 88.2 },
  { Ciudad: 'Cusco', Nivel: 'Medio', Unidades: 4, Importe: 199.99 },
  { Ciudad: 'Lima', Nivel: 'Alto', Unidades: 6, Importe: 420 },
  { Ciudad: 'Piura', Nivel: 'Bajo', Unidades: 2, Importe: 76.4 },
  { Ciudad: 'Cusco', Nivel: 'Alto', Unidades: 3, Importe: 133.33 },
];

/** Construye un gráfico con la selección que el propio sistema elegiría. */
function construirPorDefecto(grafico, filas = FILAS) {
  const seleccion = seleccionInicial(grafico, COLUMNAS);
  return grafico.construir({
    filas,
    columnasNumericas: NUMERICAS,
    ordenCategorias: null,
    ...seleccion,
  });
}

describe('registro de gráficos', () => {
  it('conserva los doce tipos de la aplicación original', () => {
    assert.equal(GRAFICOS.length, 12);
    const esperados = [
      'barras', 'circular', 'histograma', 'lineas', 'dispersion', 'area',
      'radar', 'stacked', 'mixto', 'cajas', 'heatmap', 'regresion',
    ];
    assert.deepEqual(GRAFICOS.map((g) => g.id).sort(), [...esperados].sort());
  });

  it('cada gráfico declara identidad y ejes', () => {
    for (const grafico of GRAFICOS) {
      assert.ok(grafico.id, 'falta id');
      assert.ok(grafico.nombre, `${grafico.id}: falta nombre`);
      assert.ok(grafico.descripcion, `${grafico.id}: falta descripción`);
      assert.ok(grafico.icono, `${grafico.id}: falta icono`);
      assert.equal(typeof grafico.construir, 'function');
      assert.ok(grafico.ejes, `${grafico.id}: faltan ejes`);
    }
  });

  it('obtenerGrafico cae en el primero ante un id desconocido', () => {
    assert.equal(obtenerGrafico('inexistente'), GRAFICOS[0]);
    assert.equal(obtenerGrafico('radar').id, 'radar');
  });
});

describe('construcción de especificaciones', () => {
  it('los doce producen trazas válidas con la selección automática', () => {
    for (const grafico of GRAFICOS) {
      const spec = construirPorDefecto(grafico);
      assert.ok(!spec.vacio, `${grafico.id} quedó vacío: ${spec.vacio}`);
      assert.ok(Array.isArray(spec.data) && spec.data.length > 0, `${grafico.id}: sin trazas`);
      assert.ok(spec.layout, `${grafico.id}: sin layout`);

      for (const traza of spec.data) {
        assert.ok(traza.type, `${grafico.id}: traza sin tipo`);
      }
    }
  });

  it('ninguno lanza con un conjunto de filas vacío', () => {
    for (const grafico of GRAFICOS) {
      const spec = construirPorDefecto(grafico, []);
      // Debe informar del motivo, no romperse.
      assert.ok(spec.vacio || spec.data, `${grafico.id}: respuesta inesperada`);
    }
  });

  it('los ejes ausentes se explican en lugar de dibujar nada', () => {
    const spec = GRAFICOS_POR_ID.regresion.construir({ filas: FILAS, x: '', y: '' });
    assert.match(spec.vacio, /variables/i);
  });
});

describe('correcciones sobre la versión original', () => {
  it('barras agrega por categoría en lugar de una barra por fila', () => {
    const spec = GRAFICOS_POR_ID.barras.construir({
      filas: FILAS,
      x: 'Ciudad',
      y: 'Importe',
      agregacion: 'suma',
    });
    // Tres ciudades distintas, no ocho filas.
    assert.equal(spec.data[0].x.length, 3);
    const indiceLima = spec.data[0].x.indexOf('Lima');
    assert.ok(Math.abs(spec.data[0].y[indiceLima] - (120.5 + 310.75 + 420)) < 1e-9);
  });

  it('circular rechaza magnitudes negativas en vez de dibujar porciones absurdas', () => {
    const spec = GRAFICOS_POR_ID.circular.construir({
      filas: [{ c: 'A', v: -5 }, { c: 'B', v: 10 }],
      x: 'c',
      y: 'v',
      agregacion: 'suma',
    });
    assert.match(spec.vacio, /negativos/i);
  });

  it('barras apiladas exige la variable de desglose', () => {
    const spec = GRAFICOS_POR_ID.stacked.construir({ filas: FILAS, x: 'Ciudad', serie: '' });
    assert.match(spec.vacio, /desglose/i);
  });

  it('barras apiladas genera una traza por segmento y apila', () => {
    const spec = GRAFICOS_POR_ID.stacked.construir({
      filas: FILAS,
      x: 'Ciudad',
      serie: 'Nivel',
      y: 'Importe',
      agregacion: 'suma',
    });
    assert.equal(spec.layout.barmode, 'stack');
    assert.ok(spec.data.length > 1, 'debe haber más de una traza para apilar');
  });

  it('el modo 100 % normaliza cada barra a su propio total', () => {
    const spec = GRAFICOS_POR_ID.stacked.construir({
      filas: FILAS,
      x: 'Ciudad',
      serie: 'Nivel',
      y: 'Importe',
      agregacion: 'suma',
      normalizar: true,
    });
    const columnas = spec.data[0].y.length;
    for (let i = 0; i < columnas; i += 1) {
      const total = spec.data.reduce((suma, traza) => suma + traza.y[i], 0);
      assert.ok(Math.abs(total - 100) < 1e-6, `la columna ${i} suma ${total}`);
    }
  });

  it('el gráfico mixto usa dos ejes y no repite X como serie', () => {
    const spec = GRAFICOS_POR_ID.mixto.construir({
      filas: FILAS,
      x: 'Ciudad',
      y: 'Importe',
      agregacion: 'suma',
    });
    assert.equal(spec.data.length, 2);
    assert.equal(spec.data[1].yaxis, 'y2');
    assert.ok(spec.layout.yaxis2.overlaying === 'y');
    // La línea no puede ser una copia de las etiquetas del eje X.
    assert.ok(spec.data[1].y.every((valor) => typeof valor === 'number'));
  });

  it('ningún gráfico se dibuja con la selección heredada de otro tipo', () => {
    // Al cambiar de tipo, los ejes se adaptan durante el render. Si se
    // dibujara con la selección anterior, un gráfico como el mixto recibiría
    // una columna categórica en su eje numérico y generaría una serie vacía
    // sobre un eje superpuesto, que Plotly no puede escalar.
    let seleccion = {};
    for (const grafico of GRAFICOS) {
      seleccion = seleccionInicial(grafico, COLUMNAS);
      const spec = grafico.construir({
        filas: FILAS,
        columnasNumericas: NUMERICAS,
        ordenCategorias: null,
        ...seleccion,
      });
      if (spec.vacio) continue;

      for (const traza of spec.data) {
        const largo = traza.y?.length ?? traza.r?.length ?? traza.values?.length ?? traza.z?.length;
        assert.ok(largo > 0, `${grafico.id}: traza sin datos`);
      }
    }
  });

  it('el mixto rechaza una medida de línea no numérica en lugar de vaciar el eje', () => {
    const spec = GRAFICOS_POR_ID.mixto.construir({
      filas: FILAS,
      x: 'Ciudad',
      y: 'Importe',
      serie: 'Nivel', // categórica: no puede alimentar el segundo eje
      agregacion: 'suma',
    });
    assert.ok(!spec.vacio, 'debería dibujarse igualmente');
    // La línea cae de nuevo sobre la medida válida, nunca queda sin puntos.
    assert.ok(spec.data[1].y.length > 0, 'la línea quedó sin datos');
    assert.ok(spec.data[1].y.every((v) => Number.isFinite(v)), 'la línea tiene valores no finitos');
  });

  it('el segundo eje del mixto lleva un rango explícito y finito', () => {
    const spec = GRAFICOS_POR_ID.mixto.construir({
      filas: FILAS,
      x: 'Ciudad',
      y: 'Importe',
      serie: 'Unidades',
      agregacion: 'suma',
    });
    const rango = spec.layout.yaxis2.range;
    assert.ok(Array.isArray(rango) && rango.length === 2, 'falta el rango de yaxis2');
    assert.ok(rango.every((v) => Number.isFinite(v)), `rango no finito: ${rango}`);
    assert.ok(rango[1] > rango[0], 'el rango está invertido o es degenerado');
  });

  it('la regresión empareja X e Y descartando filas incompletas', () => {
    const filas = [
      { x: 1, y: 2 },
      { x: null, y: 100 },
      { x: 2, y: 4 },
      { x: 3, y: null },
      { x: 3, y: 6 },
    ];
    const spec = GRAFICOS_POR_ID.regresion.construir({ filas, x: 'x', y: 'y' });
    const puntos = spec.data[0];
    assert.deepEqual(puntos.x, [1, 2, 3]);
    assert.deepEqual(puntos.y, [2, 4, 6]);
    assert.match(spec.layout.annotations[0].text, /R² = 1\.0000/);
  });

  it('la regresión avisa cuando X no varía', () => {
    const filas = [{ x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 }];
    const spec = GRAFICOS_POR_ID.regresion.construir({ filas, x: 'x', y: 'y' });
    assert.match(spec.vacio, /no varía/i);
  });

  it('el mapa de calor de correlación es cuadrado y acotado a [-1, 1]', () => {
    const spec = GRAFICOS_POR_ID.heatmap.construir({
      filas: FILAS,
      modo: 'correlacion',
      columnasNumericas: NUMERICAS,
    });
    const traza = spec.data[0];
    assert.equal(traza.x.length, traza.y.length);
    assert.equal(traza.z.length, traza.x.length);
    assert.equal(traza.zmin, -1);
    assert.equal(traza.zmax, 1);
    // La orientación debe ser z[fila][columna], con la diagonal a 1.
    traza.z.forEach((fila, indice) => assert.equal(fila[indice], 1));
  });

  it('el mapa de calor de cruce orienta la matriz como z[serie][categoría]', () => {
    const spec = GRAFICOS_POR_ID.heatmap.construir({
      filas: FILAS,
      modo: 'cruce',
      x: 'Ciudad',
      serie: 'Nivel',
      y: 'Importe',
      agregacion: 'suma',
    });
    const traza = spec.data[0];
    assert.equal(traza.z.length, traza.y.length);
    assert.equal(traza.z[0].length, traza.x.length);
  });

  it('el histograma reparte todas las observaciones', () => {
    const spec = GRAFICOS_POR_ID.histograma.construir({ filas: FILAS, x: 'Importe' });
    const total = spec.data[0].y.reduce((a, b) => a + b, 0);
    assert.equal(total, FILAS.length);
  });

  it('las cajas agrupan por categoría cuando se indica', () => {
    const spec = GRAFICOS_POR_ID.cajas.construir({ filas: FILAS, x: 'Ciudad', y: 'Importe' });
    assert.equal(spec.data.length, 3);
    assert.ok(spec.data.every((traza) => traza.type === 'box'));
  });

  it('el radar cierra el polígono repitiendo el primer punto', () => {
    const spec = GRAFICOS_POR_ID.radar.construir({
      filas: FILAS,
      x: 'Ciudad',
      y: 'Importe',
      agregacion: 'suma',
    });
    const traza = spec.data[0];
    assert.equal(traza.r[0], traza.r[traza.r.length - 1]);
    assert.equal(traza.theta[0], traza.theta[traza.theta.length - 1]);
  });

  it('líneas y área ordenan el eje X en lugar de seguir el orden del archivo', () => {
    const desordenadas = [
      { mes: '2024-03', v: 3 },
      { mes: '2024-01', v: 1 },
      { mes: '2024-02', v: 2 },
    ];
    for (const id of ['lineas', 'area']) {
      const spec = GRAFICOS_POR_ID[id].construir({
        filas: desordenadas,
        x: 'mes',
        y: 'v',
        agregacion: 'suma',
      });
      assert.deepEqual(spec.data[0].x, ['2024-01', '2024-02', '2024-03'], id);
    }
  });

  it('la dispersión separa por grupo cuando se pide colorear', () => {
    const spec = GRAFICOS_POR_ID.dispersion.construir({
      filas: FILAS,
      x: 'Unidades',
      y: 'Importe',
      serie: 'Ciudad',
    });
    assert.equal(spec.data.length, 3);
    assert.ok(spec.data.every((traza) => traza.name));
  });
});
