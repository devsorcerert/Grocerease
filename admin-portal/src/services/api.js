import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api.grocereasetv.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
// SECURITY NOTE: Storing the admin token in localStorage exposes it to XSS vulnerabilities.
// For higher security, migrate to an HttpOnly cookie flow (e.g. backend sets cookie on login, 
// and axios requests automatically include it via withCredentials).
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;