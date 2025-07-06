import React, { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { DataGrid, textEditor } from 'react-data-grid';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setFileName(file.name.replace(/\.[^/.]+$/, '')); // sin extensión
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
          name: header,
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
      } else {
        setColumns([]);
        setExcelData([]);
        setFileName('');
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
      alert("No hay datos para exportar.");
    }
  };

  const handleDownloadPDF = () => {
    if (!excelData.length || !columns.length) return alert("No hay datos para exportar.");

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

      {excelData.length === 0 && fileName && (
        <p className="no-data-message">
          No se encontraron datos en el archivo o está vacío.
        </p>
      )}
    </div>
  );
}

export default App;
