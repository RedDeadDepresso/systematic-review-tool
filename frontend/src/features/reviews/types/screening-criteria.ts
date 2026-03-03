export type ScreeningCriteriaType = 'Inclusive' | 'Exclusive';

export interface ScreeningCriteria {
  id: number;
  name: string;
  description: string;
  type: ScreeningCriteriaType;
}
