import * as SQLite from 'expo-sqlite';
import { Conversation, Message } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('privateai.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      model_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      tokens INTEGER,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, created_at);
  `);
  return db;
}

export async function createConversation(conv: Conversation): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO conversations (id, title, created_at, updated_at, model_id) VALUES (?, ?, ?, ?, ?)',
    [conv.id, conv.title, conv.createdAt, conv.updatedAt, conv.modelId]
  );
}

export async function updateConversationTitle(id: string, title: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?',
    [title, Date.now(), id]
  );
}

export async function deleteConversation(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM conversations WHERE id = ?', [id]);
}

export async function getAllConversations(): Promise<Conversation[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    title: string;
    created_at: number;
    updated_at: number;
    model_id: string;
  }>('SELECT * FROM conversations ORDER BY updated_at DESC');

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    modelId: row.model_id,
  }));
}

export async function addMessage(msg: Message): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO messages (id, conversation_id, role, content, created_at, tokens) VALUES (?, ?, ?, ?, ?, ?)',
    [msg.id, msg.conversationId, msg.role, msg.content, msg.createdAt, msg.tokens ?? null]
  );
  await database.runAsync(
    'UPDATE conversations SET updated_at = ? WHERE id = ?',
    [Date.now(), msg.conversationId]
  );
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    conversation_id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    created_at: number;
    tokens: number | null;
  }>('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [conversationId]);

  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
    tokens: row.tokens ?? undefined,
  }));
}

export async function searchConversations(query: string): Promise<Conversation[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    title: string;
    created_at: number;
    updated_at: number;
    model_id: string;
  }>(
    `SELECT DISTINCT c.* FROM conversations c
     LEFT JOIN messages m ON c.id = m.conversation_id
     WHERE c.title LIKE ? OR m.content LIKE ?
     ORDER BY c.updated_at DESC`,
    [`%${query}%`, `%${query}%`]
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    modelId: row.model_id,
  }));
}

export async function deleteAllData(): Promise<void> {
  const database = await getDatabase();
  await database.execAsync('DELETE FROM messages; DELETE FROM conversations;');
}
