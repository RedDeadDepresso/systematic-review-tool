import { describe, it, expect } from 'vitest';
import { can, isOwner } from './permissions';

describe('permissions', () => {
  describe('can', () => {
    it('returns false for null or undefined role', () => {
      expect(can('modifyReview', null)).toBe(false);
      expect(can('modifyReview', undefined)).toBe(false);
    });

    it('returns true if role is allowed for permission', () => {
      expect(can('modifyReview', 'owner')).toBe(true);
      expect(can('modifyScreeningCriteria', 'owner')).toBe(true);
      expect(can('modifyScreeningCriteria', 'collaborator')).toBe(true);
      expect(can('modifyContent', 'reviewer')).toBe(true);
    });

    it('returns false if role is not allowed for permission', () => {
      expect(can('modifyReview', 'collaborator')).toBe(false);
      expect(can('assign', 'reviewer')).toBe(false);
      expect(can('uploadFiles', 'reviewer')).toBe(false);
    });
  });

  describe('isOwner', () => {
    it('returns true only for owner role', () => {
      expect(isOwner('owner')).toBe(true);
      expect(isOwner('collaborator')).toBe(false);
      expect(isOwner('reviewer')).toBe(false);
      expect(isOwner(null)).toBe(false);
      expect(isOwner(undefined)).toBe(false);
    });
  });
});
