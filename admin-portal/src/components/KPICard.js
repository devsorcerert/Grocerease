import React from 'react';
import '../styles/KPICard.css';

const KPICard = ({ title, value, unit = '', prefix = '', color = 'blue', isText = false }) => {
  const isNumeric = typeof value === 'number' || (typeof value === 'string' && value.trim() !== '' && !isNaN(Number(value)));

  const formatValue = (val) => {
    if (isText || !isNumeric) return val;
    const num = Number(val);
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  return (
    <div className={`kpi-card kpi-${color}`}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">
        {isNumeric ? `${prefix}${formatValue(value)}${unit}` : formatValue(value)}
      </div>
    </div>
  );
};

export default KPICard;
