import React, { useState, useEffect } from 'react';
import { getKPIs } from '../services/kpi';
import KPICard from '../components/KPICard';
import '../styles/Dashboard.css';

const Dashboard = () => {
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    try {
      setLoading(true);
      const data = await getKPIs();
      setKpis(data);
    } catch (err) {
      setError('Failed to load KPIs');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading KPIs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error">{error}</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Dashboard Overview</h1>
        <button onClick={loadKPIs} className="refresh-button">Refresh</button>
      </div>

      {/* Operational KPIs */}
      <section className="kpi-section">
        <h2>Operational Metrics</h2>
        <div className="kpi-grid">
          <KPICard title="NPS Score" value={kpis?.nps || 0} unit="%" color="green" />
          <KPICard title="Avg Delivery Time" value={kpis?.avgDeliveryTime || 0} unit=" mins" color="blue" />
          <KPICard title="Delivery Efficiency" value={kpis?.deliveryEfficiency || 0} unit="%" color="green" />
          <KPICard title="Order Accuracy Rate" value={kpis?.orderAccuracyRate || 0} unit="%" color="green" />
          <KPICard title="Fulfilment Speed" value={kpis?.fulfilmentSpeed || 0} unit=" mins" color="blue" />
          <KPICard title="No. of Deliveries" value={kpis?.totalDeliveries || 0} unit="" color="purple" />
        </div>
      </section>

      {/* Financial KPIs */}
      <section className="kpi-section">
        <h2>Financial Metrics</h2>
        <div className="kpi-grid">
          <KPICard title="Total Revenue" value={kpis?.totalRevenue || 0} unit=" ₹" prefix="₹" color="orange" />
          <KPICard title="AOV" value={kpis?.aov || 0} unit="" prefix="₹" color="orange" />
          <KPICard title="Revenue per Delivery" value={kpis?.revenuePerDelivery || 0} unit="" prefix="₹" color="orange" />
          <KPICard title="Gross Margin" value={kpis?.grossMargin || 0} unit="%" color="green" />
          <KPICard title="Cost per Delivery" value={kpis?.costPerDelivery || 0} unit="" prefix="₹" color="red" />
        </div>
      </section>

      {/* Customer KPIs */}
      <section className="kpi-section">
        <h2>Customer Metrics</h2>
        <div className="kpi-grid">
          <KPICard title="Customer Retention" value={kpis?.customerRetentionRate || 0} unit="%" color="green" />
          <KPICard title="Customer Satisfaction" value={kpis?.customerSatisfaction || 0} unit="%" color="green" />
          <KPICard title="CAC" value={kpis?.cac || 0} unit="" prefix="₹" color="red" />
          <KPICard title="Customer Lifetime Value" value={kpis?.clv || 0} unit="" prefix="₹" color="orange" />
        </div>
      </section>

      {/* Inventory KPIs */}
      <section className="kpi-section">
        <h2>Inventory Metrics</h2>
        <div className="kpi-grid">
          <KPICard title="Inventory Turnover" value={kpis?.inventoryTurnover || 0} unit="x" color="blue" />
          <KPICard title="Total Products" value={kpis?.totalProducts || 0} unit="" color="purple" />
          <KPICard title="Out of Stock" value={kpis?.outOfStock || 0} unit="" color="red" />
        </div>
      </section>

      {/* TV Integration KPIs */}
      <section className="kpi-section">
        <h2>GrocerEase TV Integration</h2>
        <div className="kpi-grid">
          <KPICard title="Orders via QR Code" value={kpis?.ordersViaQR || 0} unit="" color="green" />
          <KPICard title="TV Users Linked" value={kpis?.tvUsersLinked || 0} unit="" color="blue" />
          <KPICard title="QR Conversion Rate" value={kpis?.qrConversionRate || 0} unit="%" color="green" />
        </div>
      </section>

      {/* Brand Analytics */}
      <section className="kpi-section">
        <h2>Brand Analytics</h2>
        <div className="kpi-grid">
          <KPICard title="Top Brand" value={kpis?.topBrand || 'N/A'} unit="" color="purple" isText />
          <KPICard title="Avg Brand Consumption" value={kpis?.avgBrandConsumption || 0} unit=" items/user" color="blue" />
          <KPICard title="Competitive Price Index" value={kpis?.competitivePricingIndex || 0} unit="" color="orange" />
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
