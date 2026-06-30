import api from './api';

export const login = async (email, password) => {
  const response = await api.post('/admin/login', { email, password });
  if (response.data.token) {
    localStorage.setItem('admin_token', response.data.token);
  }
  if (response.data.refresh_token) {
    localStorage.setItem('admin_refresh_token', response.data.refresh_token);
  }
  return response.data;
};

export const logout = async () => {
  const refreshToken = localStorage.getItem('admin_refresh_token');
  try {
    await api.post('/auth/logout', { refresh_token: refreshToken || null });
  } catch (_) {
    // Best-effort: always clear local state even if backend call fails
  }
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_refresh_token');
  window.location.href = '/login';
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('admin_token');
};