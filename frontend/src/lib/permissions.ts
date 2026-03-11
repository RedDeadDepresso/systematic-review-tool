import type { ReviewRole } from '@/features/reviews/types/reviews';

/**
 * All available permissions as a type
 */
export type ReviewPermission =
  | 'modifyReview'
  | 'assign'
  | 'invite'
  | 'modifyScreeningCriteria'
  | 'uploadFiles'
  | 'manageDuplicates'
  | 'modifyThemesCodes'
  | 'modifyContent'
  | 'modifyKeyword'
  | 'modifyOpinion'
  | 'modifyNote'
  | 'addData';

/**
 * Define allowed roles for each permission
 */
const permissions: Record<ReviewPermission, ReviewRole[]> = {
  modifyReview: ['owner'],
  assign: ['owner'],
  invite: ['owner'],

  modifyScreeningCriteria: ['owner', 'collaborator'],
  uploadFiles: ['owner', 'collaborator'],
  manageDuplicates: ['owner', 'collaborator'],
  modifyThemesCodes: ['owner', 'collaborator'],

  modifyContent: ['owner', 'collaborator', 'reviewer'],
  modifyKeyword: ['owner', 'collaborator', 'reviewer'],
  modifyOpinion: ['owner', 'collaborator', 'reviewer'],
  modifyNote: ['owner', 'collaborator', 'reviewer'],
  addData: ['owner', 'collaborator'],
};

/**
 * Check if the role is allowed for a permission
 */
export const can = (
  permission: ReviewPermission,
  role: ReviewRole | null | undefined
): boolean => {
  if (!role) return false;
  return permissions[permission].includes(role);
};

/**
 * Optional helper for owner-only checks
 */
export const isOwner = (role: ReviewRole | null | undefined): boolean =>
  can('modifyReview', role);
