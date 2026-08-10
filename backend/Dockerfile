# Imagen de producción del motor de datos.
#
# Sirve para cualquier proveedor que ejecute contenedores: Render, Railway,
# Fly.io, Google Cloud Run, Azure Container Apps o una VPS.
#
# Construir y probar en local:
#   docker build -t motor-datos ./backend
#   docker run --rm -p 8000:8000 -e CORS_ORIGINS=http://localhost:3000 motor-datos

FROM python:3.12-slim

# Evita archivos .pyc y fuerza la salida sin búfer para que los registros
# aparezcan en tiempo real en el panel del proveedor.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Las dependencias se copian aparte para aprovechar la caché de capas: sólo se
# reinstalan cuando cambia requirements.txt, no con cada cambio de código.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Usuario sin privilegios: si el proceso se ve comprometido, no es root.
RUN useradd --create-home --uid 1000 motor && chown -R motor:motor /app
USER motor

EXPOSE 8000

# La mayoría de los proveedores inyectan el puerto en la variable PORT; si no
# existe, se usa 8000. Se lanza con shell para poder expandirla.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
