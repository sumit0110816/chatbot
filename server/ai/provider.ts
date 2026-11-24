import { GoogleGenAI, type Content, type Part } from '@google/genai';

export interface ChatTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AttachmentPayload {
  name: string;
  mimeType: string;
  dataBase64?: string;
  textContent?: string;
}

export interface StreamChatOptions {
  history: ChatTurn[];
  userMessage: string;
  attachment?: AttachmentPayload;
  systemInstruction?: string;
  signal?: AbortSignal;
  onChunk: (text: string) => void;
}

export interface StreamChatResult {
  fullText: string;
  tokenUsage: number | null;
}

export interface AIProvider {
  readonly name: string;
  streamChat(options: StreamChatOptions): Promise<StreamChatResult>;
}

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-4-hydrogen';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      throw new Error(
        'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
      );
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  async streamChat(options: StreamChatOptions): Promise<StreamChatResult> {
    const ai = this.getClient();

    const contents: Content[] = [];
    for (const turn of options.history) {
      if (turn.role === 'system') continue;
      contents.push({
        role: turn.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: turn.content }],
      });
    }

    const userParts: Part[] = [];
    if (options.attachment) {
      if (
        options.attachment.dataBase64 &&
        (options.attachment.mimeType.startsWith('image/') ||
          options.attachment.mimeType === 'application/pdf')
      ) {
        userParts.push({
          inlineData: {
            mimeType: options.attachment.mimeType,
            data: options.attachment.dataBase64,
          },
        });
      }
      if (options.attachment.textContent) {
        userParts.push({
          text: `Attached document (${options.attachment.name}):\n\n${options.attachment.textContent}`,
        });
      }
    }

    if (options.userMessage.trim().length > 0) {
      userParts.push({ text: options.userMessage });
    } else if (options.attachment) {
      userParts.push({
        text: `Please analyze and summarize the attached file "${options.attachment.name}".`,
      });
    }

    contents.push({
      role: 'user',
      parts: userParts,
    });

    const stream = await ai.models.generateContentStream({
      model: GEMINI_MODEL,
      contents,
      config: {
        systemInstruction:
          options.systemInstruction ||
          'You are NOVA AI, an intelligent, helpful, and thoughtful AI assistant. Format responses cleanly in Markdown when appropriate.',
      },
    });

    let fullText = '';
    let tokenUsage: number | null = null;

    for await (const chunk of stream) {
      if (options.signal?.aborted) {
        break;
      }
      const chunkText = chunk.text ?? '';
      if (chunkText) {
        fullText += chunkText;
        options.onChunk(chunkText);
      }
      if (chunk.usageMetadata?.totalTokenCount) {
        tokenUsage = chunk.usageMetadata.totalTokenCount;
      }
    }

    return { fullText, tokenUsage };
  }
}

/**
 * Modular provider factory — OpenAI or Ollama providers can be registered here
 * without changing route handlers or database persistence logic.
 */
export function getAIProvider(providerName = process.env.AI_PROVIDER || 'gemini'): AIProvider {
  switch (providerName.toLowerCase()) {
    case 'gemini':
    default:
      return new GeminiProvider();
  }
}
