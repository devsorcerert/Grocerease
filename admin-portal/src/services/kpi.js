import api from './api';

export const getKPIs = async (dateRange = {}) => {
  const response = await api.get('/admin/kpis', { params: dateRange });
  return response.data;
};

export const getOperationalKPIs = async () => {
  const response = await api.get('/admin/kpis/operational');
  return response.data;
};

export const getFinancialKPIs = async () => {
  const response = await api.get('/admin/kpis/financial');
  return response.data;
};

export const getCustomerKPIs = async () => {
  const response = await api.get('/admin/kpis/customer');
  return response.data;
};

export const getInventoryKPIs = async () => {
  const response = await api.get('/admin/kpis/inventory');
  return response.data;
};

export const getTVIntegrationKPIs = async () => {
  const response = await api.get('/admin/kpis/tv-integration');
  return response.data;
};

export const getBrandAnalytics = async () => {
  const response = await api.get('/admin/kpis/brand-analytics');
  return response.data;
};
