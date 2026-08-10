# Interfaz — Next.js + Tailwind CSS

## Ejecución

```bash
npm install
npm run dev          # desarrollo en http://localhost:3000
npm run build        # compilación de producción
npm start            # servidor de producción
npm run lint         # ESLint
npm test             # pruebas unitarias (node:test)
```

Requiere el motor de datos en marcha (véase `../backend/README.md`).
`next.config.mjs` redirige `/api/*` a `BACKEND_URL`, que por defecto apunta a
`http://127.0.0.1:8000`.

## Organización

- **`app/`** — App Router. `globals.css` contiene el sistema de diseño: tokens
  de color, superficies de cristal y los efectos 3D.
- **`components/charts/`** — envoltorio propio sobre `plotly.js` y un módulo por
  gráfico en `tipos/`. Cada módulo declara su identidad y los ejes que necesita,
  y sabe construir su especificación de Plotly. Añadir un gráfico nuevo consiste
  en crear un archivo y registrarlo en `registry.js`; el dashboard no cambia.
- **`components/scroll3d/`** — profundidad al desplazarse e inclinación con el
  puntero. Ambos efectos escriben variables CSS en lugar de renderizar por
  fotograma, de modo que el trabajo recae en el compositor del navegador.
- **`lib/`** — cliente de API, motor de filtros en cliente, agregaciones para
  los gráficos, selección automática de ejes y formato de valores. Son módulos
  sin dependencias, lo que permite probarlos con `node:test` sin empaquetador.

## Pruebas

```bash
npm test                              # 81 pruebas de lógica

# Usabilidad: requiere el frontend y el backend en marcha
node tests/e2e/usabilidad.mjs
BASE_URL=http://localhost:3000 node tests/e2e/usabilidad.mjs
```

La prueba de usabilidad recorre la aplicación real en Chromium: sube un archivo
de muestra, verifica la clasificación, dibuja los doce gráficos, filtra,
comprueba la sincronización con el backend, ejecuta la validación de calidad,
descarga archivos y revisa accesibilidad, comportamiento en móvil y ausencia de
errores de consola. Las capturas quedan en `tests/e2e/capturas/`.

Si Chromium no está en la ruta por defecto de Playwright, indíquelo con
`CHROMIUM_PATH`.

## Accesibilidad y rendimiento

- Todos los controles tienen nombre accesible; hay un enlace para saltar al
  contenido y el foco es siempre visible.
- `prefers-reduced-motion` desactiva el fondo animado, los efectos 3D y las
  transiciones.
- `plotly.js` (≈3 MB) se carga de forma diferida: la carga inicial de la página
  ronda los 134 kB de JavaScript.
