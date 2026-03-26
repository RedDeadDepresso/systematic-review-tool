import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '@/api/client';
import {
  sendInvitations,
  fetchInvitations,
  acceptInvitation,
  declineInvitation,
  deleteInvitation,
} from './review-invitations';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Reviews API - Invitations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('sendInvitations', () => {
    it('should map invitations gracefully routing params optimally', async () => {
      const payload = {
        review: 10,
        emails: ['a@a.com'],
        role: 'reviewer' as const,
      };
      const mockData = { status: 'sent' };
      vi.mocked(api.post).mockResolvedValueOnce({ data: mockData });

      const result = await sendInvitations(payload);

      expect(api.post).toHaveBeenCalledWith('/review-invitations/', payload);
      expect(result).toEqual(mockData);
    });
  });

  describe('fetchInvitations', () => {
    it('should retrieve invitations dynamically passing type logically', async () => {
      const mockData = [{ id: 1, email: 'a@a.com' }];
      vi.mocked(api.get).mockResolvedValueOnce({ data: mockData });

      const result = await fetchInvitations('received');

      expect(api.get).toHaveBeenCalledWith('/review-invitations/', {
        params: { type: 'received' },
      });
      expect(result).toEqual(mockData);
    });
  });

  describe('acceptInvitation', () => {
    it('should securely trigger accept endpoints natively mapping states', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({ data: { detail: 'ok' } });
      const result = await acceptInvitation(1);
      expect(api.post).toHaveBeenCalledWith('/review-invitations/1/accept/');
      expect(result.detail).toBe('ok');
    });
  });

  describe('declineInvitation', () => {
    it('should securely evaluate decline schema triggering deletions mapping logically', async () => {
      vi.mocked(api.post).mockResolvedValueOnce({
        data: { detail: 'declined' },
      });
      const result = await declineInvitation(1);
      expect(api.post).toHaveBeenCalledWith('/review-invitations/1/decline/');
      expect(result.detail).toBe('declined');
    });
  });

  describe('deleteInvitation', () => {
    it('should fully expunge invites natively invoking DELETE cleanly', async () => {
      vi.mocked(api.delete).mockResolvedValueOnce({ data: null });
      await deleteInvitation(1);
      expect(api.delete).toHaveBeenCalledWith('/review-invitations/1/');
    });
  });
});
