import type { AttachmentPayload, Conversation, Message, User, UserSettings } from '../types';

// Hold Bearer access token strictly in JS memory (never in localStorage or sessionStorage)
let inMemoryToken: string | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryToken;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('X-Requested-With', 'XMLHttpRequest');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.detail === 'string'
        ? data.detail
        : typeof data?.error === 'string'
          ? data.error
          : `Request failed with status ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export interface AuthPayload {
  access_token: string;
  user: User;
  settings: UserSettings;
}

export const authApi = {
  register: async (body: {
    full_name: string;
    email: string;
    password: string;
    confirm_password: string;
    terms_accepted: boolean;
  }): Promise<AuthPayload> => {
    const res = await requestJson<AuthPayload>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setAccessToken(res.access_token);
    return res;
  },

  login: async (body: {
    email: string;
    password: string;
    remember_me: boolean;
  }): Promise<AuthPayload> => {
    const res = await requestJson<AuthPayload>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setAccessToken(res.access_token);
    return res;
  },

  demo: async (): Promise<AuthPayload> => {
    const res = await requestJson<AuthPayload>('/api/auth/demo', {
      method: 'POST',
    });
    setAccessToken(res.access_token);
    return res;
  },

  logout: async (): Promise<void> => {
    await requestJson('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null);
  },

  me: async (): Promise<AuthPayload> => {
    const res = await requestJson<AuthPayload>('/api/auth/me');
    if (res.access_token) {
      setAccessToken(res.access_token);
    }
    return res;
  },

  forgotPassword: async (email: string): Promise<{ message: string; reset_token?: string }> => {
    return requestJson('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  resetPassword: async (body: {
    token: string;
    new_password: string;
    confirm_password: string;
  }): Promise<{ message: string }> => {
    return requestJson('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

export const userApi = {
  updateProfile: (body: { full_name?: string; profile_image?: string | null }) =>
    requestJson<{ user: User }>('/api/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  changePassword: (body: {
    current_password: string;
    new_password: string;
    confirm_password: string;
  }) =>
    requestJson<{ ok: boolean; message: string }>('/api/users/password', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  updateSettings: (body: {
    theme?: 'light' | 'dark';
    language?: string;
    response_preferences?: string;
  }) =>
    requestJson<{ settings: UserSettings }>('/api/users/settings', {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
};

export interface StreamHandlers {
  onUserMessage?: (msg: Message) => void;
  onConversation?: (conv: Conversation) => void;
  onChunk: (delta: string) => void;
  onDone: (msg: Message) => void;
  onError: (errMsg: string) => void;
}

async function consumeSseStream(
  url: string,
  body: unknown,
  handlers: StreamHandlers,
  signal?: AbortSignal
): Promise<void> {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  });
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const response = await fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData?.detail || errData?.error || 'Failed to stream response.');
  }

  if (!response.body) {
    throw new Error('Streaming is not supported by this browser.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processBlock = (block: string) => {
    const lines = block.split('\n');
    let eventName = 'message';
    let dataLine = '';
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataLine += line.slice(5).trim();
      }
    }
    if (!dataLine) return;
    try {
      const parsed = JSON.parse(dataLine);
      if (eventName === 'user_message') handlers.onUserMessage?.(parsed as Message);
      else if (eventName === 'conversation') handlers.onConversation?.(parsed as Conversation);
      else if (eventName === 'chunk') handlers.onChunk(String(parsed.text || ''));
      else if (eventName === 'done') handlers.onDone(parsed.message as Message);
      else if (eventName === 'error') handlers.onError(String(parsed.error || 'AI error occurred.'));
    } catch {
      // Ignore malformed SSE fragment
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex !== -1) {
      const block = buffer.slice(0, separatorIndex).trim();
      buffer = buffer.slice(separatorIndex + 2);
      if (block) processBlock(block);
      separatorIndex = buffer.indexOf('\n\n');
    }
  }

  if (buffer.trim()) {
    processBlock(buffer.trim());
  }
}

export const chatApi = {
  listConversations: (query = '') => {
    const qs = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
    return requestJson<{ conversations: Conversation[] }>(`/api/conversations${qs}`);
  },

  createConversation: (title?: string) =>
    requestJson<{ conversation: Conversation }>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),

  getConversation: (id: number) =>
    requestJson<{ conversation: Conversation; messages: Message[] }>(`/api/conversations/${id}`),

  renameConversation: (id: number, title: string) =>
    requestJson<{ conversation: Conversation }>(`/api/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),

  deleteConversation: (id: number) =>
    requestJson<{ ok: boolean }>(`/api/conversations/${id}`, {
      method: 'DELETE',
    }),

  clearAllConversations: () =>
    requestJson<{ ok: boolean }>('/api/conversations', {
      method: 'DELETE',
    }),

  sendMessageStream: (
    conversationId: number,
    payload: {
      content: string;
      attachment?: AttachmentPayload;
      editMessageId?: number;
    },
    handlers: StreamHandlers,
    signal?: AbortSignal
  ) => consumeSseStream(`/api/conversations/${conversationId}/messages`, payload, handlers, signal),

  regenerateStream: (
    conversationId: number,
    handlers: StreamHandlers,
    signal?: AbortSignal
  ) => consumeSseStream(`/api/conversations/${conversationId}/regenerate`, {}, handlers, signal),
};
