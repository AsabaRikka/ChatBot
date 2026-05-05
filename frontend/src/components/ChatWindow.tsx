import { useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import MessageInput from './MessageInput'
import type { Message } from '../types'

interface ChatWindowProps {
  messages: Message[]
  isStreaming: boolean
  isEmpty: boolean
  onSend: (content: string) => void
}

export default function ChatWindow({ messages, isStreaming, isEmpty, onSend }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (isEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-200 mb-2">开始一段新对话</h2>
          <p className="text-gray-500 text-sm mb-8">
            在下方输入你的问题，AI 将为你解答。支持 Markdown 和代码高亮。
          </p>
        </div>
        <div className="w-full max-w-2xl">
          <MessageInput onSend={onSend} disabled={isStreaming} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto">
          {messages.map((msg, i) => (
            <MessageBubble
              key={msg.id || `msg-${i}`}
              message={msg}
              isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="flex-shrink-0">
        <div className="max-w-3xl mx-auto w-full">
          <MessageInput onSend={onSend} disabled={isStreaming} />
        </div>
      </div>
    </div>
  )
}
