# Defectos corregidos

Registro de los problemas encontrados en la aplicación original y de los que
surgieron durante las pruebas de usabilidad de la nueva interfaz. Cada entrada
indica cómo se detectó y qué prueba impide que vuelva a aparecer.

---

## Heredados de la versión anterior

### 1. Los gráficos ignoraban los selectores de variable

`App.jsx` pasaba `xKey` e `yKey` a cada gráfico, pero los componentes los
descartaban y usaban su propio estado local inicializado con `columns[0]` y
`columns[1]`. Los selectores del panel no tenían ningún efecto.

**Corrección**: los ejes viven en un único estado del dashboard y cada gráfico
declara qué ejes necesita (`grafico.ejes`). No hay estado duplicado.

### 2. La selección quedaba obsoleta al cargar otro archivo

`useState(columns[0]?.name)` sólo se evalúa en el primer render, así que al
cargar un archivo nuevo los gráficos seguían apuntando a columnas del anterior.

**Corrección**: la selección se deriva en cada render con `ajustarSeleccion`,
que conserva lo válido y sustituye lo que ya no existe.
*Prueba*: `tests/unit/chartSelection.test.js`.

### 3. Barras y circular dibujaban una marca por fila

Se pasaban las filas crudas a Plotly, de modo que un archivo de 240 pedidos
producía 240 barras en lugar de una por categoría.

**Corrección**: agregación explícita (`agruparPor`) con suma, promedio, conteo,
mediana, mínimo o máximo.
*Prueba*: «barras agrega por categoría en lugar de una barra por fila».

### 4. El mapa de calor tenía los ejes intercambiados

La matriz se construía como `z[columna][fila]` mientras que `x` recibía los
nombres de columna y `y` las etiquetas de fila, de modo que `z` quedaba
transpuesta respecto a los ejes.

**Corrección**: dos lecturas correctas y explícitas —correlación de Pearson
entre variables numéricas y cruce de dos categorías— con la orientación
`z[fila][columna]` que espera Plotly.
*Prueba*: «el mapa de calor de correlación es cuadrado y acotado a [-1, 1]».

### 5. La recta de regresión no correspondía a los puntos

`x` e `y` se filtraban por separado con `.filter(v => !isNaN(v))`. Si una fila
tenía valor en X pero no en Y, las series quedaban desplazadas y la recta se
calculaba sobre pares inexistentes.

**Corrección**: `paresNumericos` descarta la fila completa cuando falta
cualquiera de los dos valores. Se añaden R², r y n.
*Prueba*: «la regresión empareja X e Y descartando filas incompletas».

### 6. El gráfico mixto usaba el eje X como serie de datos

La segunda traza era `{ x, y: x }`: dibujaba las etiquetas del eje X como si
fueran valores numéricos.

**Corrección**: barras y línea sobre dos ejes verticales independientes. Sin
segunda medida se compara el total con el promedio de la misma variable.
*Prueba*: «el gráfico mixto usa dos ejes y no repite X como serie».

### 7. Las «barras apiladas» no apilaban nada

Sólo se generaba una traza, así que `barmode: 'stack'` no tenía efecto.

**Corrección**: se exige una variable de desglose y se genera una traza por
segmento, con modo 100 % opcional.
*Prueba*: «barras apiladas genera una traza por segmento y apila».

### 8. La moda se calculaba mal

En `MTC.jsx`, cuando ningún valor se repetía la función devolvía el primer
valor como moda en lugar de indicar que no hay moda.

**Corrección**: si la frecuencia máxima es 1, no hay moda.
*Prueba*: «sin moda cuando todos los valores son únicos».

### 9. La tabla de frecuencias agrupada contaba valores dos veces

Los intervalos se filtraban con `value >= start && value <= end`, así que los
valores situados justo en un límite se contaban en dos clases y la suma de
frecuencias superaba el total.

**Corrección**: intervalos semiabiertos `[a, b)`, con el último cerrado para
incluir el máximo.
*Prueba*: «la frecuencia agrupada no duplica valores en los límites».

### 10. Las tablas de frecuencia ignoraban el orden de las escalas ordinales

Las categorías se ordenaban alfabéticamente, de modo que una escala como
`Bajo < Medio < Alto` aparecía como `Alto, Bajo, Medio`.

**Corrección**: cuando se reconoce una escala ordinal, las tablas y los filtros
respetan su orden. La comparación se hace normalizando (sin tildes ni
mayúsculas) porque la escala se almacena normalizada y los datos conservan su
grafía original.
*Prueba*: «la frecuencia ordena por escala aunque cambie la grafía».

### 11. Los selectores de variable no correspondían al gráfico

`VariableSelector` mostraba siempre dos desplegables (X e Y) aunque el gráfico
sólo usara uno, y en el histograma cualquiera de los dos modificaba el mismo
eje.

**Corrección**: los controles se generan a partir de los ejes que declara cada
gráfico, filtrando además por columnas compatibles.

### 12. Un entorno virtual de Windows estaba versionado

`venv/` ocupaba 861 de los 897 archivos del repositorio, con binarios `.exe`.

**Corrección**: eliminado del control de versiones e incluido en `.gitignore`.

---

## Detectados durante las pruebas de usabilidad

Los cuatro siguientes se encontraron ejecutando la aplicación real en Chromium
(`tests/e2e/usabilidad.mjs`), no leyendo el código.

### 13. Los controles dentro de una sección con efecto 3D no recibían las pulsaciones

Mientras una sección se revelaba, su capa mantenía una transformación 3D activa.
El navegador sitúa el contenido transformado en un plano proyectado, así que las
coordenadas de la pulsación dejaban de coincidir con lo que se veía: al hacer
clic en el botón de validación, el evento llegaba a la sección y no al botón.

Se manifestaba de forma intermitente, según cuánto se hubiera desplazado la
página, lo que lo hacía especialmente difícil de reproducir a mano.

**Corrección**: la capa se marca como asentada al completar el 90 % del
recorrido y entonces se retira la transformación (`transform: none`). Además se
eliminó la transición CSS sobre `transform`: en una animación ligada al scroll
el propio desplazamiento aporta la continuidad, mientras que la transición
dejaba el contenido desplazado varios fotogramas después de asentarse.

### 14. Cada cambio de gráfico dibujaba un fotograma con los ejes del anterior

La adaptación de los ejes se hacía en un `useEffect`, es decir, después del
primer render. Durante ese fotograma el gráfico nuevo se construía con la
selección del anterior. En el gráfico mixto eso significaba recibir una columna
categórica en el eje numérico de la línea: la serie quedaba vacía sobre un eje
superpuesto, Plotly no podía escalarlo y emitía rutas SVG con coordenadas `NaN`.

**Corrección**: la selección efectiva se deriva durante el render con `useMemo`;
el estado sólo guarda lo que el usuario ha elegido de forma explícita. Como
defensa adicional, el gráfico mixto vuelve a la medida principal si la columna
elegida para la línea no aporta valores numéricos.
*Pruebas*: «ningún gráfico se dibuja con la selección heredada de otro tipo» y
«el mixto rechaza una medida de línea no numérica».

### 15. Redimensionados sobre gráficos a medio construir

`ResizeObserver` emite una primera medición en cuanto se observa el nodo, que
podía llegar antes de terminar el dibujo inicial. Redimensionar un gráfico
incompleto deja ejes sin rango.

**Corrección**: los redimensionados se ignoran hasta que el primer dibujo
termina, y también cuando el contenedor está colapsado.

### 16. Segundo eje sin rango estable

El eje superpuesto del gráfico mixto se autoescalaba en cada redibujado, de modo
que la escala saltaba al cambiar los filtros.

**Corrección**: se calcula un rango explícito a partir de la serie de la línea.
*Prueba*: «el segundo eje del mixto lleva un rango explícito y finito».

---

## Decisiones de diseño que conviene conocer

- **La edición de celdas se retiró.** La cuadrícula original permitía editar los
  datos en el navegador, pero los cálculos ahora los hace el backend sobre el
  archivo cargado: mantener ediciones locales dejaría las métricas del servidor
  describiendo unos datos distintos de los que se ven en pantalla. La tabla es
  de sólo lectura, con ordenación y paginación.

- **SheetJS (`xlsx`) ya no se usa en el cliente.** La lectura la hace Pandas y la
  escritura de Excel se resuelve en el backend con XlsxWriter, lo que elimina
  una dependencia con vulnerabilidades conocidas en su última versión publicada
  en npm (0.18.5) y reduce el JavaScript enviado al navegador.

- **`react-plotly.js` se sustituyó por un envoltorio propio** de unas 100 líneas
  sobre `plotly.js-dist-min`, que carga la librería de forma diferida, evita el
  problema de renderizado en servidor y libera el lienzo al desmontarse.

- **Los filtros están implementados dos veces**, en `frontend/lib/filters.js` y
  en `backend/app/services/filtering.py`. Es intencionado: el cliente responde
  al instante y el servidor sigue siendo la fuente de verdad. Ambas
  implementaciones se prueban con los mismos casos para que no se separen.
