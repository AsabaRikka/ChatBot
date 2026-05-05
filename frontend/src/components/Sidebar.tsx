import type { Conversation } from '../types'

interface SidebarProps {
  conversations: Conversation[]
  currentId: string | null
  isOpen: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onClose: () => void
}

export default function Sidebar({
  conversations,
  currentId,
  isOpen,
  onSelect,
  onDelete,
  onNew,
  onClose,
}: SidebarProps) {
  const sidebarContent = (
    <div className="flex flex-col h-full bg-[var(--color-bg-sidebar)]">
      {/* 头部 */}
      <div className="p-4 border-b border-gray-700/50">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-600/50 hover:border-gray-500/50 hover:bg-gray-700/30 text-gray-200 text-sm transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新对话
        </button>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <p className="text-gray-600 text-sm text-center mt-8">暂无对话</p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center rounded-lg transition-colors ${
                  currentId === conv.id
                    ? 'bg-gray-700/50 text-gray-100'
                    : 'hover:bg-gray-700/30 text-gray-400'
                }`}
              >
                <button
                  onClick={() => {
                    onSelect(conv.id)
                    onClose()
                  }}
                  className="flex-1 text-left px-3 py-2.5 text-sm truncate"
                >
                  {conv.title}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(conv.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 mr-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  title="删除对话"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <div className="p-3 border-t border-gray-700/50 text-xs text-gray-600 text-center">
        DeepSeek ChatBot
      </div>
    </div>
  )

  return (
    <>
      {/* 桌面端侧边栏 */}
      <div className="hidden md:block w-64 flex-shrink-0 border-r border-gray-700/50 h-full">
        {sidebarContent}
      </div>

      {/* 移动端遮罩层 */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-40" onClick={onClose}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute left-0 top-0 bottom-0 w-72 z-50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  )
}
