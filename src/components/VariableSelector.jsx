// src/components/VariableSelector.jsx
import React from "react";

export default function VariableSelector({ columns, xKey, yKey, onChange }) {
  if (!columns || columns.length === 0) {
    return <p className="text-gray-500">No hay columnas disponibles.</p>;
  }

  return (
    <div className="flex gap-4 mb-4">
      {/* Selector de eje X */}
      <div>
        <label className="block text-sm font-semibold text-gray-700">
          Variable X
        </label>
        <select
          className="border rounded p-1"
          value={xKey || ""}
          onChange={(e) => onChange("x", e.target.value)}
        >
          <option value="">-- Ninguna --</option>
          {columns.map((col, i) => (
            <option key={i} value={col.name}>
              {col.name}
            </option>
          ))}
        </select>
      </div>

      {/* Selector de eje Y */}
      <div>
        <label className="block text-sm font-semibold text-gray-700">
          Variable Y
        </label>
        <select
          className="border rounded p-1"
          value={yKey || ""}
          onChange={(e) => onChange("y", e.target.value)}
        >
          <option value="">-- Ninguna --</option>
          {columns.map((col, i) => (
            <option key={i} value={col.name}>
              {col.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
