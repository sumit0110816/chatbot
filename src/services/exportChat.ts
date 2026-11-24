import { jsPDF } from 'jspdf';
import type { Conversation, Message } from '../types';

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'conversation';
}

export function exportConversationAsTxt(conversation: Conversation, messages: Message[]): void {
  const header = [
    `NOVA AI — Conversation Export`,
    `Title: ${conversation.title}`,
    `Exported: ${new Date().toLocaleString()}`,
    '='.repeat(60),
    '',
  ];

  const body = messages.map((m) => {
    const roleLabel = m.role === 'user' ? 'You' : 'NOVA AI';
    const timestamp = new Date(m.created_at).toLocaleString();
    const attachmentLine = m.attachment_name ? `[Attachment: ${m.attachment_name}]\n` : '';
    return `[${roleLabel} — ${timestamp}]\n${attachmentLine}${m.content}\n`;
  });

  const blob = new Blob([[...header, ...body].join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(conversation.title)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportConversationAsPdf(conversation: Conversation, messages: Message[]): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 52;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 48) {
      doc.addPage();
      y = 52;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('NOVA AI — Conversation Transcript', margin, y);
  y += 22;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Title: ${conversation.title}`, margin, y);
  y += 14;
  doc.text(`Exported: ${new Date().toLocaleString()}`, margin, y);
  y += 16;

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  for (const msg of messages) {
    ensureSpace(40);
    const roleLabel = msg.role === 'user' ? 'You' : 'NOVA AI';
    const timeLabel = new Date(msg.created_at).toLocaleString();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(msg.role === 'user' ? 79 : 15, msg.role === 'user' ? 70 : 23, msg.role === 'user' ? 229 : 42);
    doc.text(`${roleLabel}  ·  ${timeLabel}`, margin, y);
    y += 16;

    if (msg.attachment_name) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Attached: ${msg.attachment_name}`, margin, y);
      y += 14;
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.setTextColor(30, 41, 59);
    const lines = doc.splitTextToSize(msg.content, maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(16);
      doc.text(line, margin, y);
      y += 14;
    }
    y += 12;
  }

  doc.save(`${sanitizeFilename(conversation.title)}.pdf`);
}
