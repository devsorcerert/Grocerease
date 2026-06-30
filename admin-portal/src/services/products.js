import api from './api';

export const getProducts = async (params = {}) => {
  const response = await api.get('/admin/products', { params });
  return response.data;
};

export const createProduct = async (productData) => {
  const response = await api.post('/admin/products', productData);
  return response.data;
};

export const updateProduct = async (productId, productData) => {
  const response = await api.put(`/admin/products/${productId}`, productData);
  return response.data;
};

export const deleteProduct = async (productId) => {
  const response = await api.delete(`/admin/products/${productId}`);
  return response.data;
};

export const uploadExcel = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await api.post('/admin/products/upload-excel', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const toggleFeatured = async (productId) => {
  const response = await api.post(`/admin/products/${productId}/toggle-featured`);
  return response.data;
};

export const getCategories = async () => {
  const response = await api.get('/admin/categories');
  return response.data;
};