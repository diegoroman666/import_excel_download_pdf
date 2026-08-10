import './globals.css';
import FondoAnimado from '@/components/background/FondoAnimado';

export const metadata = {
  title: 'Procesador Inteligente de Datos',
  description:
    'Análisis estadístico automático de archivos Excel y CSV: clasificación de variables, '
    + 'dashboard reactivo con filtros y exportación de informes.',
};

export const viewport = {
  themeColor: '#05060f',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        {/* Atajo para saltar la navegación con el teclado. */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]
            focus:rounded-lg focus:bg-acento focus:px-4 focus:py-2 focus:text-sm focus:text-abismo"
        >
          Saltar al contenido
        </a>

        <FondoAnimado />
        {children}
      </body>
    </html>
  );
}
