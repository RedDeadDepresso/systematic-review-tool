import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from './axios';

import {
  registerUser,
  loginUser,
  fetchUser,
  updateUser,
  deleteUser,
  refreshAccessToken,
  logoutUser,
} from './auth';

vi.mock('./axios');

describe('auth service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    delete api.defaults.headers.common['Authorization'];
  });

  it('registerUser calls API and returns user', async () => {
    const mockUser = { id: 1, email: 'test@test.com' };
    (api.post as any).mockResolvedValue({ data: mockUser });

    const res = await registerUser({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@test.com',
      password: 'pass',
      confirmPassword: 'pass',
    });

    expect(api.post).toHaveBeenCalledWith('/users/', expect.any(Object));
    expect(res).toEqual(mockUser);
  });

  it('loginUser stores tokens and sets Authorization header', async () => {
    (api.post as any).mockResolvedValue({
      data: {
        access: 'access-token',
        refresh: 'refresh-token',
      },
    });

    const res = await loginUser({
      email: 'test@test.com',
      password: 'pass',
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'access_token',
      'access-token'
    );
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'refresh_token',
      'refresh-token'
    );
    expect(api.defaults.headers.common['Authorization']).toBe(
      'Bearer access-token'
    );
    expect(res).toEqual({
      access: 'access-token',
      refresh: 'refresh-token',
    });
  });

  it('fetchUser throws if not authenticated', async () => {
    await expect(fetchUser()).rejects.toThrow('Not authenticated');
  });

  it('fetchUser fetches current user', async () => {
    localStorage.setItem('access_token', 'token');
    (api.get as any).mockResolvedValue({ data: { id: 1 } });

    const res = await fetchUser();

    expect(api.get).toHaveBeenCalledWith('/users/0/', {
      headers: { Authorization: 'Bearer token' },
    });
    expect(res).toEqual({ id: 1 });
  });

  it('updateUser patches user', async () => {
    (api.patch as any).mockResolvedValue({ data: { id: 1 } });

    const res = await updateUser({ firstName: 'Updated' });

    expect(api.patch).toHaveBeenCalledWith('/users/0/', {
      firstName: 'Updated',
    });
    expect(res.id).toBe(1);
  });

  it('deleteUser deletes user and logs out', async () => {
    (api.delete as any).mockResolvedValue({ data: {} });
    const spy = vi.spyOn(window.location, 'href', 'set');

    await deleteUser();

    expect(api.delete).toHaveBeenCalledWith('/users/0/');
    expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('refresh_token');
    expect(spy).toHaveBeenCalledWith('/login');
  });

  it('refreshAccessToken refreshes token', async () => {
    localStorage.setItem('refresh_token', 'refresh');

    (api.post as any).mockResolvedValue({
      data: { access: 'new-access' },
    });

    const res = await refreshAccessToken();

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'access_token',
      'new-access'
    );
    expect(api.defaults.headers.common['Authorization']).toBe(
      'Bearer new-access'
    );
    expect(res.access).toBe('new-access');
  });

  it('refreshAccessToken logs out on failure', async () => {
    localStorage.setItem('refresh_token', 'refresh');
    (api.post as any).mockRejectedValue(new Error('fail'));

    await expect(refreshAccessToken()).rejects.toThrow('Token refresh failed');
    expect(localStorage.removeItem).toHaveBeenCalled();
  });

  it('logoutUser clears storage and redirects', () => {
    const spy = vi.spyOn(window.location, 'href', 'set');

    logoutUser();

    expect(localStorage.removeItem).toHaveBeenCalledWith('access_token');
    expect(localStorage.removeItem).toHaveBeenCalledWith('refresh_token');
    expect(spy).toHaveBeenCalledWith('/login');
  });
});
