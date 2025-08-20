import React, { useState, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { DataGrid, textEditor } from 'react-data-grid';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Menu3D from "./components/Menu3D";
import Graficos from "./components/Graficos";

// Importaciones para el análisis de datos
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
  const [activeView, setActiveView] = useState(''); // graficos | tendencia | posicion | dispersion | frecuencia

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
        setActiveView('graficos');
      } else {
        setColumns([]);
        setExcelData([]);
        setFileName('');
        setActiveView('');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const onRowsChange = useCallback((updatedRows) => {
    setExcelData(updatedRows);
  }, []);

  const handleDownloadEditedExcel = () => {
    if (excelData.length > 0 && columns.length > 0) {
      downloadExcel(excelData, columns, fileName);
    } else {
      // Usar una modal o mensaje personalizado en lugar de alert()
      console.log("No hay datos para exportar.");
    }
  };

  const handleDownloadPDF = () => {
    if (!excelData.length || !columns.length) {
      // Usar una modal o mensaje personalizado en lugar de alert()
      console.log("No hay datos para exportar.");
      return;
    }

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`Tabla del archivo: ${fileName}.xlsx`, 14, 15);

    const headers = columns.map(col => col.name);
    const data = excelData.map(row => columns.map(col => row[col.key]));

    autoTable(doc, {
      head: [headers],
      body: data,
      startY: 25,
      styles: {
        fontSize: 8,
        cellPadding: 2
      },
      headStyles: {
        fillColor: [22, 160, 133],
        textColor: 255,
        halign: 'center'
      }
    });

    doc.save(`${fileName}_tabla.pdf`);
  };

  // --- Lógica de análisis de datos integrada ---
  const numericData = useMemo(() => {
    if (!excelData.length || !columns.length) {
      return [];
    }
    // Encuentra la primera columna numérica para el análisis
    const numericKeys = columns.filter(col => {
      const sample = excelData.slice(0, 100);
      let numericCount = 0;
      for (const row of sample) {
        if (!isNaN(parseFloat(row[col.key]))) {
          numericCount++;
        }
      }
      return numericCount / sample.length > 0.6;
    }).map(col => col.key);

    if (numericKeys.length > 0) {
      const firstNumericKey = numericKeys[0];
      return excelData.map(row => parseFloat(row[firstNumericKey])).filter(v => !isNaN(v));
    }
    return [];
  }, [excelData, columns]);

  const mtcResults = useMemo(() => {
    if (numericData.length > 0) {
      return {
        mean: calculateMean(numericData),
        median: calculateMedian(numericData),
        mode: calculateMode(numericData),
      };
    }
    return null;
  }, [numericData]);

  const mtpResults = useMemo(() => {
    if (numericData.length > 0) {
      return {
        percentiles: {
          p25: calculatePercentile(numericData, 25),
          p50: calculatePercentile(numericData, 50),
          p75: calculatePercentile(numericData, 75)
        },
        quartiles: calculateQuartiles(numericData),
        deciles: calculateDeciles(numericData)
      };
    }
    return null;
  }, [numericData]);

  const disperResults = useMemo(() => {
    if (numericData.length > 0) {
      return {
        range: calculateRange(numericData),
        variance: calculateVariance(numericData),
        standardDeviation: calculateStandardDeviation(numericData),
        coefficientOfVariation: calculateCoefficientOfVariation(numericData),
      };
    }
    return null;
  }, [numericData]);

  const frecuenciaResults = useMemo(() => {
    if (columns.length > 0) {
      const firstColumnKey = columns[0].key;
      const firstColumnData = excelData.map(row => row[firstColumnKey]);
      const isNumeric = firstColumnData.every(val => !isNaN(parseFloat(val)));

      return {
        ungroupedTable: createUngroupedFrequencyTable(firstColumnData),
        groupedTable: isNumeric ? createGroupedFrequencyTable(firstColumnData) : null,
      };
    }
    return null;
  }, [excelData, columns]);

  // --- Componentes para renderizar los resultados ---
  const renderAnalysisContent = () => {
    if (!excelData.length) {
      return null;
    }

    switch (activeView) {
      case 'graficos':
        return <Graficos data={excelData} columns={columns} />;

      case 'tendencia':
        return (
          <div className="analysis-container">
            <h3>Medidas de Tendencia Central</h3>
            {mtcResults ? (
              <div className="analysis-card">
                <p><strong>Media:</strong> {mtcResults.mean ? mtcResults.mean.toFixed(2) : 'N/A'}</p>
                <p><strong>Mediana:</strong> {mtcResults.median ? mtcResults.median.toFixed(2) : 'N/A'}</p>
                <p><strong>Moda:</strong> {mtcResults.mode ? mtcResults.mode.map(m => m.toFixed(2)).join(', ') : 'N/A'}</p>
              </div>
            ) : (
              <p>No se encontraron datos numéricos para calcular las medidas de tendencia central.</p>
            )}
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
                  <p><strong>Q1 (Percentil 25):</strong> {mtpResults.quartiles.q1.toFixed(2)}</p>
                  <p><strong>Q2 (Percentil 50):</strong> {mtpResults.quartiles.q2.toFixed(2)}</p>
                  <p><strong>Q3 (Percentil 75):</strong> {mtpResults.quartiles.q3.toFixed(2)}</p>
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
            ) : (
              <p>No se encontraron datos numéricos para calcular las medidas de posición.</p>
            )}
          </div>
        );

      case 'dispersion':
        return (
          <div className="analysis-container">
            <h3>Medidas de Dispersión</h3>
            {disperResults ? (
              <div className="analysis-card">
                <p><strong>Rango:</strong> {disperResults.range ? disperResults.range.toFixed(2) : 'N/A'}</p>
                <p><strong>Varianza:</strong> {disperResults.variance ? disperResults.variance.toFixed(2) : 'N/A'}</p>
                <p><strong>Desviación Estándar:</strong> {disperResults.standardDeviation ? disperResults.standardDeviation.toFixed(2) : 'N/A'}</p>
                <p><strong>Coeficiente de Variación:</strong> {disperResults.coefficientOfVariation ? disperResults.coefficientOfVariation.toFixed(2) : 'N/A'}</p>
              </div>
            ) : (
              <p>No se encontraron datos numéricos para calcular las medidas de dispersión.</p>
            )}
          </div>
        );

      case 'frecuencia':
        return (
          <div className="analysis-container">
            <h3>Tablas de Frecuencia</h3>
            {frecuenciaResults ? (
              <>
                <h4>Tabla de Frecuencia no Agrupada</h4>
                {frecuenciaResults.ungroupedTable.length > 0 ? (
                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          <th>Valor</th>
                          <th>Frecuencia Absoluta</th>
                          <th>Frecuencia Relativa</th>
                          <th>Frecuencia Acumulada</th>
                          <th>Frecuencia Relativa Acumulada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {frecuenciaResults.ungroupedTable.map((row, index) => (
                          <tr key={index}>
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
                ) : (
                  <p>No se encontraron datos para la tabla de frecuencia no agrupada.</p>
                )}

                {frecuenciaResults.groupedTable && (
                  <>
                    <h4>Tabla de Frecuencia Agrupada</h4>
                    <div className="table-wrapper">
                      <table>
                        <thead>
                          <tr>
                            <th>Intervalo</th>
                            <th>Marca de Clase</th>
                            <th>Frecuencia Absoluta</th>
                            <th>Frecuencia Relativa</th>
                            <th>Frecuencia Acumulada</th>
                            <th>Frecuencia Relativa Acumulada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {frecuenciaResults.groupedTable.map((row, index) => (
                            <tr key={index}>
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
            ) : (
              <p>No se encontraron datos para generar las tablas de frecuencia.</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="container">
      <h1>Importador y Visualizador de Archivos Excel</h1>

      <div className="upload-section">
        <label htmlFor="file-upload" className="custom-file-upload">
          Seleccionar Archivo Excel
        </label>
        <input
          id="file-upload"
          type="file"
          accept=".xlsx, .xls"
          onChange={handleFileUpload}
        />
        {fileName && <p className="file-name">Archivo seleccionado: <strong>{fileName}.xlsx</strong></p>}
      </div>

      {excelData.length > 0 && columns.length > 0 && (
        <div className="action-buttons-section">
          <button onClick={handleDownloadPDF} className="edit-toggle-button">
            Descargar en Formato PDF
          </button>
          <button onClick={handleDownloadEditedExcel} className="download-button">
            Descargar Nuevo Excel Editado
          </button>
        </div>
      )}

      {excelData.length > 0 && columns.length > 0 && (
        <>
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

          {/* Título + menú */}
          <div className="analysis-section">
            <h2 className="analysis-title">📊 Aquí están los datos que necesitas</h2>
            <Menu3D activeView={activeView} setActiveView={setActiveView} />
          </div>

          {/* Panel de resultados con contenido dinámico */}
          <div className="results-section" style={{ marginTop: 20 }}>
            {renderAnalysisContent()}
          </div>
        </>
      )}

      {excelData.length === 0 && fileName && (
        <p className="no-data-message">
          No se encontraron datos en el archivo o está vacío.
        </p>
      )}
    </div>
  );
}

export default App;
