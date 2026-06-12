import React from 'react';
import '../styles/KPICard.css';

const KPICard = ({ title, value, unit = '', prefix = '', color = 'blue', isText = false }) => {
  const formatValue = (val) => {
    if (isText) return val;
    if (typeof val === 'number') {
      if (val >= 1000000) return (val / 1000000).toFixed(2) + 'M';
      if (val >= 1000) return (val / 1000).toFixed(2) + 'K';
      return val.toFixed(2);
    }
    return val;
  };

  return (
    <div className={`kpi-card kpi-${color}`}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">
        {prefix}{formatValue(value)}{unit}
      </div>
    </div>
  );
};

export default KPICard;
