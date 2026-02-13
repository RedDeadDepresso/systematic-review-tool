import type { User } from '@/types/auth';
import api from './axios';
import { redirect } from '@tanstack/react-router';

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
  email?: string;
  firstName?: string;
  lastName?: string;
  avatar?: File | null;
}): Promise<User> {
  const formData = new FormData();
  if (payload.email) {
    formData.append('email', payload.email);
  }
  if (payload.firstName) {
    formData.append('firstName', payload.firstName);
  }
  if (payload.lastName) {
    formData.append('lastName', payload.lastName);
  }
  if (payload.avatar === null) {
    formData.append('avatar', '');
  } else if (payload.avatar) {
    formData.append('avatar', payload.avatar);
  }

  const res = await api.patch('/auth/user/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return res.data;
}

/* ------------------ DELETE ACCOUNT ------------------ */
export async function deleteUser() {
  const res = await api.delete('/auth/user/');
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

/* ------------------ CHANGE PASSWORD ------------------ */
export async function changePassword(payload: {
  newPassword1: string;
  newPassword2: string;
}): Promise<{ detail: string }> {
  const res = await api.post('/auth/password/change/', payload);
  return res.data;
}

/* ------------------ REQUEST PASSWORD RESET ------------------ */
export async function requestPasswordReset(payload: {
  email: string;
}): Promise<{ detail: string }> {
  const res = await api.post('/auth/password/reset/', payload);
  return res.data;
}

/* ------------------ CONFIRM PASSWORD RESET ------------------ */
export async function confirmPasswordReset(payload: {
  newPassword1: string;
  newPassword2: string;
  uid: string;
  token: string;
}): Promise<{ detail: string }> {
  const res = await api.post('/auth/password/reset/confirm/', payload);
  return res.data;
}

/* ------------------ LOGOUT ------------------ */
export function logoutUser() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  delete api.defaults.headers.common['Authorization'];
  window.location.href = '/login';
}

export async function redirectAuthenticated() {
  const token = localStorage.getItem('access_token');
  if (token) throw redirect({ to: '/' });
}

export async function redirectUnauthenticated() {
  const token = localStorage.getItem('access_token');
  if (!token) throw redirect({ to: '/login' });
}
