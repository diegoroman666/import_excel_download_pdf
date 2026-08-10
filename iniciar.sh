#!/usr/bin/env bash
# Arranca el motor de datos y la interfaz, y los detiene juntos con Ctrl+C.
set -euo pipefail

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ ! -d "$raiz/backend/.venv" ]; then
  echo "Creando el entorno virtual del backend…"
  python3 -m venv "$raiz/backend/.venv"
  "$raiz/backend/.venv/bin/pip" install --quiet -r "$raiz/backend/requirements.txt"
fi

if [ ! -d "$raiz/frontend/node_modules" ]; then
  echo "Instalando dependencias del frontend…"
  (cd "$raiz/frontend" && npm install)
fi

limpiar() {
  echo
  echo "Deteniendo servicios…"
  kill 0
}
trap limpiar EXIT INT TERM

echo "Motor de datos → http://localhost:8000/docs"
(cd "$raiz/backend" && .venv/bin/python -m uvicorn app.main:app --port 8000 --reload) &

echo "Interfaz       → http://localhost:3000"
(cd "$raiz/frontend" && npm run dev) &

wait
