import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  BookOpen,
  Check,
  Code2,
  Copy,
  Download,
  Edit2,
  FileText,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquare,
  Mic,
  MicOff,
  Moon,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Square,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { NovaLogo } from '../components/NovaLogo';
import { SettingsModal } from '../components/SettingsModal';
import { useAuth } from '../context/AuthContext';
import { chatApi, userApi } from '../services/api';
import { exportConversationAsPdf, exportConversationAsTxt } from '../services/exportChat';
import type { AttachmentPayload, Conversation, Message } from '../types';

interface SuggestedPrompt {
  title: string;
  subtitle: string;
  prompt: string;
  icon: React.ReactNode;
  action?: 'attach';
}

const SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    title: 'Explain a difficult topic',
    subtitle: 'Break down quantum entanglement with intuitive analogies',
    prompt: 'Explain quantum entanglement in plain English using a clear real-world analogy.',
    icon: <BookOpen className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
  },
  {
    title: 'Write Python code',
    subtitle: 'Build a clean FastAPI dependency for rate limiting',
    prompt:
      'Write a clean, well-typed Python FastAPI sliding-window rate limiter dependency with an example route.',
    icon: <Code2 className="h-4 w-4 text-violet-600 dark:text-violet-400" />,
  },
  {
    title: 'Help me brainstorm ideas',
    subtitle: 'Explore creative angles for a product launch',
    prompt:
      'Help me brainstorm 5 practical, high-impact launch ideas for a developer productivity web app.',
    icon: <Lightbulb className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
  },
  {
    title: 'Summarize a document',
    subtitle: 'Upload a PDF, Markdown, CSV, or text file to analyze',
    prompt: '',
    icon: <FileText className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
    action: 'attach',
  },
];

function groupConversationsByDate(conversations: Conversation[]): Array<{
  label: string;
  items: Conversation[];
}> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;

  const groups: Record<string, Conversation[]> = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    Older: [],
  };

  for (const conv of conversations) {
    const ts = new Date(conv.updated_at).getTime();
    if (ts >= startOfToday) groups.Today.push(conv);
    else if (ts >= startOfToday - oneDayMs) groups.Yesterday.push(conv);
    else if (ts >= startOfToday - 7 * oneDayMs) groups['Previous 7 Days'].push(conv);
    else groups.Older.push(conv);
  }

  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export const ChatDashboard: React.FC = () => {
  const { user, settings, setSettings, logout } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);

  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<AttachmentPayload | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);

  // Editing states
  const [editingMsgId, setEditingMsgId] = useState<number | null>(null);
  const [editingMsgText, setEditingMsgText] = useState('');
  const [renamingConvId, setRenamingConvId] = useState<number | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<number | null>(null);

  // Voice & UI states
  const [isListening, setIsListening] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const isDark = settings?.theme === 'dark';

  // Apply dark class only inside dashboard when user preference is dark
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, [isDark]);

  const loadConversations = useCallback(async (query = '') => {
    try {
      const res = await chatApi.listConversations(query);
      setConversations(res.conversations);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to load conversations.');
    } finally {
      setConvsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadConversations(searchQuery);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery, loadConversations]);

  const selectConversation = useCallback(async (convId: number) => {
    setActiveConvId(convId);
    setSidebarOpen(false);
    setChatError(null);
    setEditingMsgId(null);
    setMsgsLoading(true);
    try {
      const res = await chatApi.getConversation(convId);
      setMessages(res.messages);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to load messages.');
    } finally {
      setMsgsLoading(false);
    }
  }, []);

  const handleNewChat = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setStreamingText('');
    setActiveConvId(null);
    setMessages([]);
    setAttachment(null);
    setChatError(null);
    setEditingMsgId(null);
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: isStreaming ? 'auto' : 'smooth' });
  }, [messages, streamingText, isStreaming]);

  // Auto-resize composer textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [input]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) ?? null,
    [conversations, activeConvId]
  );

  const groupedConversations = useMemo(
    () => groupConversationsByDate(conversations),
    [conversations]
  );

  const toggleTheme = async () => {
    const nextTheme = isDark ? 'light' : 'dark';
    try {
      const res = await userApi.updateSettings({ theme: nextTheme });
      setSettings(res.settings);
    } catch {
      // Ignore transient theme save failure
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      setChatError('Attachment must be smaller than 4MB.');
      return;
    }

    setChatError(null);
    const isBinaryMedia =
      file.type.startsWith('image/') || file.type === 'application/pdf';

    if (isBinaryMedia) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        setAttachment({
          name: file.name,
          mimeType: file.type,
          dataBase64: base64,
        });
      };
      reader.readAsDataURL(file);
    } else {
      const text = await file.text();
      setAttachment({
        name: file.name,
        mimeType: file.type || 'text/plain',
        textContent: text.slice(0, 120000),
      });
    }
  };

  const toggleVoiceInput = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const win = window as unknown as {
      SpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
      webkitSpeechRecognition?: new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onerror: () => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      };
    };

    const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setChatError('Voice input is not supported in this browser. Try Chrome or Edge.');
      return;
    }

    const recognition = new RecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) {
        setInput((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setChatError(null);
    setIsListening(true);
    recognition.start();
  };

  const sendMessage = async (
    overrideText?: string,
    overrideAttachment?: AttachmentPayload | null,
    editMessageId?: number
  ) => {
    if (isStreaming) return;
    const messageText = (overrideText ?? input).trim();
    const attached = overrideAttachment !== undefined ? overrideAttachment : attachment;

    if (!messageText && !attached) return;

    setChatError(null);
    if (overrideText === undefined) {
      setInput('');
      setAttachment(null);
    }

    let convId = activeConvId;
    try {
      if (!convId) {
        const created = await chatApi.createConversation();
        convId = created.conversation.id;
        setActiveConvId(convId);
        setConversations((prev) => [created.conversation, ...prev]);
      }

      if (editMessageId) {
        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === editMessageId);
          return idx === -1 ? prev : prev.slice(0, idx);
        });
        setEditingMsgId(null);
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsStreaming(true);
      setStreamingText('');

      await chatApi.sendMessageStream(
        convId,
        {
          content: messageText,
          attachment: attached ?? undefined,
          editMessageId,
        },
        {
          onUserMessage: (savedUserMsg) => {
            setMessages((prev) => [...prev, savedUserMsg]);
          },
          onConversation: (updatedConv) => {
            setConversations((prev) => {
              const filtered = prev.filter((c) => c.id !== updatedConv.id);
              return [updatedConv, ...filtered];
            });
          },
          onChunk: (delta) => {
            setStreamingText((prev) => prev + delta);
          },
          onDone: (assistantMsg) => {
            setStreamingText('');
            setMessages((prev) => [...prev, assistantMsg]);
            void loadConversations(searchQuery);
          },
          onError: (errMsg) => {
            setStreamingText('');
            setChatError(errMsg);
          },
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setChatError(err instanceof Error ? err.message : 'Unable to send message.');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleRegenerate = async () => {
    if (!activeConvId || isStreaming) return;
    setChatError(null);

    // Optimistically remove trailing assistant message while regenerating
    setMessages((prev) => {
      const lastUserIdx = [...prev].reverse().findIndex((m) => m.role === 'user');
      if (lastUserIdx === -1) return prev;
      const cutoff = prev.length - lastUserIdx;
      return prev.slice(0, cutoff);
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);
    setStreamingText('');

    try {
      await chatApi.regenerateStream(
        activeConvId,
        {
          onChunk: (delta) => setStreamingText((prev) => prev + delta),
          onDone: (assistantMsg) => {
            setStreamingText('');
            setMessages((prev) => [...prev, assistantMsg]);
            void loadConversations(searchQuery);
          },
          onError: (errMsg) => {
            setStreamingText('');
            setChatError(errMsg);
          },
        },
        controller.signal
      );
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setChatError(err instanceof Error ? err.message : 'Unable to regenerate response.');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleRenameSubmit = async (convId: number) => {
    const trimmed = renamingTitle.trim();
    setRenamingConvId(null);
    if (!trimmed) return;
    try {
      const res = await chatApi.renameConversation(convId, trimmed);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: res.conversation.title } : c))
      );
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to rename conversation.');
    }
  };

  const handleDeleteConversation = async (convId: number) => {
    try {
      await chatApi.deleteConversation(convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Failed to delete conversation.');
    }
  };

  const handleCopyMessage = async (msgId: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMsgId(msgId);
      setTimeout(() => setCopiedMsgId(null), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handlePromptCard = (card: SuggestedPrompt) => {
    if (card.action === 'attach') {
      fileInputRef.current?.click();
      return;
    }
    void sendMessage(card.prompt, null);
  };

  const initials =
    user?.full_name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U';

  const latestAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i].id;
    }
    return null;
  }, [messages]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAF9FE] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[276px] flex-col border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-100 dark:border-slate-800">
          <NovaLogo />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="lg:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-3 space-y-2.5">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Chat</span>
          </button>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/70 py-2 pl-9 pr-3 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
            />
          </div>
        </div>

        {/* Conversation History */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
          {convsLoading ? (
            <div className="space-y-2 pt-2">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-9 rounded-xl bg-slate-100 dark:bg-slate-800/70 animate-pulse"
                />
              ))}
            </div>
          ) : groupedConversations.length === 0 ? (
            <div className="px-2 py-8 text-center">
              <MessageSquare className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {searchQuery ? 'No matching conversations.' : 'Your conversations will appear here.'}
              </p>
            </div>
          ) : (
            groupedConversations.map((group) => (
              <div key={group.label} className="space-y-1">
                <p className="px-2.5 text-[11px] font-semibold tracking-wide text-slate-400 dark:text-slate-500">
                  {group.label}
                </p>
                {group.items.map((conv) => {
                  const isActive = conv.id === activeConvId;
                  const isRenaming = renamingConvId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      className={`group flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm transition-colors ${
                        isActive
                          ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-200 font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      {isRenaming ? (
                        <input
                          type="text"
                          autoFocus
                          value={renamingTitle}
                          onChange={(e) => setRenamingTitle(e.target.value)}
                          onBlur={() => void handleRenameSubmit(conv.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleRenameSubmit(conv.id);
                            if (e.key === 'Escape') setRenamingConvId(null);
                          }}
                          className="w-full rounded-md border border-indigo-400 bg-white dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-900 dark:text-white focus:outline-none"
                        />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => void selectConversation(conv.id)}
                            className="flex-1 truncate text-left text-[13px] cursor-pointer"
                            title={conv.title}
                          >
                            {conv.title}
                          </button>

                          <div
                            className={`flex items-center gap-0.5 shrink-0 ${
                              isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                            } transition-opacity`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingConvId(conv.id);
                                setRenamingTitle(conv.title);
                              }}
                              aria-label="Rename conversation"
                              className="rounded-md p-1 text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteConversation(conv.id)}
                              aria-label="Delete conversation"
                              className="rounded-md p-1 text-slate-400 hover:bg-white dark:hover:bg-slate-700 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* User Profile Footer */}
        <div className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-2">
          <div className="flex items-center gap-3 px-1.5 py-1">
            <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center">
              {user?.profile_image ? (
                <img
                  src={user.profile_image}
                  alt={user.full_name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="font-display text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  {initials}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                {user?.full_name}
              </p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Viewport */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top Workspace Header */}
        <header className="flex items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              className="lg:hidden rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="truncate font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
              {activeConversation ? activeConversation.title : 'New Conversation'}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeConversation && messages.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => exportConversationAsTxt(activeConversation, messages)}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>TXT</span>
                </button>
                <button
                  type="button"
                  onClick={() => exportConversationAsPdf(activeConversation, messages)}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>PDF</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => void toggleTheme()}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Scrollable Message Area */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
          <div className="mx-auto max-w-3xl">
            {msgsLoading ? (
              <div className="space-y-4 py-8">
                <div className="ml-auto h-14 w-2/3 rounded-2xl bg-indigo-100/60 dark:bg-indigo-950/40 animate-pulse" />
                <div className="h-28 w-5/6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 animate-pulse" />
              </div>
            ) : messages.length === 0 && !isStreaming ? (
              <div className="py-10 sm:py-16 space-y-10">
                <div className="text-center space-y-3">
                  <div className="mx-auto inline-flex rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-xs">
                    <NovaLogo showText={false} />
                  </div>
                  <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white text-balance">
                    Hello! How can I help you today?
                  </h2>
                  <p className="mx-auto max-w-md text-sm text-slate-500 dark:text-slate-400">
                    Ask a question, upload a document or image for analysis, or start from a prompt
                    below.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {SUGGESTED_PROMPTS.map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => handlePromptCard(item)}
                      className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-left hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-xs transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-lg bg-indigo-50 dark:bg-indigo-950/70 p-2">
                          {item.icon}
                        </span>
                        <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                          {item.title}
                        </span>
                      </div>
                      <p className="mt-2.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                        {item.subtitle}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6 pb-4">
                {messages.map((msg) => {
                  const isUser = msg.role === 'user';
                  const isEditingThis = editingMsgId === msg.id;

                  if (isUser) {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="group max-w-[85%] space-y-1.5">
                          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 px-4 py-3 text-[15px] leading-relaxed text-white shadow-xs">
                            {msg.attachment_name && (
                              <div className="mb-2 inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium text-white">
                                <FileText className="h-3.5 w-3.5" />
                                <span>{msg.attachment_name}</span>
                              </div>
                            )}
                            {isEditingThis ? (
                              <div className="space-y-2.5 min-w-[260px]">
                                <textarea
                                  rows={3}
                                  value={editingMsgText}
                                  onChange={(e) => setEditingMsgText(e.target.value)}
                                  className="w-full rounded-xl bg-white/15 p-2.5 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-white/40"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingMsgId(null)}
                                    className="rounded-lg bg-white/15 px-3 py-1 text-xs font-medium text-white hover:bg-white/25"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void sendMessage(editingMsgText, null, msg.id)}
                                    className="rounded-lg bg-white px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                                  >
                                    Save & Resend
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            )}
                          </div>

                          {!isEditingThis && !isStreaming && (
                            <div className="flex items-center justify-end gap-2 px-1 text-[11px] text-slate-400 dark:text-slate-500">
                              <span className="tabular-nums">{formatTime(msg.created_at)}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingMsgId(msg.id);
                                  setEditingMsgText(msg.content);
                                }}
                                className="opacity-0 group-hover:opacity-100 focus:opacity-100 inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-opacity cursor-pointer"
                              >
                                <Edit2 className="h-3 w-3" />
                                <span>Edit</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className="flex items-start gap-3">
                      <div className="mt-1 hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                        <NovaLogo showText={false} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-5 py-4 shadow-2xs">
                          <MarkdownRenderer content={msg.content} />
                        </div>

                        <div className="flex flex-wrap items-center gap-3 px-1 text-xs text-slate-500 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={() => void handleCopyMessage(msg.id, msg.content)}
                            className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                          >
                            {copiedMsgId === msg.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          {msg.id === latestAssistantId && !isStreaming && (
                            <button
                              type="button"
                              onClick={() => void handleRegenerate()}
                              className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              <span>Regenerate</span>
                            </button>
                          )}

                          <span className="ml-auto tabular-nums text-[11px] text-slate-400 dark:text-slate-500">
                            {formatTime(msg.created_at)}
                            {msg.token_usage ? ` · ${msg.token_usage} tokens` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Active Streaming Assistant Bubble */}
                {isStreaming && (
                  <div className="flex items-start gap-3">
                    <div className="mt-1 hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                      <NovaLogo showText={false} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-800/70 bg-white dark:bg-slate-900 px-5 py-4 shadow-2xs">
                        {streamingText ? (
                          <MarkdownRenderer content={streamingText} />
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <span className="inline-flex gap-1">
                              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.2s]" />
                              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.1s]" />
                              <span className="h-2 w-2 rounded-full bg-indigo-500 animate-bounce" />
                            </span>
                            <span>NOVA AI is thinking...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {chatError && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
                <span>{chatError}</span>
                <button
                  type="button"
                  onClick={() => setChatError(null)}
                  className="text-rose-500 hover:text-rose-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Composer Area */}
        <div className="border-t border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 sm:px-6 py-4">
          <div className="mx-auto max-w-3xl">
            {attachment && (
              <div className="mb-2.5 flex items-center justify-between rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/70 dark:bg-indigo-950/40 px-3.5 py-2 text-xs">
                <div className="flex items-center gap-2 truncate text-indigo-800 dark:text-indigo-200">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate font-medium">{attachment.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachment(null)}
                  aria-label="Remove attachment"
                  className="rounded-md p-1 text-indigo-600 hover:bg-indigo-100 dark:text-indigo-300 dark:hover:bg-indigo-900"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-end gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 shadow-xs focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/15">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.csv,.json,.py,.ts,.tsx,.js,.jsx,.html,.css,.sql,.pdf,image/png,image/jpeg,image/webp"
                onChange={handleFileSelect}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming}
                title="Attach document or image"
                aria-label="Attach document or image"
                className="rounded-xl p-2.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder="Message NOVA AI..."
                className="max-h-[180px] flex-1 resize-none bg-transparent py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />

              <button
                type="button"
                onClick={toggleVoiceInput}
                disabled={isStreaming}
                title={isListening ? 'Stop voice input' : 'Voice input'}
                aria-label={isListening ? 'Stop voice input' : 'Voice input'}
                className={`rounded-xl p-2.5 transition-colors cursor-pointer ${
                  isListening
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              {isStreaming ? (
                <button
                  type="button"
                  onClick={() => abortControllerRef.current?.abort()}
                  title="Stop generating"
                  aria-label="Stop generating"
                  className="rounded-xl bg-slate-900 dark:bg-white p-2.5 text-white dark:text-slate-900 hover:opacity-90 transition-opacity cursor-pointer"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() && !attachment}
                  title="Send message"
                  aria-label="Send message"
                  className="rounded-xl bg-indigo-600 p-2.5 text-white hover:bg-indigo-700 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 transition-colors cursor-pointer"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              )}
            </div>

            <p className="mt-2 text-center text-[11px] text-slate-400 dark:text-slate-500">
              NOVA AI can make mistakes. Verify important technical or factual outputs.
            </p>
          </div>
        </div>
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onHistoryCleared={() => {
          setConversations([]);
          setActiveConvId(null);
          setMessages([]);
        }}
      />
    </div>
  );
};
