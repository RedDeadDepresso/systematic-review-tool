// src/api/axios.ts
import axios from 'axios';
import qs from 'qs';

const api = axios.create({
  baseURL: 'http://localhost:8000/api',
  paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'comma' }),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
