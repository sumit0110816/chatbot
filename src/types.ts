export interface User {
  id: number;
  full_name: string;
  email: string;
  profile_image: string | null;
  is_active: number | boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: number;
  user_id: number;
  theme: 'light' | 'dark';
  language: string;
  response_preferences: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
  last_message?: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachment_name?: string | null;
  attachment_mime?: string | null;
  token_usage?: number | null;
  created_at: string;
}

export interface AttachmentPayload {
  name: string;
  mimeType: string;
  dataBase64?: string;
  textContent?: string;
}

export type AppRoute =
  | 'landing'
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'reset-password'
  | 'chat';
