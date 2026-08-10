/**
 * Pruebas de usabilidad end-to-end.
 *
 * Conduce la aplicación real en Chromium: carga un archivo de muestra, recorre
 * los doce gráficos, aplica filtros y comprueba que el dashboard reacciona.
 * Cualquier error de consola o excepción no capturada hace fallar la prueba,
 * que es como se detectan las regresiones de interfaz.
 *
 * Uso (con el frontend y el backend en marcha):
 *   node tests/e2e/usabilidad.mjs
 *   BASE_URL=http://localhost:3000 node tests/e2e/usabilidad.mjs
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';
const CAPTURAS = path.join(import.meta.dirname, 'capturas');
const EJECUTABLE = process.env.CHROMIUM_PATH || undefined;

const GRAFICOS = [
  'barras', 'circular', 'histograma', 'lineas', 'dispersion', 'area',
  'radar', 'stacked', 'mixto', 'cajas', 'heatmap', 'regresion',
];

const resultados = [];
const erroresConsola = [];

function registrar(nombre, ok, detalle = '') {
  resultados.push({ nombre, ok, detalle });
  const marca = ok ? '  ok  ' : ' FALLO';
  console.log(`${marca} · ${nombre}${detalle ? ` — ${detalle}` : ''}`);
}

/** Lleva una sección a la vista y espera a que su capa 3D se asiente. */
async function irASeccion(pagina, id) {
  await pagina.locator(`#${id}`).scrollIntoViewIfNeeded();
  await pagina.waitForSelector(`#${id} .capa-3d[data-asentada="true"]`, { timeout: 10000 });
}

async function comprobar(nombre, fn) {
  try {
    const detalle = await fn();
    registrar(nombre, true, detalle || '');
  } catch (causa) {
    registrar(nombre, false, causa.message);
  }
}

function afirmar(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje);
}

async function main() {
  await mkdir(CAPTURAS, { recursive: true });

  const navegador = await chromium.launch({ executablePath: EJECUTABLE });
  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 960 },
    locale: 'es-ES',
  });
  const pagina = await contexto.newPage();

  pagina.on('console', (mensaje) => {
    if (mensaje.type() === 'error') erroresConsola.push(mensaje.text());
  });
  pagina.on('pageerror', (error) => erroresConsola.push(`pageerror: ${error.message}`));

  // --- Portada -----------------------------------------------------------
  await comprobar('La portada carga', async () => {
    const respuesta = await pagina.goto(BASE_URL, { waitUntil: 'networkidle' });
    afirmar(respuesta?.ok(), `HTTP ${respuesta?.status()}`);
    await pagina.waitForSelector('h1');
    return await pagina.title();
  });

  await comprobar('El fondo animado se monta', async () => {
    afirmar(await pagina.locator('canvas').count() > 0, 'no hay <canvas> de fondo');
  });

  await comprobar('El catálogo de muestras ofrece 5 Excel y 5 CSV', async () => {
    await irASeccion(pagina, 'descargas');
    await pagina.waitForSelector('button:has-text("XLSX")', { timeout: 15000 });
    const excel = await pagina.locator('button:has-text("XLSX")').count();
    const csv = await pagina.locator('button:has-text("CSV")').count();
    afirmar(excel === 5, `se esperaban 5 botones XLSX, hay ${excel}`);
    afirmar(csv === 5, `se esperaban 5 botones CSV, hay ${csv}`);
    return `${excel} Excel · ${csv} CSV`;
  });

  await comprobar('Una muestra se descarga correctamente', async () => {
    const descarga = pagina.waitForEvent('download', { timeout: 20000 });
    await pagina.locator('button:has-text("XLSX")').first().click();
    const archivo = await descarga;
    const nombre = archivo.suggestedFilename();
    afirmar(nombre.endsWith('.xlsx'), `nombre inesperado: ${nombre}`);
    return nombre;
  });

  // --- Carga de archivo ---------------------------------------------------
  await comprobar('El archivo de muestra se sube y se analiza', async () => {
    const respuesta = await fetch(`${BASE_URL}/api/muestras/ventas-retail/csv`);
    const contenido = Buffer.from(await respuesta.arrayBuffer());

    await irASeccion(pagina, 'cargar');
    await pagina.setInputFiles('[data-testid="entrada-archivo"]', {
      name: 'ventas-retail.csv',
      mimeType: 'text/csv',
      buffer: contenido,
    });

    await pagina.waitForSelector('#variables', { timeout: 30000 });
    await pagina.waitForSelector('[data-testid="tarjeta-columna"]', { timeout: 30000 });
    const columnas = await pagina.locator('[data-testid="tarjeta-columna"]').count();
    afirmar(columnas === 10, `se esperaban 10 columnas, hay ${columnas}`);
    return `${columnas} variables clasificadas`;
  });

  await comprobar('Se detectan los cuatro tipos de variable', async () => {
    const texto = await pagina.locator('#variables').innerText();
    for (const tipo of [
      'Cualitativo Nominal',
      'Cualitativo Ordinal',
      'Cuantitativo Discreto',
      'Cuantitativo Continuo',
    ]) {
      afirmar(texto.includes(tipo), `falta el tipo «${tipo}»`);
    }
  });

  await comprobar('La justificación del tipo es consultable', async () => {
    const boton = pagina.locator('button:has-text("¿Por qué este tipo?")').first();
    await boton.click();
    const panel = pagina.locator('[data-testid="tarjeta-columna"]').first();
    await panel.locator('p').last().waitFor({ state: 'visible' });
  });

  // --- Dashboard ----------------------------------------------------------
  await comprobar('El dashboard muestra métricas', async () => {
    await irASeccion(pagina, 'dashboard');
    await pagina.waitForSelector('[data-testid="fila-kpis"]');
    // `innerText` aplica el text-transform del CSS, así que se compara sin
    // distinguir mayúsculas.
    const texto = (await pagina.locator('[data-testid="fila-kpis"]').innerText()).toLowerCase();
    afirmar(texto.includes('filas visibles'), 'no aparece el KPI de filas');
  });

  await comprobar('Los doce gráficos se dibujan sin errores', async () => {
    const fallidos = [];
    for (const id of GRAFICOS) {
      await pagina.locator(`[data-testid="grafico-${id}"]`).click();
      try {
        await pagina.waitForFunction(
          () => {
            const nodo = document.querySelector('[data-testid="lienzo-grafico"]');
            return Boolean(nodo?.querySelector('.plot-container'));
          },
          { timeout: 15000 },
        );
      } catch {
        // Un gráfico puede pedir configuración adicional; eso es válido.
        const texto = await pagina.locator('#dashboard').innerText();
        if (!texto.includes('Ajuste la configuración')) fallidos.push(id);
      }
    }
    afirmar(!fallidos.length, `no se dibujaron: ${fallidos.join(', ')}`);
    return `${GRAFICOS.length} gráficos verificados`;
  });

  await comprobar('El filtro categórico reduce las filas en tiempo real', async () => {
    await pagina.locator('[data-testid="grafico-barras"]').click();
    const contador = pagina.locator('[data-testid="filas-filtradas"]');
    const inicial = Number((await contador.innerText()).replace(/\D/g, ''));

    await pagina.locator('aside button:has-text("Región")').click();
    await pagina.locator('aside input[type="checkbox"]').first().check();

    await pagina.waitForFunction(
      (previo) => {
        const nodo = document.querySelector('[data-testid="filas-filtradas"]');
        return nodo && Number(nodo.textContent.replace(/\D/g, '')) < previo;
      },
      inicial,
      { timeout: 10000 },
    );

    const final = Number((await contador.innerText()).replace(/\D/g, ''));
    afirmar(final < inicial, `las filas no bajaron (${inicial} → ${final})`);
    return `${inicial} → ${final} filas`;
  });

  await comprobar('El filtro aparece como chip retirable', async () => {
    await pagina.waitForSelector('[data-testid="chips-filtros"]');
    const chips = await pagina.locator('[data-testid="chips-filtros"] span').count();
    afirmar(chips > 0, 'no se generó ningún chip');
  });

  await comprobar('El backend sincroniza el informe filtrado', async () => {
    // El recuento del panel procede del cliente; el del informe, de Pandas.
    const respuesta = await pagina.waitForResponse(
      (r) => r.url().includes('/analisis') && r.status() === 200,
      { timeout: 15000 },
    ).catch(() => null);
    afirmar(respuesta !== null, 'no hubo respuesta de /analisis tras filtrar');
  });

  await comprobar('Limpiar los filtros restaura el total', async () => {
    await pagina.locator('button:has-text("Limpiar todo")').first().click();
    await pagina.waitForFunction(
      () => {
        const nodo = document.querySelector('[data-testid="filas-filtradas"]');
        return nodo && Number(nodo.textContent.replace(/\D/g, '')) === 240;
      },
      { timeout: 10000 },
    );
  });

  // --- Estadística --------------------------------------------------------
  await comprobar('Las cuatro vistas estadísticas responden', async () => {
    await irASeccion(pagina, 'estadistica');
    for (const vista of ['tendencia', 'posicion', 'dispersion', 'frecuencia']) {
      await pagina.locator(`[data-testid="vista-${vista}"]`).click();
      await pagina.waitForTimeout(400);
      const texto = await pagina.locator('#estadistica').innerText();
      afirmar(texto.length > 100, `la vista ${vista} quedó vacía`);
    }
  });

  await comprobar('La tabla de frecuencias se construye', async () => {
    await pagina.locator('[data-testid="vista-frecuencia"]').click();
    await pagina.waitForSelector('#estadistica table', { timeout: 15000 });
    const filas = await pagina.locator('#estadistica table tbody tr').count();
    afirmar(filas > 0, 'la tabla de frecuencias está vacía');
    return `${filas} filas`;
  });

  // --- Calidad ------------------------------------------------------------
  await comprobar('La validación por scraping simulado se ejecuta', async () => {
    await irASeccion(pagina, 'calidad');
    await pagina.locator('[data-testid="boton-validar"]').click();
    await pagina.waitForSelector('[data-testid="informe-validacion"]', { timeout: 20000 });
    const texto = (await pagina.locator('[data-testid="informe-validacion"]').innerText()).toLowerCase();
    afirmar(texto.includes('fuentes consultadas'), 'no se listaron las fuentes');
  });

  // --- Datos --------------------------------------------------------------
  await comprobar('La tabla de datos pagina y ordena', async () => {
    await irASeccion(pagina, 'datos');
    await pagina.waitForSelector('[data-testid="tabla-datos"]');
    const antes = await pagina.locator('[data-testid="tabla-datos"] tbody tr').first().innerText();

    // La muestra ya llega ordenada por sus primeras columnas, así que se pulsa
    // dos veces para pasar a orden descendente y comprobar el cambio.
    const cabecera = pagina.locator('[data-testid="tabla-datos"] thead button').nth(1);
    await cabecera.click();
    await cabecera.click();
    await pagina.waitForTimeout(300);
    const despues = await pagina.locator('[data-testid="tabla-datos"] tbody tr').first().innerText();
    afirmar(antes !== despues, 'ordenar no cambió la primera fila');
  });

  await comprobar('La exportación filtrada se descarga', async () => {
    await irASeccion(pagina, 'descargas');
    const descarga = pagina.waitForEvent('download', { timeout: 20000 });
    await pagina.locator('button:has-text("CSV filtrado")').click();
    const archivo = await descarga;
    afirmar(archivo.suggestedFilename().endsWith('.csv'), 'no se descargó un CSV');
    return archivo.suggestedFilename();
  });

  // --- Accesibilidad y responsive ----------------------------------------
  await comprobar('Todo control interactivo tiene nombre accesible', async () => {
    const sinNombre = await pagina.evaluate(() => {
      const nodos = [...document.querySelectorAll('button, a[href], select, input')];
      return nodos
        .filter((nodo) => nodo.offsetParent !== null)
        .filter((nodo) => {
          const texto = (nodo.innerText || '').trim();
          const etiqueta = nodo.getAttribute('aria-label') || nodo.getAttribute('title') || '';
          const asociada = nodo.id
            ? document.querySelector(`label[for="${nodo.id}"]`)?.textContent
            : nodo.closest('label')?.textContent;
          return !texto && !etiqueta && !(asociada || '').trim();
        })
        .map((nodo) => `${nodo.tagName}.${nodo.className}`.slice(0, 80));
    });
    afirmar(sinNombre.length === 0, `sin nombre accesible: ${sinNombre.slice(0, 5).join(' | ')}`);
  });

  await comprobar('No hay desbordamiento horizontal en móvil', async () => {
    await pagina.setViewportSize({ width: 390, height: 844 });
    await pagina.waitForTimeout(600);
    const desborda = await pagina.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    afirmar(!desborda, 'la página se desborda horizontalmente a 390 px');
    await pagina.screenshot({ path: path.join(CAPTURAS, 'movil.png'), fullPage: false });
    await pagina.setViewportSize({ width: 1440, height: 960 });
  });

  await comprobar('La consola no registró errores', async () => {
    // El aviso de desarrollo de React sobre claves duplicadas también contaría.
    const relevantes = erroresConsola.filter(
      (mensaje) => !mensaje.includes('Download the React DevTools'),
    );
    afirmar(relevantes.length === 0, relevantes.slice(0, 3).join(' | '));
  });

  await pagina.locator('#inicio').scrollIntoViewIfNeeded();
  await pagina.waitForTimeout(500);
  await pagina.screenshot({ path: path.join(CAPTURAS, 'portada.png'), fullPage: false });
  await irASeccion(pagina, 'dashboard');
  await pagina.waitForTimeout(800);
  await pagina.screenshot({ path: path.join(CAPTURAS, 'dashboard.png'), fullPage: false });

  await navegador.close();

  // --- Resumen ------------------------------------------------------------
  const fallidos = resultados.filter((resultado) => !resultado.ok);
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones superadas`);

  if (fallidos.length) {
    console.log('\nFallos:');
    for (const fallo of fallidos) console.log(`  · ${fallo.nombre}: ${fallo.detalle}`);
    process.exitCode = 1;
  }
}

main().catch((causa) => {
  console.error('La prueba de usabilidad no pudo completarse:', causa);
  process.exitCode = 1;
});
