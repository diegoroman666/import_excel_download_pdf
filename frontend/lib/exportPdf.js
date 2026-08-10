/**
 * Exportación a PDF de los datos filtrados.
 *
 * Se conserva la función de la aplicación original (jsPDF + autoTable), pero
 * ahora imprime lo que el usuario está viendo —filas filtradas y columnas
 * ordenadas— e incluye una portada con el resumen del análisis.
 *
 * `jspdf` se carga bajo demanda: sólo pesa en el bundle de quien exporta.
 */

const LIMITE_FILAS = 5000;

export async function exportarPdf({
  filas,
  columnas,
  nombreArchivo = 'datos',
  titulo = 'Informe de datos',
  filtros = [],
  descripcionFiltros = [],
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const documento = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const anchoPagina = documento.internal.pageSize.getWidth();

  documento.setFontSize(16);
  documento.text(titulo, 40, 42);

  documento.setFontSize(9);
  documento.setTextColor(110);
  const fecha = new Date().toLocaleString('es-ES');
  documento.text(`Generado el ${fecha}`, 40, 60);
  documento.text(
    `${filas.length} filas · ${columnas.length} columnas`,
    anchoPagina - 40,
    60,
    { align: 'right' },
  );

  let inicioTabla = 78;

  if (filtros.length) {
    documento.setTextColor(60);
    documento.text('Filtros aplicados:', 40, inicioTabla);
    inicioTabla += 14;
    for (const descripcion of descripcionFiltros.slice(0, 6)) {
      documento.text(`• ${descripcion}`, 52, inicioTabla);
      inicioTabla += 12;
    }
    inicioTabla += 6;
  }

  const recorte = filas.slice(0, LIMITE_FILAS);
  const cabeceras = columnas.map((columna) => columna.nombre ?? columna);

  autoTable(documento, {
    head: [cabeceras],
    body: recorte.map((fila) =>
      cabeceras.map((nombre) => {
        const valor = fila[nombre];
        return valor === null || valor === undefined ? '' : String(valor);
      }),
    ),
    startY: inicioTabla,
    margin: { left: 40, right: 40 },
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, halign: 'center' },
    alternateRowStyles: { fillColor: [244, 247, 250] },
    didDrawPage: (datos) => {
      const pagina = documento.internal.getNumberOfPages();
      documento.setFontSize(8);
      documento.setTextColor(150);
      documento.text(
        `Página ${pagina}`,
        anchoPagina - 40,
        documento.internal.pageSize.getHeight() - 18,
        { align: 'right' },
      );
      // `datos` incluye el cursor de la tabla; se ignora salvo para el pie.
      void datos;
    },
  });

  if (filas.length > LIMITE_FILAS) {
    documento.setFontSize(8);
    documento.setTextColor(150);
    documento.text(
      `Se imprimieron las primeras ${LIMITE_FILAS} filas de ${filas.length}.`,
      40,
      documento.internal.pageSize.getHeight() - 18,
    );
  }

  documento.save(`${nombreArchivo}.pdf`);
}
