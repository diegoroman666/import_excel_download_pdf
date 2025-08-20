import React from "react";
import "./Menu3D.css";
import { FaChartBar, FaCalculator, FaBullseye, FaBalanceScale, FaTable } from "react-icons/fa";

function Menu3D({ activeView, setActiveView }) {
  const items = [
    { key: "graficos", label: "Gráficos", icon: <FaChartBar size={36} /> },
    { key: "tendencia", label: "Tendencia Central", icon: <FaCalculator size={36} /> },
    { key: "posicion", label: "Medidas de Posición", icon: <FaBullseye size={36} /> },
    { key: "dispersion", label: "Dispersión", icon: <FaBalanceScale size={36} /> },
    { key: "frecuencia", label: "Frecuencias", icon: <FaTable size={36} /> }
  ];

  return (
    <div className="menu3d-container">
      <div className="menu3d-grid">
        {items.map(it => (
          <button
            key={it.key}
            className={`menu3d-card ${activeView === it.key ? "active" : ""}`}
            onClick={() => setActiveView(it.key)}
            type="button"
          >
            <div className="menu3d-icon">{it.icon}</div>
            <div className="menu3d-title">{it.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Menu3D;
