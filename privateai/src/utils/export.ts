import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Message, Conversation } from '../types';

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function conversationToText(conversation: Conversation, messages: Message[]): string {
  const lines: string[] = [
    `# ${conversation.title}`,
    `Model: ${conversation.modelId}`,
    `Created: ${formatTimestamp(conversation.createdAt)}`,
    `Exported: ${formatTimestamp(Date.now())}`,
    '',
    '---',
    '',
  ];

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'PrivateAI' : 'System';
    lines.push(`[${role}] (${formatTimestamp(msg.createdAt)})`);
    lines.push(msg.content);
    lines.push('');
  }

  lines.push('---');
  lines.push('Exported from PrivateAI — Your AI. Your device. Your data.');

  return lines.join('\n');
}

export async function exportConversation(conversation: Conversation, messages: Message[]): Promise<void> {
  const text = conversationToText(conversation, messages);
  const safeName = conversation.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  const filename = `privateai_${safeName}_${Date.now()}.txt`;

  const file = new File(Paths.cache, filename);
  file.create();
  file.write(text);

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/plain',
      dialogTitle: 'Export Conversation',
    });
  }
}

export function conversationToMarkdown(conversation: Conversation, messages: Message[]): string {
  const lines: string[] = [
    `# ${conversation.title}`,
    '',
    `> Model: \`${conversation.modelId}\` | Created: ${formatTimestamp(conversation.createdAt)}`,
    '',
  ];

  for (const msg of messages) {
    if (msg.role === 'user') {
      lines.push(`### You`);
    } else if (msg.role === 'assistant') {
      lines.push(`### PrivateAI`);
    } else {
      lines.push(`### System`);
    }
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  }

  lines.push('---');
  lines.push('*Exported from PrivateAI*');

  return lines.join('\n');
}

export async function exportConversationAsMarkdown(conversation: Conversation, messages: Message[]): Promise<void> {
  const text = conversationToMarkdown(conversation, messages);
  const safeName = conversation.title.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 40);
  const filename = `privateai_${safeName}_${Date.now()}.md`;

  const file = new File(Paths.cache, filename);
  file.create();
  file.write(text);

  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/markdown',
      dialogTitle: 'Export Conversation',
    });
  }
}
