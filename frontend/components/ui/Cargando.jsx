/** Indicador de carga en línea. */

export default function Cargando({ texto = 'Calculando…', className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 text-sm text-tinta-3 ${className}`}>
      <span className="animar-girar inline-block size-4 rounded-full border-2 border-borde border-t-acento" />
      {texto}
    </span>
  );
}
