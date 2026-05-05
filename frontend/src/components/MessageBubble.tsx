import MarkdownRenderer from './MarkdownRenderer'
import ThinkingPanel from './ThinkingPanel'
import type { Message } from '../types'

interface MessageBubbleProps {
  message: Message
  isStreaming: boolean
}

export default function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[80%] md:max-w-[70%] px-4 py-3 rounded-2xl rounded-br-md bg-[var(--color-bubble-user)] text-white shadow-sm">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    )
  }

  const hasReasoning = !!(message.reasoning_content) || (isStreaming && !message.content && message.reasoning_content !== undefined)

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[85%] md:max-w-[75%] w-full">
        <div className="px-4 py-3 rounded-2xl rounded-bl-md bg-[var(--color-bubble-assistant)] border border-gray-700/40 shadow-sm">
          {/* 推理过程面板 */}
          <ThinkingPanel
            content={message.reasoning_content || ''}
            isStreaming={isStreaming && !message.content}
          />

          {/* AI 回复内容 */}
          {(message.content || (isStreaming && message.reasoning_content)) && (
            <MarkdownRenderer content={message.content} />
          )}

          {/* 流式输出光标 */}
          {isStreaming && message.content && (
            <span className="inline-block w-2 h-4 bg-blue-400 ml-0.5 animate-pulse align-middle rounded-sm" />
          )}

          {/* 等待回复 */}
          {isStreaming && !message.content && !message.reasoning_content && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span>思考中</span>
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
