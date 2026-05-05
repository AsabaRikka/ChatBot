import { useState } from 'react'

interface ThinkingPanelProps {
  content: string
  isStreaming: boolean
}

export default function ThinkingPanel({ content, isStreaming }: ThinkingPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  if (!content && !isStreaming) return null

  return (
    <div className="mb-3 rounded-lg border border-purple-500/30 bg-purple-950/20 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-purple-300 hover:bg-purple-950/30 transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        {isStreaming ? (
          <span className="flex items-center gap-1.5">
            思考中
            <span className="inline-flex gap-1">
              <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </span>
        ) : (
          <span>已深度思考</span>
        )}
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 text-sm text-purple-200/70 italic leading-relaxed whitespace-pre-wrap border-t border-purple-500/20 pt-2.5">
          {content}
          {isStreaming && <span className="inline-block w-1.5 h-4 bg-purple-400 ml-0.5 animate-pulse align-middle" />}
        </div>
      )}
    </div>
  )
}
