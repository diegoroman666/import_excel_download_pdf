import React from "react";
import "./graficos/Graficos.css";

export default function Menu3DGraficos({ selectedGraph, setSelectedGraph, graphOptions }) {
  return (
    <div className="menu3d-wrap" role="tablist" aria-label="Selector de tipo de gráfico">
      {graphOptions.map(opt => {
        const active = selectedGraph === opt.key;
        return (
          <button
            key={opt.key}
            className={`menu3d-card ${active ? "active" : ""}`}
            onClick={() => setSelectedGraph(opt.key)}
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${opt.key}`}
            title={opt.label}
          >
            <span className="menu3d-title">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
