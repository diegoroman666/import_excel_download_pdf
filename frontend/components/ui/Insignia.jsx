/** Etiqueta compacta de estado o categoría. */

export default function Insignia({ children, color, titulo, className = '' }) {
  const estilo = color
    ? {
        color,
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        borderColor: `color-mix(in oklab, ${color} 35%, transparent)`,
      }
    : undefined;

  return (
    <span
      title={titulo}
      style={estilo}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px]
        font-medium ${color ? '' : 'border-borde-suave bg-superficie text-tinta-2'} ${className}`}
    >
      {children}
    </span>
  );
}
