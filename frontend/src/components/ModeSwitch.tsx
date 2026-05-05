import type { ChatMode } from '../types'

interface ModeSwitchProps {
  mode: ChatMode
  onChange: (mode: ChatMode) => void
  disabled?: boolean
}

const modes: { value: ChatMode; label: string; shortLabel: string }[] = [
  { value: 'chat', label: 'DeepSeek快速对话', shortLabel: '快速' },
  { value: 'reasoning', label: 'DeepSeek深度推理', shortLabel: '深度' },
]

export default function ModeSwitch({ mode, onChange, disabled = false }: ModeSwitchProps) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-800/50 backdrop-blur-sm">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          disabled={disabled}
          className={`
            flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
            ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
            ${
              mode === m.value
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/25'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/60'
            }
          `}
        >
          <span className="hidden sm:inline">{m.label}</span>
          <span className="sm:hidden">{m.shortLabel}</span>
        </button>
      ))}
    </div>
  )
}
