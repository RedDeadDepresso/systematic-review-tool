import type { ReviewRole } from '@/types/review';

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
  | 'modifyNote';

/**
 * Define allowed roles for each permission
 */
const permissions: Record<ReviewPermission, ReviewRole[]> = {
  modifyReview: ['Owner'],
  assign: ['Owner'],
  invite: ['Owner'],

  modifyScreeningCriteria: ['Owner', 'Collaborator'],
  uploadFiles: ['Owner', 'Collaborator'],
  manageDuplicates: ['Owner', 'Collaborator'],
  modifyThemesCodes: ['Owner', 'Collaborator'],

  modifyContent: ['Owner', 'Collaborator', 'Reviewer'],
  modifyKeyword: ['Owner', 'Collaborator', 'Reviewer'],
  modifyOpinion: ['Owner', 'Collaborator', 'Reviewer'],
  modifyNote: ['Owner', 'Collaborator', 'Reviewer'],
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
