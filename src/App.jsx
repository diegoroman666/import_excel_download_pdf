// src/App.jsx
import React, { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { DataGrid, textEditor } from 'react-data-grid';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Menu3D from "./components/Menu3D";
import Graficos from "./components/Graficos";

import { calculateMean, calculateMedian, calculateMode } from './data/MTC';
import { calculatePercentile, calculateQuartiles, calculateDeciles } from './data/MTP';
import { calculateRange, calculateVariance, calculateStandardDeviation, calculateCoefficientOfVariation } from './data/Disper';
import { createUngroupedFrequencyTable, createGroupedFrequencyTable } from './data/Frecuencia';

import 'react-data-grid/lib/styles.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

const downloadExcel = (data, columns, fileName) => {
  const workbook = XLSX.utils.book_new();
  const headers = columns.map(col => col.name);
  const rows = data.map(row => columns.map(col => row[col.key]));
  const sheetData = [headers, ...rows];
  const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  XLSX.writeFile(workbook, `${fileName || 'edited_excel'}.xlsx`);
};

function App() {
  const [excelData, setExcelData] = useState([]);
  const [fileName, setFileName] = useState('');
  const [columns, setColumns] = useState([]);
  const [activeView, setActiveView] = useState('graficos');
  const [selectedColumn, setSelectedColumn] = useState('');

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
        setSelectedColumn(gridColumns[0]?.key || '');
        setActiveView('graficos');
      } else {
        setColumns([]);
        setExcelData([]);
        setFileName('');
        setSelectedColumn('');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onRowsChange = useCallback((updatedRows) => setExcelData(updatedRows), []);

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

  const renderAnalysisContent = () => {
    if (!excelData.length || !selectedColumn) return null;

    switch (activeView) {
      case 'graficos':
        return <Graficos data={excelData} columns={columns} selectedColumn={selectedColumn} />;

      case 'tendencia':
        return (
          <div className="analysis-container">
            <h3>Medidas de Tendencia Central</h3>
            {mtcResults ? (
              <div className="analysis-card">
                <p><strong>Media:</strong> {mtcResults.mean?.toFixed(2)}</p>
                <p><strong>Mediana:</strong> {mtcResults.median?.toFixed(2)}</p>
                <p><strong>Moda:</strong> {mtcResults.mode?.map(m => m.toFixed(2)).join(', ')}</p>
              </div>
            ) : <p>No hay datos numéricos.</p>}
          </div>
        );

      case 'posicion':
        return (
          <div className="analysis-container">
            <h3>Medidas de Posición</h3>
            {mtpResults ? (
              <>
                <div className="analysis-card">
                  <h4>Cuartiles</h4>
                  <p><strong>Q1 (P25):</strong> {mtpResults.quartiles.q1.toFixed(2)}</p>
                  <p><strong>Q2 (P50):</strong> {mtpResults.quartiles.q2.toFixed(2)}</p>
                  <p><strong>Q3 (P75):</strong> {mtpResults.quartiles.q3.toFixed(2)}</p>
                </div>
                <div className="analysis-card">
                  <h4>Deciles</h4>
                  <ul>
                    {Object.keys(mtpResults.deciles).map(key => (
                      <li key={key}><strong>{key.toUpperCase()}:</strong> {mtpResults.deciles[key].toFixed(2)}</li>
                    ))}
                  </ul>
                </div>
              </>
            ) : <p>No hay datos numéricos.</p>}
          </div>
        );

      case 'dispersion':
        return (
          <div className="analysis-container">
            <h3>Medidas de Dispersión</h3>
            {disperResults ? (
              <div className="analysis-card">
                <p><strong>Rango:</strong> {disperResults.range?.toFixed(2)}</p>
                <p><strong>Varianza:</strong> {disperResults.variance?.toFixed(2)}</p>
                <p><strong>Desviación Estándar:</strong> {disperResults.standardDeviation?.toFixed(2)}</p>
                <p><strong>Coeficiente de Variación:</strong> {disperResults.coefficientOfVariation?.toFixed(2)}</p>
              </div>
            ) : <p>No hay datos numéricos.</p>}
          </div>
        );

      case 'frecuencia':
        return (
          <div className="analysis-container">
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

  return (
    <div className="container">
      <h1>Importador y Analizador Científico de Excel</h1>

      {/* BOTÓN ÚNICO PARA SUBIR ARCHIVO */}
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

      {/* SELECTOR DE COLUMNA */}
      {columns.length > 0 && (
        <div className="column-selector">
          <label htmlFor="column-select">Seleccionar Columna para Análisis/Grafico:</label>
          <select
            id="column-select"
            value={selectedColumn}
            onChange={(e) => setSelectedColumn(e.target.value)}
          >
            {columns.map(col => <option key={col.key} value={col.key}>{col.name}</option>)}
          </select>
        </div>
      )}

      {/* BOTONES DE DESCARGA */}
      {excelData.length && columns.length && (
        <div className="action-buttons-section">
          <button onClick={handleDownloadPDF} className="edit-toggle-button">Descargar PDF</button>
          <button onClick={handleDownloadEditedExcel} className="download-button">Descargar Excel</button>
        </div>
      )}

      {/* DATA GRID */}
      {excelData.length && columns.length && (
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
      )}

      {/* SECCIÓN DE ANÁLISIS */}
      {excelData.length && columns.length && (
        <>
          <div className="analysis-section">
            <h2 className="analysis-title">📊 Panel de Análisis</h2>
            <Menu3D activeView={activeView} setActiveView={setActiveView} />
          </div>
          <div className="results-section">{renderAnalysisContent()}</div>
        </>
      )}

      {excelData.length === 0 && fileName && (
        <p className="no-data-message">No se encontraron datos en el archivo.</p>
      )}
    </div>
  );
}

export default App;
