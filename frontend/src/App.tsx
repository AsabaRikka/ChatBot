import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatWindow from './components/ChatWindow'
import Toast from './components/Toast'
import type { Conversation, Message } from './types'

function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleNew = useCallback(() => {
    const conv: Conversation = {
      id: Date.now().toString(),
      title: '新对话',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    setConversations((prev) => [conv, ...prev])
    setCurrentId(conv.id)
    setMessages([])
  }, [])

  const handleSelect = useCallback((id: string) => {
    setCurrentId(id)
    // 后续 Phase4/5 会从后端加载消息
  }, [])

  const handleDelete = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id))
    if (currentId === id) {
      const remaining = conversations.filter((c) => c.id !== id)
      setCurrentId(remaining[0]?.id ?? null)
      setMessages([])
    }
  }, [currentId, conversations])

  const handleSend = useCallback(async (content: string) => {
    // 确保有对话
    let convId = currentId
    if (!convId) {
      convId = Date.now().toString()
      const conv: Conversation = {
        id: convId,
        title: content.slice(0, 30),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setConversations((prev) => [conv, ...prev])
      setCurrentId(convId)
    }

    // 更新标题
    if (messages.length === 0) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, title: content.slice(0, 30) } : c
        )
      )
    }

    // 追加用户消息
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      conversation_id: convId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])

    // 模拟 AI 流式回复
    setIsStreaming(true)
    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      conversation_id: convId,
      role: 'assistant',
      content: '',
      reasoning_content: null,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, assistantMsg])

    // 模拟逐字输出
    const reply = `你好！这是一个**模拟回复**，用于展示 UI 效果。

\`\`\`python
# 示例代码块
def hello():
    print("Hello, ChatBot!")
    return True
\`\`\`

- 支持 Markdown 渲染
- 代码语法高亮
- 表格展示

| 功能 | 状态 |
|------|------|
| 多轮对话 | 进行中 |
| 流式输出 | 模拟中 |
| 推理展示 | 即将支持 |

> 这是引用文本示例

完整功能将在 Phase4 连接后端后上线。`

    let index = 0
    const interval = setInterval(() => {
      if (index < reply.length) {
        setMessages((prev) => {
          const updated = [...prev]
          const last = { ...updated[updated.length - 1], content: reply.slice(0, index + 1) }
          updated[updated.length - 1] = last
          return updated
        })
        index++
      } else {
        clearInterval(interval)
        setIsStreaming(false)
      }
    }, 20)
  }, [currentId, messages.length])

  return (
    <div className="h-screen flex bg-[var(--color-bg-primary)] overflow-hidden">
      <Sidebar
        conversations={conversations}
        currentId={currentId}
        isOpen={sidebarOpen}
        onSelect={handleSelect}
        onDelete={handleDelete}
        onNew={handleNew}
        onClose={() => setSidebarOpen(false)}
      />

      {/* 主区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 移动端顶部导航栏 */}
        <div className="md:hidden flex items-center h-12 px-3 border-b border-gray-700/50 bg-[var(--color-bg-primary)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 text-sm font-medium text-gray-300">
            {conversations.find((c) => c.id === currentId)?.title || 'ChatBot'}
          </span>
        </div>

        <ChatWindow
          messages={messages}
          isStreaming={isStreaming}
          isEmpty={!currentId || messages.length === 0}
          onSend={handleSend}
        />
      </div>

      <Toast />
    </div>
  )
}

export default App
