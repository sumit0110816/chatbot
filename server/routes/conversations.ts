import { Router, type Response } from 'express';
import { getAIProvider, type AttachmentPayload, type ChatTurn } from '../ai/provider.ts';
import { db, withTransaction } from '../db.ts';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';

const router = Router();
router.use(requireAuth);

const chatLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 40,
  message: 'Message rate limit reached. Please wait a moment before sending more messages.',
});

interface ConversationRow {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachment_name: string | null;
  attachment_mime: string | null;
  token_usage: number | null;
  created_at: string;
}

function getOwnedConversation(conversationId: number, userId: number): ConversationRow | null {
  if (!Number.isInteger(conversationId) || conversationId <= 0) return null;
  const row = db
    .prepare('SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE id = ? AND user_id = ?')
    .get(conversationId, userId) as ConversationRow | undefined;
  return row ?? null;
}

function buildSystemInstruction(userId: number): string {
  const settings = db
    .prepare('SELECT language, response_preferences FROM user_settings WHERE user_id = ?')
    .get(userId) as { language: string; response_preferences: string } | undefined;

  const language = settings?.language || 'English';
  const prefs = settings?.response_preferences || 'Balanced, clear, and well-structured';

  return [
    'You are NOVA AI, an intelligent, thoughtful, and reliable AI assistant.',
    `Preferred response language: ${language}.`,
    `User response style preference: ${prefs}.`,
    'Format answers cleanly using Markdown when helpful, including fenced code blocks with language tags for code.',
  ].join(' ');
}

function deriveTitleFromPrompt(prompt: string, attachmentName?: string): string {
  const base = prompt.trim() || (attachmentName ? `Analysis: ${attachmentName}` : 'New Conversation');
  const singleLine = base.replace(/\s+/g, ' ');
  return singleLine.length > 52 ? `${singleLine.slice(0, 49).trim()}...` : singleLine;
}

function writeSseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function formatGeminiError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes('GEMINI_API_KEY')) {
    return 'Gemini API key is not configured. Please set GEMINI_API_KEY in Settings > Secrets.';
  }
  if (message.includes('PERMISSION_DENIED') || message.includes('API_KEY_INVALID') || message.includes('403') || message.includes('400')) {
    return 'Gemini API rejected the request. Please verify your GEMINI_API_KEY in Settings > Secrets.';
  }
  if (message.includes('RESOURCE_EXHAUSTED') || message.includes('429')) {
    return 'Gemini API rate limit or quota exceeded. Please try again shortly or check your API billing tier.';
  }
  if (message.includes('NOT_FOUND') || message.includes('404')) {
    return 'Configured Gemini model was not found. Please verify model configuration.';
  }
  return message || 'Failed to generate AI response.';
}

router.get('/', (req: AuthenticatedRequest, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const userId = req.user!.id;

  let rows: Array<ConversationRow & { message_count: number; last_message: string | null }>;

  if (q) {
    const pattern = `%${q}%`;
    rows = db
      .prepare(
        `SELECT DISTINCT c.id, c.user_id, c.title, c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM messages m2 WHERE m2.conversation_id = c.id) AS message_count,
                (SELECT content FROM messages m3 WHERE m3.conversation_id = c.id ORDER BY m3.created_at DESC, m3.id DESC LIMIT 1) AS last_message
         FROM conversations c
         LEFT JOIN messages m ON m.conversation_id = c.id
         WHERE c.user_id = ? AND (c.title LIKE ? OR m.content LIKE ?)
         ORDER BY c.updated_at DESC, c.id DESC`
      )
      .all(userId, pattern, pattern) as unknown as Array<
      ConversationRow & { message_count: number; last_message: string | null }
    >;
  } else {
    rows = db
      .prepare(
        `SELECT c.id, c.user_id, c.title, c.created_at, c.updated_at,
                (SELECT COUNT(*) FROM messages m2 WHERE m2.conversation_id = c.id) AS message_count,
                (SELECT content FROM messages m3 WHERE m3.conversation_id = c.id ORDER BY m3.created_at DESC, m3.id DESC LIMIT 1) AS last_message
         FROM conversations c
         WHERE c.user_id = ?
         ORDER BY c.updated_at DESC, c.id DESC`
      )
      .all(userId) as unknown as Array<
      ConversationRow & { message_count: number; last_message: string | null }
    >;
  }

  res.json({ conversations: rows });
});

router.post('/', (req: AuthenticatedRequest, res) => {
  const rawTitle = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const title = rawTitle ? rawTitle.slice(0, 120) : 'New Conversation';
  const now = new Date().toISOString();

  const result = db
    .prepare(
      'INSERT INTO conversations (user_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    )
    .run(req.user!.id, title, now, now);

  const conversation = db
    .prepare('SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE id = ?')
    .get(Number(result.lastInsertRowid));

  res.status(201).json({ conversation });
});

router.delete('/', (req: AuthenticatedRequest, res) => {
  db.prepare('DELETE FROM conversations WHERE user_id = ?').run(req.user!.id);
  res.json({ ok: true, message: 'All conversations cleared.' });
});

router.get('/:id', (req: AuthenticatedRequest, res) => {
  const convId = Number(req.params.id);
  const conversation = getOwnedConversation(convId, req.user!.id);
  if (!conversation) {
    res.status(404).json({ detail: 'Conversation not found.' });
    return;
  }

  const messages = db
    .prepare(
      `SELECT id, conversation_id, role, content, attachment_name, attachment_mime, token_usage, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(convId);

  res.json({ conversation, messages });
});

router.patch('/:id', (req: AuthenticatedRequest, res) => {
  const convId = Number(req.params.id);
  const conversation = getOwnedConversation(convId, req.user!.id);
  if (!conversation) {
    res.status(404).json({ detail: 'Conversation not found.' });
    return;
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  if (!title) {
    res.status(400).json({ detail: 'Conversation title cannot be empty.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?').run(
    title.slice(0, 120),
    now,
    convId,
    req.user!.id
  );

  const updated = getOwnedConversation(convId, req.user!.id);
  res.json({ conversation: updated });
});

router.delete('/:id', (req: AuthenticatedRequest, res) => {
  const convId = Number(req.params.id);
  const conversation = getOwnedConversation(convId, req.user!.id);
  if (!conversation) {
    res.status(404).json({ detail: 'Conversation not found.' });
    return;
  }

  db.prepare('DELETE FROM conversations WHERE id = ? AND user_id = ?').run(convId, req.user!.id);
  res.json({ ok: true });
});

router.get('/:id/messages', (req: AuthenticatedRequest, res) => {
  const convId = Number(req.params.id);
  const conversation = getOwnedConversation(convId, req.user!.id);
  if (!conversation) {
    res.status(404).json({ detail: 'Conversation not found.' });
    return;
  }

  const messages = db
    .prepare(
      `SELECT id, conversation_id, role, content, attachment_name, attachment_mime, token_usage, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(convId);

  res.json({ messages });
});

router.post('/:id/messages', chatLimiter, async (req: AuthenticatedRequest, res) => {
  const convId = Number(req.params.id);
  const conversation = getOwnedConversation(convId, req.user!.id);
  if (!conversation) {
    res.status(404).json({ detail: 'Conversation not found.' });
    return;
  }

  const { content, attachment, editMessageId } = req.body ?? {};
  const textContent = typeof content === 'string' ? content.trim() : '';

  const validAttachment: AttachmentPayload | undefined =
    attachment && typeof attachment.name === 'string' && typeof attachment.mimeType === 'string'
      ? {
          name: attachment.name.slice(0, 200),
          mimeType: attachment.mimeType,
          dataBase64: typeof attachment.dataBase64 === 'string' ? attachment.dataBase64 : undefined,
          textContent:
            typeof attachment.textContent === 'string'
              ? attachment.textContent.slice(0, 120000)
              : undefined,
        }
      : undefined;

  if (!textContent && !validAttachment) {
    res.status(400).json({ detail: 'Message content or an attachment is required.' });
    return;
  }

  const now = new Date().toISOString();
  const displayContent =
    textContent || `Analyze attached document: ${validAttachment?.name ?? 'Attachment'}`;

  let userMessage: MessageRow;
  let updatedConversation: ConversationRow;
  let priorHistory: ChatTurn[];

  try {
    const persisted = withTransaction(() => {
      if (editMessageId && Number.isInteger(Number(editMessageId))) {
        const targetId = Number(editMessageId);
        const existingTarget = db
          .prepare('SELECT id, role FROM messages WHERE id = ? AND conversation_id = ?')
          .get(targetId, convId) as { id: number; role: string } | undefined;

        if (!existingTarget || existingTarget.role !== 'user') {
          throw new Error('EDIT_TARGET_INVALID');
        }

        // Remove the edited message and any subsequent messages so the branch regenerates cleanly
        db.prepare('DELETE FROM messages WHERE conversation_id = ? AND id >= ?').run(convId, targetId);
      }

      const historyRows = db
        .prepare(
          `SELECT role, content FROM messages
           WHERE conversation_id = ?
           ORDER BY created_at ASC, id ASC`
        )
        .all(convId) as unknown as ChatTurn[];

      const insertMsg = db
        .prepare(
          `INSERT INTO messages (conversation_id, role, content, attachment_name, attachment_mime, created_at)
           VALUES (?, 'user', ?, ?, ?, ?)`
        )
        .run(
          convId,
          displayContent,
          validAttachment?.name ?? null,
          validAttachment?.mimeType ?? null,
          now
        );

      const msgId = Number(insertMsg.lastInsertRowid);
      const savedMsg = db
        .prepare(
          'SELECT id, conversation_id, role, content, attachment_name, attachment_mime, token_usage, created_at FROM messages WHERE id = ?'
        )
        .get(msgId) as unknown as MessageRow;

      let nextTitle = conversation.title;
      if (conversation.title === 'New Conversation' && historyRows.length === 0) {
        nextTitle = deriveTitleFromPrompt(displayContent, validAttachment?.name);
      }

      db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(
        nextTitle,
        now,
        convId
      );

      const savedConv = db
        .prepare('SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE id = ?')
        .get(convId) as unknown as ConversationRow;

      return { savedMsg, savedConv, historyRows };
    });

    userMessage = persisted.savedMsg;
    updatedConversation = persisted.savedConv;
    priorHistory = persisted.historyRows;
  } catch (err) {
    if (err instanceof Error && err.message === 'EDIT_TARGET_INVALID') {
      res.status(400).json({ detail: 'Only existing user messages can be edited.' });
      return;
    }
    throw err;
  }

  // Stream response via Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  writeSseEvent(res, 'user_message', userMessage);
  writeSseEvent(res, 'conversation', updatedConversation);

  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  try {
    const provider = getAIProvider();
    const systemInstruction = buildSystemInstruction(req.user!.id);

    const { fullText, tokenUsage } = await provider.streamChat({
      history: priorHistory,
      userMessage: displayContent,
      attachment: validAttachment,
      systemInstruction,
      signal: abortController.signal,
      onChunk: (chunkText) => {
        writeSseEvent(res, 'chunk', { text: chunkText });
      },
    });

    const finalText = fullText.trim();
    if (!finalText) {
      writeSseEvent(res, 'error', { error: 'The model returned an empty response.' });
      res.end();
      return;
    }

    const assistantNow = new Date().toISOString();
    const assistantMsg = withTransaction(() => {
      const insertAssistant = db
        .prepare(
          `INSERT INTO messages (conversation_id, role, content, token_usage, created_at)
           VALUES (?, 'assistant', ?, ?, ?)`
        )
        .run(convId, finalText, tokenUsage, assistantNow);

      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(assistantNow, convId);

      return db
        .prepare(
          'SELECT id, conversation_id, role, content, attachment_name, attachment_mime, token_usage, created_at FROM messages WHERE id = ?'
        )
        .get(Number(insertAssistant.lastInsertRowid));
    });

    writeSseEvent(res, 'done', { message: assistantMsg });
    res.end();
  } catch (err) {
    console.error('Gemini streaming error:', err);
    writeSseEvent(res, 'error', { error: formatGeminiError(err) });
    res.end();
  }
});

router.post('/:id/regenerate', chatLimiter, async (req: AuthenticatedRequest, res) => {
  const convId = Number(req.params.id);
  const conversation = getOwnedConversation(convId, req.user!.id);
  if (!conversation) {
    res.status(404).json({ detail: 'Conversation not found.' });
    return;
  }

  const messages = db
    .prepare(
      `SELECT id, conversation_id, role, content, attachment_name, attachment_mime, token_usage, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at ASC, id ASC`
    )
    .all(convId) as unknown as MessageRow[];

  if (messages.length === 0) {
    res.status(400).json({ detail: 'Cannot regenerate an empty conversation.' });
    return;
  }

  // Find the last user message
  let lastUserIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUserIdx = i;
      break;
    }
  }

  if (lastUserIdx === -1) {
    res.status(400).json({ detail: 'No user prompt found to regenerate from.' });
    return;
  }

  const lastUserMessage = messages[lastUserIdx];
  const priorHistory: ChatTurn[] = messages.slice(0, lastUserIdx).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Remove any assistant responses after that user message
  db.prepare('DELETE FROM messages WHERE conversation_id = ? AND id > ?').run(
    convId,
    lastUserMessage.id
  );

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  try {
    const provider = getAIProvider();
    const systemInstruction = buildSystemInstruction(req.user!.id);

    const { fullText, tokenUsage } = await provider.streamChat({
      history: priorHistory,
      userMessage: lastUserMessage.content,
      systemInstruction,
      signal: abortController.signal,
      onChunk: (chunkText) => {
        writeSseEvent(res, 'chunk', { text: chunkText });
      },
    });

    const finalText = fullText.trim();
    if (!finalText) {
      writeSseEvent(res, 'error', { error: 'The model returned an empty response.' });
      res.end();
      return;
    }

    const assistantNow = new Date().toISOString();
    const assistantMsg = withTransaction(() => {
      const insertAssistant = db
        .prepare(
          `INSERT INTO messages (conversation_id, role, content, token_usage, created_at)
           VALUES (?, 'assistant', ?, ?, ?)`
        )
        .run(convId, finalText, tokenUsage, assistantNow);

      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(assistantNow, convId);

      return db
        .prepare(
          'SELECT id, conversation_id, role, content, attachment_name, attachment_mime, token_usage, created_at FROM messages WHERE id = ?'
        )
        .get(Number(insertAssistant.lastInsertRowid));
    });

    writeSseEvent(res, 'done', { message: assistantMsg });
    res.end();
  } catch (err) {
    console.error('Gemini regenerate error:', err);
    writeSseEvent(res, 'error', { error: formatGeminiError(err) });
    res.end();
  }
});

export default router;
