export interface ScreeningStat {
  id: number;
  userName: string;
  userEmail: string;
  seconds: number;
  hours: number;
  sessions: number;
}

export interface OpinionStats {
  memberId: number;
  userName: string;
  userEmail: string;
  excluded: number;
  maybe: number;
  included: number;
  total: number;
}
