export type Review = {
  title: string;
  description: string;
  isActive: boolean;
  referenceCount: number;
  referenceDuplicatesCount: number;
};

export type ReviewRow = {
  title: string;
  dateCreated: string;
  owner: string;
  referenceCount: number;
  id: number;
};
