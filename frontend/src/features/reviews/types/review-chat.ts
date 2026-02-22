export interface ChatMessage {
  id: number;
  memberId: number | null;
  userId: number | null;
  userName: string;
  avatarUrl: string | null;
  message: string;
  isSystemMessage: boolean;
  metadata?: any;
  createdAt: string;
}

export interface ChatMember {
  id: number;
  userId: number;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  avatarColor: string;
}
