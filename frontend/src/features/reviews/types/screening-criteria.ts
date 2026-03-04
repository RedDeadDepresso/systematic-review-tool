export type ScreeningCriteriaType = 'inclusion' | 'exclusion';

export interface ScreeningCriteria {
  id: number;
  name: string;
  description: string;
  type: ScreeningCriteriaType;
}
