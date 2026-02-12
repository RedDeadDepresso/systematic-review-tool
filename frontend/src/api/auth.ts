import type { User } from '@/types/auth';
import api from './axios';

/* ------------------ REGISTER ------------------ */
export const registerUser = async (payload: {
  firstName: string;
  lastName: string;
  email: string;
  password1: string;
  password2: string;
}): Promise<User> => {
  const res = await api.post('/auth/registration/', payload);
  return res.data;
};

/* ------------------ LOGIN ------------------ */
export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<User> {
  const res = await api.post('/auth/login/', payload);

  localStorage.setItem('access_token', res.data.access);
  localStorage.setItem('refresh_token', res.data.refresh);

  api.defaults.headers.common['Authorization'] = `Bearer ${res.data.access}`;

  return res.data;
}

/* ------------------ CURRENT USER ------------------ */
export async function fetchUser() {
  const token = localStorage.getItem('access_token');
  if (!token) throw new Error('Not authenticated');

  const res = await api.get('/auth/user/', {
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.data;
}

/* ------------------ UPDATE USER ------------------ */
export async function updateUser(payload: {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}): Promise<User> {
  const res = await api.patch('/users/0/', payload);
  return res.data;
}

/* ------------------ DELETE ACCOUNT ------------------ */
export async function deleteUser() {
  const res = await api.delete('/users/0/');
  logoutUser();
  return res.data;
}

/* ------------------ REFRESH TOKEN ------------------ */
export async function refreshAccessToken() {
  const refresh = localStorage.getItem('refresh_token');
  if (!refresh) {
    logoutUser();
    throw new Error('No refresh token');
  }

  try {
    const res = await api.post('/auth/refresh/', { refresh });

    localStorage.setItem('access_token', res.data.access);
    api.defaults.headers.common['Authorization'] = `Bearer ${res.data.access}`;

    return res.data;
  } catch {
    logoutUser();
    throw new Error('Token refresh failed');
  }
}

/* ------------------ LOGOUT ------------------ */
export function logoutUser() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  delete api.defaults.headers.common['Authorization'];
  window.location.href = '/login';
}
