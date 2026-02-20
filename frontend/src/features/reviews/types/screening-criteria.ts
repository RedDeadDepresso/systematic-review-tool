export type ScreeningCriteriaKind = 'Inclusive' | 'Exclusive';

export interface ScreeningCriteria {
  id: number;
  name: string;
  description: string;
  kind: ScreeningCriteriaKind;
}
