// ── 对话 ──
export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

// ── 消息 ──
export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  reasoning_content?: string | null
  created_at: string
}

// ── SSE 流式数据块 ──
export interface StreamChunk {
  type: 'content' | 'reasoning' | 'done' | 'error'
  data: string
}

// ── 聊天模式 ──
export type ChatMode = 'chat' | 'reasoning'
