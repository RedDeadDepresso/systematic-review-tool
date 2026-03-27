import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  cacheAppend,
  cacheReplace,
  cacheRemove,
  onMutationError,
  applyCreate,
  applyUpdate,
  applyDelete,
} from './query-helpers';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('query-helpers', () => {
  describe('cache updaters', () => {
    it('cacheAppend adds item to empty or existing array', () => {
      const appendFn = cacheAppend({ id: 1, name: 'A' });
      expect(appendFn()).toEqual([{ id: 1, name: 'A' }]);
      expect(appendFn([{ id: 2, name: 'B' }])).toEqual([
        { id: 2, name: 'B' },
        { id: 1, name: 'A' },
      ]);
    });

    it('cacheReplace replaces matching item or leaves existing', () => {
      const replaceFn = cacheReplace({ id: 1, name: 'New A' });
      expect(replaceFn()).toEqual([]);
      expect(
        replaceFn([
          { id: 1, name: 'A' },
          { id: 2, name: 'B' },
        ])
      ).toEqual([
        { id: 1, name: 'New A' },
        { id: 2, name: 'B' },
      ]);
    });

    it('cacheRemove removes matching item', () => {
      const removeFn = cacheRemove(1);
      expect(removeFn(undefined)).toEqual([]);
      expect(removeFn([{ id: 1 }, { id: 2 }])).toEqual([{ id: 2 }]);
    });
  });

  describe('mutation handlers', () => {
    it('onMutationError calls toast.error', () => {
      const handler = onMutationError('create item');
      handler(new Error('Test error'));
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to create item: Test error'
      );
    });

    describe('apply functions', () => {
      let queryClient: QueryClient;

      beforeEach(() => {
        queryClient = new QueryClient();
        vi.clearAllMocks();
      });

      it('applyCreate updates cache and shows toast', () => {
        applyCreate(
          queryClient,
          ['items'],
          { id: 1, name: 'A' },
          'Created item'
        );
        expect(queryClient.getQueryData(['items'])).toEqual([
          { id: 1, name: 'A' },
        ]);
        expect(toast.success).toHaveBeenCalledWith('Created item');
      });

      it('applyUpdate updates cache and shows toast', () => {
        queryClient.setQueryData(['items'], [{ id: 1, name: 'A' }]);
        applyUpdate(
          queryClient,
          ['items'],
          { id: 1, name: 'B' },
          'Updated item'
        );
        expect(queryClient.getQueryData(['items'])).toEqual([
          { id: 1, name: 'B' },
        ]);
        expect(toast.success).toHaveBeenCalledWith('Updated item');
      });

      it('applyDelete updates cache and shows toast', () => {
        queryClient.setQueryData(['items'], [{ id: 1, name: 'A' }]);
        applyDelete(queryClient, ['items'], 1, 'Deleted item');
        expect(queryClient.getQueryData(['items'])).toEqual([]);
        expect(toast.success).toHaveBeenCalledWith('Deleted item');
      });
    });
  });
});
