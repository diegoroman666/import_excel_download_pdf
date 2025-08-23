import React, { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { DataGrid, textEditor } from 'react-data-grid';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import Menu3D from "./components/Menu3D";
import Menu3DGraficos from "./components/Menu3DGraficos";

// === Gráficos (todos en Plotly) ===
import Barras from "./components/graficos/BarrasPlotly";
import Circular from "./components/graficos/CircularPlotly";
import Histograma from "./components/graficos/HistogramaPlotly";
import Lineas from "./components/graficos/LineasPlotly";
import Dispersion from "./components/graficos/DispersionPlotly";
import Area from "./components/graficos/AreaPlotly";
import Radar from "./components/graficos/RadarPlotly";
import Stacked from "./components/graficos/StackedPlotly";
import Mixto from "./components/graficos/MixtoPlotly";
import Cajas from "./components/graficos/CajasPlotly";
import Heatmap from "./components/graficos/HeatmapPlotly";
import Regresion from "./components/graficos/RegresionPlotly";

// === Cálculos estadísticos existentes ===
import { calculateMean, calculateMedian, calculateMode } from './data/MTC';
import { calculatePercentile, calculateQuartiles, calculateDeciles } from './data/MTP';
import { calculateRange, calculateVariance, calculateStandardDeviation, calculateCoefficientOfVariation } from './data/Disper';
import { createUngroupedFrequencyTable, createGroupedFrequencyTable } from './data/Frecuencia';

import 'react-data-grid/lib/styles.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// =============================
// Utilidad: descargar Excel
// =============================
const downloadExcel = (data, columns, fileName) => {
  const workbook = XLSX.utils.book_new();
  const headers = columns.map(col => col.name);
  const rows = data.map(row => columns.map(col => row[col.key]));
  const sheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, `${fileName || 'edited_excel'}.xlsx`);
};

// =============================
// Mapeo de gráficos
// =============================
const GRAPH_COMPONENTS = {
  barras: Barras,
  circular: Circular,
  histograma: Histograma,
  lineas: Lineas,
  dispersion: Dispersion,
  area: Area,
  radar: Radar,
  stacked: Stacked,
  mixto: Mixto,
  cajas: Cajas,
  heatmap: Heatmap,
  regresion: Regresion
};

function App() {
  // === Estado base ===
  const [excelData, setExcelData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [columns, setColumns] = useState([]); // [{ key: col0, name: "Header" }, ...]
  const [activeView, setActiveView] = useState('graficos');

  // === Estado de selección de gráfico y variables ===
  const [selectedGraph, setSelectedGraph] = useState('barras');
  const [xKey, setXKey] = useState(''); // nombre de columna (header)
  const [yKey, setYKey] = useState(''); // nombre de columna (header)
  const [useY, setUseY] = useState(true); // botón "Variable Y"

  // === Para vistas estadísticas existentes (una sola columna) ===
  const [selectedColumn, setSelectedColumn] = useState('');

  // Opciones del menú de gráficos
  const graphOptions = [
    { key: "barras", label: "Gráfico de Barras" },
    { key: "circular", label: "Gráfico Circular" },
    { key: "histograma", label: "Histograma" },
    { key: "lineas", label: "Gráfico de Líneas" },
    { key: "dispersion", label: "Gráfico de Dispersión" },
    { key: "area", label: "Gráfico de Área" },
    { key: "radar", label: "Gráfico Radar" },
    { key: "stacked", label: "Barras Apiladas" },
    { key: "mixto", label: "Gráfico Mixto" },
    { key: "cajas", label: "Diagrama de Cajas" },
    { key: "heatmap", label: "Mapa de Calor" },
    { key: "regresion", label: "Gráfico de Regresión" },
  ];

  // =============================
  // Carga de archivo Excel
  // =============================
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name.replace(/\.[^/.]+$/, ''));
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      if (jsonData.length > 0) {
        const headers = jsonData[0];
        const rows = jsonData.slice(1);

        const gridColumns = headers.map((header, index) => ({
          key: `col${index}`,
          name: header ?? `Col ${index + 1}`,
          editable: true,
          editor: textEditor,
          resizable: true,
          width: 150
        }));

        const gridRows = rows.map(row => {
          const rowObject = {};
          headers.forEach((_, colIndex) => {
            rowObject[`col${colIndex}`] = row[colIndex];
          });
          return rowObject;
        });

        setColumns(gridColumns);
        setExcelData(gridRows);

        // Selecciones iniciales
        const firstName = gridColumns[0]?.name || '';
        const secondName = gridColumns[1]?.name || '';
        setXKey(firstName);
        setYKey(secondName || '');
        setSelectedColumn(gridColumns[0]?.key || '');
        setUseY(Boolean(secondName)); // activa Y si hay al menos dos columnas
        setActiveView('graficos');
      } else {
        setColumns([]);
        setExcelData([]);
        setFileName('');
        setSelectedColumn('');
        setXKey('');
        setYKey('');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onRowsChange = useCallback((updatedRows) => setExcelData(updatedRows), []);

  // =============================
  // Descargas
  // =============================
  const handleDownloadEditedExcel = () => {
    if (excelData.length && columns.length) downloadExcel(excelData, columns, fileName);
  };

  const handleDownloadPDF = () => {
    if (!excelData.length || !columns.length) return;

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Tabla del archivo: ${fileName}.xlsx`, 14, 15);

    const headers = columns.map(col => col.name);
    const data = excelData.map(row => columns.map(col => row[col.key]));

    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 25,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [22, 160, 133], textColor: 255, halign: 'center' }
    });

    doc.save(`${fileName}_tabla.pdf`);
  };

  // =============================
  // Dataset para Gráficos (por NOMBRE de columna, no por key col0/col1)
  // Convierte a número donde se pueda.
  // =============================
  const columnsByName = useMemo(
    () => columns.map(c => ({ name: c.name })),
    [columns]
  );

  const dataForCharts = useMemo(() => {
    if (!excelData.length || !columns.length) return [];
    return excelData.map(row => {
      const obj = {};
      for (const col of columns) {
        const raw = row[col.key];
        const num = parseFloat(raw);
        obj[col.name] = !isNaN(num) && raw !== '' && raw !== null ? num : raw;
      }
      return obj;
    });
  }, [excelData, columns]);

  // =============================
  // Métricas por columna (vistas estadísticas existentes)
  // =============================
  const numericData = useMemo(() => {
    if (!excelData.length || !columns.length || !selectedColumn) return [];
    return excelData
      .map(row => parseFloat(row[selectedColumn]))
      .filter(v => !isNaN(v));
  }, [excelData, columns, selectedColumn]);

  const mtcResults = useMemo(() => numericData.length ? {
    mean: calculateMean(numericData),
    median: calculateMedian(numericData),
    mode: calculateMode(numericData),
  } : null, [numericData]);

  const mtpResults = useMemo(() => numericData.length ? {
    percentiles: {
      p25: calculatePercentile(numericData, 25),
      p50: calculatePercentile(numericData, 50),
      p75: calculatePercentile(numericData, 75)
    },
    quartiles: calculateQuartiles(numericData),
    deciles: calculateDeciles(numericData)
  } : null, [numericData]);

  const disperResults = useMemo(() => numericData.length ? {
    range: calculateRange(numericData),
    variance: calculateVariance(numericData),
    standardDeviation: calculateStandardDeviation(numericData),
    coefficientOfVariation: calculateCoefficientOfVariation(numericData),
  } : null, [numericData]);

  const frecuenciaResults = useMemo(() => {
    if (!columns.length || !selectedColumn) return null;
    const columnData = excelData.map(row => row[selectedColumn]);
    const isNumeric = columnData.every(val => !isNaN(parseFloat(val)));
    return {
      ungroupedTable: createUngroupedFrequencyTable(columnData),
      groupedTable: isNumeric ? createGroupedFrequencyTable(columnData) : null,
    };
  }, [excelData, columns, selectedColumn]);

  // =============================
  // Render de sección de gráficos
  // =============================
  const GraphComponent = GRAPH_COMPONENTS[selectedGraph];

  const renderGraficos = () => {
    if (!excelData.length || !columns.length) return null;

    // controles de selección X/Y y botón Variable Y
    const allNames = columnsByName.map(c => c.name);

    const handleXChange = (e) => setXKey(e.target.value);
    const handleYChange = (e) => setYKey(e.target.value);
    const toggleY = () => {
      // botón "Variable Y"
      if (useY) {
        setUseY(false);
        setYKey('');
      } else {
        setUseY(true);
        // si estaba vacío, intenta sugerir la segunda columna
        if (!yKey) {
          const suggest = allNames.find(n => n !== xKey);
          setYKey(suggest || '');
        }
      }
    };

    return (
      <div className="graficos-section">
        {/* Menú 3D de gráficos */}
        <Menu3DGraficos
          selectedGraph={selectedGraph}
          setSelectedGraph={setSelectedGraph}
          graphOptions={graphOptions}
        />

        {/* Selector de variables */}
        <div className="menu-graficos-column" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end', marginBottom: 16 }}>
          <div>
            <label htmlFor="x-select"><strong>Eje X</strong></label>
            <select id="x-select" value={xKey} onChange={handleXChange}>
              {allNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <label htmlFor="y-select"><strong>Variable Y (opcional)</strong></label>
            <select id="y-select" value={yKey} onChange={handleYChange} disabled={!useY}>
              <option value="">(ninguna)</option>
              {allNames
                .filter(n => n !== xKey)
                .map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <div>
            <button onClick={toggleY} className="edit-toggle-button" style={{ marginTop: 22 }}>
              {useY ? "Desactivar Variable Y" : "Activar Variable Y"}
            </button>
          </div>
        </div>

        {/* Render del gráfico seleccionado */}
        <div className="bg-white p-3 rounded-2xl shadow">
          {GraphComponent ? (
            <GraphComponent
              data={dataForCharts}          // Datos por NOMBRE
              columns={columnsByName}       // [{ name }]
              xKey={xKey}                   // nombre de columna para X
              yKey={useY ? yKey : ""}       // nombre de columna para Y (opcional)
            />
          ) : <p>No se pudo cargar el gráfico.</p>}
        </div>
      </div>
    );
  };

  // =============================
  // Render de vistas estadísticas
  // =============================
  const renderAnalysisContent = () => {
    if (!excelData.length) return null;

    switch (activeView) {
      case 'graficos':
        return renderGraficos();

      case 'tendencia':
        return (
          <div className="analysis-container">
            <div className="menu-graficos-column">
              <label htmlFor="column-select-tendencia">Seleccionar Columna:</label>
              <select
                id="column-select-tendencia"
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
              >
                {columns.map(col => <option key={col.key} value={col.key}>{col.name}</option>)}
              </select>
            </div>

            <h3>Medidas de Tendencia Central</h3>
            {mtcResults ? (
              <div className="analysis-card">
                <p><strong>Media:</strong> {mtcResults.mean?.toFixed(4)}</p>
                <p><strong>Mediana:</strong> {mtcResults.median?.toFixed(4)}</p>
                <p><strong>Moda:</strong> {mtcResults.mode?.map(m => Number(m).toFixed(4)).join(', ')}</p>
              </div>
            ) : <p>No hay datos numéricos en la columna seleccionada.</p>}
          </div>
        );

      case 'posicion':
        return (
          <div className="analysis-container">
            <div className="menu-graficos-column">
              <label htmlFor="column-select-posicion">Seleccionar Columna:</label>
              <select
                id="column-select-posicion"
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
              >
                {columns.map(col => <option key={col.key} value={col.key}>{col.name}</option>)}
              </select>
            </div>

            <h3>Medidas de Posición</h3>
            {mtpResults ? (
              <>
                <div className="analysis-card">
                  <h4>Cuartiles</h4>
                  <p><strong>Q1 (P25):</strong> {mtpResults.quartiles.q1.toFixed(4)}</p>
                  <p><strong>Q2 (P50):</strong> {mtpResults.quartiles.q2.toFixed(4)}</p>
                  <p><strong>Q3 (P75):</strong> {mtpResults.quartiles.q3.toFixed(4)}</p>
                </div>
                <div className="analysis-card">
                  <h4>Deciles</h4>
                  <ul>
                    {Object.keys(mtpResults.deciles).map(key => (
                      <li key={key}><strong>{key.toUpperCase()}:</strong> {mtpResults.deciles[key].toFixed(4)}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : <p>No hay datos numéricos en la columna seleccionada.</p>}
          </div>
        );

      case 'dispersion':
        return (
          <div className="analysis-container">
            <div className="menu-graficos-column">
              <label htmlFor="column-select-dispersion">Seleccionar Columna:</label>
              <select
                id="column-select-dispersion"
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
              >
                {columns.map(col => <option key={col.key} value={col.key}>{col.name}</option>)}
              </select>
            </div>

            <h3>Medidas de Dispersión</h3>
            {disperResults ? (
              <div className="analysis-card">
                <p><strong>Rango:</strong> {disperResults.range?.toFixed(4)}</p>
                <p><strong>Varianza:</strong> {disperResults.variance?.toFixed(4)}</p>
                <p><strong>Desviación Estándar:</strong> {disperResults.standardDeviation?.toFixed(4)}</p>
                <p><strong>Coeficiente de Variación:</strong> {disperResults.coefficientOfVariation?.toFixed(4)}</p>
              </div>
            ) : <p>No hay datos numéricos en la columna seleccionada.</p>}
          </div>
        );

      case 'frecuencia':
        return (
          <div className="analysis-container">
            <div className="menu-graficos-column">
              <label htmlFor="column-select-frecuencia">Seleccionar Columna:</label>
              <select
                id="column-select-frecuencia"
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
              >
                {columns.map(col => <option key={col.key} value={col.key}>{col.name}</option>)}
              </select>
            </div>

            <h3>Tablas de Frecuencia</h3>
            {frecuenciaResults ? (
              <>
                <h4>Tabla No Agrupada</h4>
                {frecuenciaResults.ungroupedTable.length > 0 ? (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Valor</th>
                          <th>Frecuencia Absoluta</th>
                          <th>Frecuencia Relativa</th>
                          <th>Acumulada</th>
                          <th>Relativa Acumulada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {frecuenciaResults.ungroupedTable.map((row, i) => (
                          <tr key={i}>
                            <td>{row.value}</td>
                            <td>{row.absoluteFrequency}</td>
                            <td>{row.relativeFrequency}</td>
                            <td>{row.cumulativeFrequency}</td>
                            <td>{row.cumulativeRelativeFrequency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : <p>No hay datos.</p>}
                {frecuenciaResults.groupedTable && (
                  <>
                    <h4>Tabla Agrupada</h4>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Intervalo</th>
                            <th>Marca de Clase</th>
                            <th>Frec. Abs</th>
                            <th>Frec. Rel</th>
                            <th>Frec. Acum</th>
                            <th>Frec. Rel Acum</th>
                          </tr>
                        </thead>
                        <tbody>
                          {frecuenciaResults.groupedTable.map((row, i) => (
                            <tr key={i}>
                              <td>{row.interval}</td>
                              <td>{row.classMark}</td>
                              <td>{row.absoluteFrequency}</td>
                              <td>{row.relativeFrequency}</td>
                              <td>{row.cumulativeFrequency}</td>
                              <td>{row.cumulativeRelativeFrequency}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            ) : <p>No hay datos para tablas de frecuencia.</p>}
          </div>
        );

      default:
        return null;
    }
  };

  // =============================
  // Render principal
  // =============================
  return (
    <div className="container">
      <h1>Importador y Analizador Científico de Excel</h1>

      {/* Carga de archivo */}
      <div className="upload-section">
        <label htmlFor="file-upload" className="custom-file-upload">Seleccionar Archivo Excel</label>
        <input
          id="file-upload"
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        {fileName && <p className="file-name">Archivo seleccionado: <strong>{fileName}.xlsx</strong></p>}
      </div>

      {/* Botones de descarga */}
      {excelData.length && columns.length ? (
        <div className="action-buttons-section">
          <button onClick={handleDownloadPDF} className="edit-toggle-button">Descargar PDF</button>
          <button onClick={handleDownloadEditedExcel} className="download-button">Descargar Excel</button>
        </div>
      ) : null}

      {/* DataGrid */}
      {excelData.length && columns.length ? (
        <div className="data-grid-container">
          <h2>Datos del Archivo Excel</h2>
          <DataGrid
            columns={columns}
            rows={excelData}
            onRowsChange={onRowsChange}
            enableVirtualization
            minHeight={400}
          />
        </div>
      ) : null}

      {/* Panel de análisis + menú de vistas */}
      {excelData.length && columns.length ? (
        <>
          <div className="analysis-section">
            <h2 className="analysis-title">📊 Panel de Análisis</h2>
            <Menu3D activeView={activeView} setActiveView={setActiveView} />
          </div>
          <div className="results-section">{renderAnalysisContent()}</div>
        </>
      ) : null}

      {excelData.length === 0 && fileName && (
        <p className="no-data-message">No se encontraron datos en el archivo.</p>
      )}
    </div>
  );
}

export default App;
