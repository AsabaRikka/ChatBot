# ChatBot 对话系统技术规划

## 一、整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│                         前端 (React + Vite)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌─────────────────┐ │
│  │ 对话列表  │ │ 聊天窗口  │ │ Markdown渲染 │ │ 思考过程面板    │ │
│  │(Sidebar) │ │(ChatWin) │ │(代码高亮)    │ │(ThinkingPanel) │ │
│  └──────────┘ └──────────┘ └──────────────┘ └─────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ 模式切换 (ModeSwitch)                                       ││
│  │ ┌─ DeepSeek快速对话 (deepseek-chat)                        ┐││
│  │ └─ DeepSeek深度推理 (deepseek-reasoner)                    ┘││
│  └──────────────────────────────────────────────────────────────┘│
│         │              │              │               │           │
│         └──────────────┼──────────────┼───────────────┘           │
│                        │ SSE 流式消费                             │
└────────────────────────┼─────────────────────────────────────────┘
                         │ HTTP + SSE
┌────────────────────────┼─────────────────────────────────────────┐
│                        后端 (FastAPI)                             │
│  ┌──────────┐ ┌──────────┐ ┌─────────────────────────────────┐  │
│  │ 路由层    │ │ 对话管理  │ │ LLM 客户端                      │  │
│  │ /chat    │ │ 存储/检索 │ │ ┌─ deepseek-chat (对话模式)    │  │
│  │ /reason  │ │          │ │ └─ deepseek-reasoner (推理模式) │  │
│  └──────────┘ └──────────┘ └─────────────────────────────────┘  │
│         │              │              │                           │
│         └──────────────┼──────────────┘                           │
│                        │                                          │
│              ┌─────────┴─────────┐                                │
│              │   SQLite 数据库    │                                │
│              └───────────────────┘                                │
└──────────────────────────────────────────────────────────────────┘
```

## 二、技术栈选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | 组件化开发，类型安全 |
| 构建工具 | Vite 5 | 极速 HMR，开箱即用 |
| UI 样式 | Tailwind CSS | 原子化 CSS，快速构建 UI |
| 状态管理 | Zustand | 轻量级，适合中型应用 |
| Markdown | react-markdown + rehype-highlight | Markdown 渲染与代码高亮 |
| 后端框架 | FastAPI + Uvicorn | 高性能异步 Python Web 框架 |
| LLM 客户端 | openai (Python SDK) | 兼容 DeepSeek API |
| 数据库 | SQLite + SQLAlchemy | 轻量级，零配置 |
| 数据库迁移 | Alembic | 数据库版本管理 |

## 三、后端实现功能

### 3.1 项目结构
```
backend/
├── main.py                 # FastAPI 入口
├── config.py               # 配置管理（API Key、数据库路径）
├── .env.example            # 环境变量模板
├── models/
│   ├── __init__.py
│   ├── database.py         # SQLAlchemy 引擎 & Session
│   └── conversation.py     # Conversation / Message 数据模型
├── schemas/
│   ├── __init__.py
│   └── chat.py             # Pydantic 请求/响应模型
├── services/
│   ├── __init__.py
│   ├── llm_client.py       # DeepSeek API 封装（对话模式 + 推理模式）
│   └── chat_service.py     # 对话业务逻辑
├── routers/
│   ├── __init__.py
│   └── chat.py             # 全部路由（CRUD + 流式接口）
└── requirements.txt
```

### 3.2 核心 API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/health` | 健康检查 |
| `POST` | `/api/conversations` | 创建新对话 |
| `GET` | `/api/conversations` | 获取对话列表（按更新时间倒序） |
| `GET` | `/api/conversations/{id}` | 获取单个对话详情（含消息历史） |
| `DELETE` | `/api/conversations/{id}` | 删除对话及全部消息 |
| `POST` | `/api/chat/stream` | **对话模式** SSE 流式接口 |
| `POST` | `/api/chat/reasoning` | **推理模式** SSE 流式接口（deepseek-reasoner） |

### 3.3 数据库模型

**Conversation 表：**
- `id` (UUID, PK)
- `title` (String, 自动使用首条消息截取)
- `created_at`, `updated_at` (DateTime)

**Message 表：**
- `id` (UUID, PK)
- `conversation_id` (FK → Conversation, cascade delete)
- `role` (Enum: user / assistant / system)
- `content` (Text)
- `reasoning_content` (Text, nullable, 仅推理模式 assistant 消息有值)
- `created_at` (DateTime)

### 3.4 DeepSeek API 对接关键点
- 使用 OpenAI 兼容 SDK，设置 `base_url="https://api.deepseek.com"`，`api_key` 从环境变量读取
- **对话模式** (`deepseek-chat`)：标准聊天补全，流式输出通过 `stream=True` 开启
- **推理模式** (`deepseek-reasoner`)：返回 `reasoning_content`（思维链）+ `content`（最终回答），两者均为流式
- 后端以 SSE (Server-Sent Events) 格式推送，chunk 按 `type` 字段区分：`content` / `reasoning` / `done`
- 每次请求携带完整历史消息构建多轮对话上下文
- 需处理 token 超限场景：按字符数 / 2 估算 token，超过 64K 时截断早期消息

### 3.5 流式响应实现
```
后端: FastAPI StreamingResponse → yield "data: {...}\n\n"
前端: fetch + ReadableStream 逐块读取 → 实时渲染
```

## 四、前端实现功能

### 4.1 项目结构
```
frontend/
├── src/
│   ├── App.tsx                  # 应用主布局
│   ├── main.tsx                 # 入口
│   ├── api/
│   │   └── chat.ts              # API 请求封装、SSE 流消费
│   ├── stores/
│   │   └── chatStore.ts         # Zustand 状态管理（含模式切换）
│   ├── components/
│   │   ├── Sidebar.tsx          # 侧边栏（对话列表）
│   │   ├── ChatWindow.tsx       # 聊天主窗口
│   │   ├── MessageBubble.tsx    # 单条消息气泡（含思考过程）
│   │   ├── ThinkingPanel.tsx    # 推理过程可折叠面板
│   │   ├── MessageInput.tsx     # 输入框组件
│   │   ├── MarkdownRenderer.tsx # Markdown 渲染组件
│   │   ├── Toast.tsx            # 全局提示组件
│   │   └── ModeSwitch.tsx       # 快速对话/深度推理 模式切换按钮
│   ├── types/
│   │   └── index.ts             # TypeScript 类型定义
│   └── index.css                # Tailwind 入口 + 全局主题
├── index.html
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### 4.2 核心组件职责

**Sidebar（侧边栏）：**
- 展示历史对话列表（按更新时间倒序）
- 「+ 新对话」按钮
- 每项 hover 时出现删除按钮
- 当前对话高亮
- 移动端汉堡菜单呼出

**ChatWindow（聊天窗口）：**
- 消息列表滚动显示，自动 scrollIntoView
- 空状态引导页（Logo + 输入提示）
- 底部固定 MessageInput

**MessageBubble（消息气泡）：**
- user 消息：右对齐、蓝色背景
- assistant 消息：左对齐、灰色背景
- assistant 消息先渲染 ThinkingPanel（若有 reasoningContent），再渲染 MarkdownRenderer
- 流式输出中显示闪烁光标

**ThinkingPanel（推理过程面板）：**
- 可折叠面板，默认展开
- 灰色斜体样式，展示模型的思维链（reasoning_content）
- 顶部「思考中...」闪烁动画
- 推理完成后自动折叠并标记「已深度思考」

**MessageInput（输入框）：**
- textarea 自动调高
- Enter 发送、Shift+Enter 换行
- 圆形发送按钮（纸飞机图标）
- 流式中禁用输入

**MarkdownRenderer：**
- `react-markdown` + `rehype-highlight` + `remark-gfm`
- 代码块显示语言标签和复制按钮
- 表格、任务列表

**Toast：**
- 全局弹窗：成功/错误/警告三种类型
- 3 秒自动消失

**ModeSwitch（模式切换按钮）：**
- 两组标签式切换按钮，位于输入框上方或 ChatWindow 顶部工具栏
- 「DeepSeek快速对话」标签：调用 `/api/chat/stream`，使用 `deepseek-chat` 模型，适合日常问答
- 「DeepSeek深度推理」标签：调用 `/api/chat/reasoning`，使用 `deepseek-reasoner` 模型，适合复杂推理、数学、编程
- 当前选中模式高亮（蓝色边框/背景），未选中模式灰色半透明
- 切换模式时不清空当前对话上下文，仅改变后续请求的 API 端点
- 流式输出中禁用切换（防止中途改模式导致数据错乱）
- 移动端自适应：按钮缩小、文字精简为「快速」/「深度」

### 4.3 流式输出实现
1. 用户发送消息后，立即在消息列表追加一条空的 AI 消息
2. 调用 `/api/chat/stream`，通过 Fetch API 读取 ReadableStream
3. 每收到一个 chunk，追加到 AI 消息的 content 中
4. Zustand store 响应式更新，React 自动重渲染 Markdown
5. 收到 `[DONE]` 标记后完成

### 4.4 状态管理 (Zustand Store)
```
chatStore:
  - conversations: Conversation[]
  - currentId: string | null
  - messages: Message[]
  - isStreaming: boolean
  - mode: 'chat' | 'reasoning'      // 模式切换
  
  actions:
  - createConversation()
  - selectConversation(id)
  - deleteConversation(id)
  - setMode(mode)
  - sendMessage(content)
  - appendStreamChunk(content)      // type='content'
  - appendReasoningChunk(content)   // type='reasoning'
  - finishStreaming()
```

## 五、开发阶段规划

---

### Phase 1: 项目初始化与基础搭建

**目标**：创建前后端项目骨架，完成基础配置，验证接口健康度

#### 一. 初始化步骤（任务 | 文件）

| 序号 | 任务 | 说明 | 交付文件 |
|------|------|------|----------|
| 1 | 创建后端目录结构 | 按架构图建立 `backend/` 下的全部子目录和空 `__init__.py` | `backend/requirements.txt` |
| 2 | 编写 Python 依赖清单 | `fastapi`, `uvicorn`, `sqlalchemy`, `openai`, `python-dotenv` | `backend/requirements.txt` |
| 3 | 安装后端依赖 | 执行 `pip install -r requirements.txt` | (无) |
| 4 | 实现配置管理 | 从 `.env` 读取 `DEEPSEEK_API_KEY`、数据库路径 | `backend/config.py` |
| 5 | 创建 `.env` 模板 | 提供 `.env.example`，包含必需的环境变量名 | `backend/.env.example` |
| 6 | 实现数据库引擎 | SQLAlchemy 引擎工厂 + SessionLocal | `backend/models/database.py` |
| 7 | 定义数据模型 | Conversation 表（UUID, title, timestamps）+ Message 表（UUID, FK, role, content, reasoning_content, created_at） | `backend/models/conversation.py` |
| 8 | 定义 Pydantic Schema | ConversationCreate, ConversationResponse, MessageResponse, ChatRequest, ChatStreamChunk | `backend/schemas/chat.py` |
| 9 | 实现健康检查路由 | `GET /api/health` 返回 `{"status": "ok"}` | `backend/routers/chat.py` |
| 10 | 实现 FastAPI 入口 | 创建 app 实例、注册路由、配置 CORS（允许 localhost:5173） | `backend/main.py` |
| 11 | 启动后端服务 | `uvicorn main:app --reload --port 8000`，验证 `/api/health` 可访问 | (无) |
| 12 | 创建前端项目 | `npm create vite@latest frontend -- --template react-ts` | `frontend/` 脚手架 |
| 13 | 安装前端依赖 | `tailwindcss @tailwindcss/vite zustand react-markdown rehype-highlight remark-gfm` | `frontend/package.json` |
| 14 | 配置 Tailwind CSS | 在 `index.css` 中引入 `@import "tailwindcss"`，配置 Vite 插件 | `frontend/src/index.css`, `frontend/vite.config.ts` |
| 15 | 配置 API 代理 | Vite proxy：`/api` → `http://localhost:8000` | `frontend/vite.config.ts` |
| 16 | 启动前端服务 | `npm run dev`，验证页面可访问 | (无) |

#### 二. 交付物（完整目录结构）

```
ChatBot/
├── backend/
│   ├── main.py                    # FastAPI 入口，CORS 配置
│   ├── config.py                  # 环境变量读取
│   ├── requirements.txt           # Python 依赖清单
│   ├── .env.example               # 环境变量模板
│   ├── models/
│   │   ├── __init__.py
│   │   ├── database.py            # SQLAlchemy 引擎
│   │   └── conversation.py        # 数据模型定义
│   └── schemas/
│       ├── __init__.py
│       └── chat.py                # Pydantic 请求/响应模型
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts             # Vite 配置（含 API 代理）
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                # 占位组件
│       └── index.css              # Tailwind 入口
```

#### 三. 健康度验证

| 检查项 | 方法 | 预期结果 |
|--------|------|----------|
| 后端启动 | `uvicorn main:app --reload --port 8000` | 无报错，监听 8000 端口 |
| 健康检查 | `curl http://localhost:8000/api/health` | `{"status": "ok"}` |
| 前端启动 | `npm run dev` | 无报错，监听 5173 端口 |
| 前端页面 | 浏览器访问 `http://localhost:5173` | 显示 Vite + React 默认页 |
| 跨域代理 | 前端调用 `fetch('/api/health')` | 返回 `{"status": "ok"}` |

---

### Phase 2: 前端开发

**目标**：完成全部前端 UI 组件，含推理过程（Thinking）展示

#### 一. 类型定义

| 任务 | 文件 |
|------|------|
| 定义 `Conversation` 接口：id, title, createdAt, updatedAt | `frontend/src/types/index.ts` |
| 定义 `Message` 接口：id, conversationId, role (user/assistant/system), content, reasoningContent?, createdAt | `frontend/src/types/index.ts` |
| 定义 `StreamChunk` 类型：type ('content'/'reasoning'/'done'/'error'), data: string | `frontend/src/types/index.ts` |

#### 二. 组件开发

| 任务 | 说明 | 文件 |
|------|------|------|
| **MarkdownRenderer** | 封装 react-markdown + rehype-highlight + remark-gfm；代码块显示语言标签与复制按钮；支持表格、任务列表 | `frontend/src/components/MarkdownRenderer.tsx` |
| **ThinkingPanel** | 可折叠面板，展示模型的思考/推理过程（reasoning_content）；默认展开、灰色斜体样式、顶部有「思考中...」动画；思考完成后折叠并标记「已深度思考」 | `frontend/src/components/ThinkingPanel.tsx` |
| **MessageBubble** | user 消息右对齐蓝色背景；assistant 消息左对齐灰色背景，内部先渲染 ThinkingPanel（若有 reasoningContent），再渲染 MarkdownRenderer；流式输出时显示闪烁光标 | `frontend/src/components/MessageBubble.tsx` |
| **MessageInput** | textarea 自动调高；Enter 发送、Shift+Enter 换行；圆形发送按钮（纸飞机图标）；流式中禁用输入 | `frontend/src/components/MessageInput.tsx` |
| **ChatWindow** | 消息列表区域（overflow-y-auto），新消息自动 scrollIntoView；空状态引导页面（Logo + 输入提示）；底部固定 MessageInput | `frontend/src/components/ChatWindow.tsx` |
| **Sidebar** | 顶部「+ 新对话」按钮；对话列表（按 updatedAt 倒序）；每项显示标题 + hover 删除按钮；当前对话高亮；移动端汉堡菜单呼出 | `frontend/src/components/Sidebar.tsx` |
| **Toast** | 全局弹窗提示组件：成功/错误/警告三种类型，3 秒自动消失 | `frontend/src/components/Toast.tsx` |
| **ModeSwitch** | 模式切换按钮组：「DeepSeek快速对话」与「DeepSeek深度推理」两个标签，位于输入框上方；选中高亮、流式中禁用切换 | `frontend/src/components/ModeSwitch.tsx` |

#### 三. 布局设计

| 任务 | 说明 | 文件 |
|------|------|------|
| App 主布局 | Flex 水平布局，左侧 Sidebar（w-64, flex-shrink-0），右侧 ChatWindow（flex-1）；全屏高度 `h-screen` | `frontend/src/App.tsx` |
| 移动端适配 | `md:` 断点：Sidebar 默认隐藏（absolute 浮层），点击汉堡图标显示；ChatWindow 占满全宽 | `frontend/src/App.tsx` |
| 模式切换位置 | ModeSwitch 置于 MessageInput 上方、消息列表下方，作为 ChatWindow 底部固定区域的一部分；空状态页也显示，让用户在发送第一条消息前即可选择模式 | `frontend/src/components/ChatWindow.tsx` |

#### 四. 样式主题

| 任务 | 说明 | 文件 |
|------|------|------|
| 全局主题变量 | CSS 变量定义：`--color-bg-primary`（#1a1a2e 深蓝黑）、`--color-bg-sidebar`（#16213e）、`--color-bubble-user`（#2563eb）、`--color-bubble-assistant`（#1e293b）、`--color-text-primary`（#e2e8f0） | `frontend/src/index.css` |
| Tailwind 主题扩展 | 在 CSS 中通过 `@theme` 扩展颜色变量，统一深色主题风格 | `frontend/src/index.css` |

#### 五. 交付物

| 文件 | 职责 |
|------|------|
| `frontend/src/types/index.ts` | 全部 TypeScript 类型定义 |
| `frontend/src/components/MarkdownRenderer.tsx` | Markdown 渲染（代码高亮、表格、复制按钮） |
| `frontend/src/components/ThinkingPanel.tsx` | 推理过程可折叠面板 |
| `frontend/src/components/MessageBubble.tsx` | 消息气泡组件 |
| `frontend/src/components/MessageInput.tsx` | 输入框组件 |
| `frontend/src/components/ChatWindow.tsx` | 聊天主窗口 |
| `frontend/src/components/Sidebar.tsx` | 对话列表侧边栏 |
| `frontend/src/components/Toast.tsx` | 全局提示组件 |
| `frontend/src/components/ModeSwitch.tsx` | 快速对话/深度推理 模式切换按钮 |
| `frontend/src/App.tsx` | 应用主布局 |
| `frontend/src/index.css` | 全局样式 + Tailwind + 主题变量 |

---

### Phase 3: 后端开发

**目标**：完成数据库层、服务层、API 端点，实现对话 CRUD 与 DeepSeek 对接

#### 一. 数据库层

| 任务 | 说明 | 文件 |
|------|------|------|
| Conversation 数据模型 | SQLAlchemy ORM：`id` (UUID, PK), `title` (String), `created_at`, `updated_at`；relationship → messages (cascade delete) | `backend/models/conversation.py` |
| Message 数据模型 | `id` (UUID, PK), `conversation_id` (FK), `role` (Enum: user/assistant/system), `content` (Text), `reasoning_content` (Text, nullable), `created_at` | `backend/models/conversation.py` |
| 自动建表 | 在 `main.py` 启动时调用 `Base.metadata.create_all(bind=engine)` | `backend/main.py` |

**核心代码清单**：
```python
# backend/models/conversation.py
class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, default="新对话")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    conversation_id = Column(String, ForeignKey("conversations.id"))
    role = Column(String)        # "user" | "assistant" | "system"
    content = Column(Text)
    reasoning_content = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    conversation = relationship("Conversation", back_populates="messages")
```

#### 二. 服务器层

| 任务 | 说明 | 文件 |
|------|------|------|
| DeepSeek Chat 客户端 | 使用 openai SDK，base_url 指向 DeepSeek；封装两个方法：`chat_completion_stream`（对话模式）、`chat_completion_reasoning_stream`（推理模式） | `backend/services/llm_client.py` |
| 对话业务服务 | `create_conversation()` / `get_conversations()` / `get_conversation_detail()` / `delete_conversation()` / `generate_chat_stream()` / `generate_reasoning_stream()` | `backend/services/chat_service.py` |

**核心代码清单**：
```python
# backend/services/llm_client.py (关键方法签名)
from openai import AsyncOpenAI

client = AsyncOpenAI(api_key=settings.deepseek_api_key, base_url="https://api.deepseek.com")

async def chat_completion_stream(messages: list[dict], model="deepseek-chat"):
    """对话模式流式调用，yield {"type": "content", "data": delta}"""

async def chat_completion_reasoning_stream(messages: list[dict], model="deepseek-reasoner"):
    """推理模式流式调用，yield {"type": "reasoning"|"content", "data": delta}"""
```

```python
# backend/services/chat_service.py (关键方法签名)
async def generate_chat_stream(conv_id: str, user_content: str):
    """构建上下文 → 调用 chat_completion_stream → 保存消息 → yield SSE chunk"""

async def generate_reasoning_stream(conv_id: str, user_content: str):
    """构建上下文 → 调用 chat_completion_reasoning_stream → 分别保存 reasoning_content + content → yield SSE chunk"""
```

#### 三. API 端点实现

| 方法 | 路径 | 说明 | 文件 |
|------|------|------|------|
| `GET` | `/api/health` | 健康检查 | `backend/routers/chat.py` |
| `POST` | `/api/conversations` | 创建新对话（可选 title） | `backend/routers/chat.py` |
| `GET` | `/api/conversations` | 获取对话列表（按 updated_at 倒序） | `backend/routers/chat.py` |
| `GET` | `/api/conversations/{id}` | 获取单对话详情（含全部消息，按时间正序） | `backend/routers/chat.py` |
| `DELETE` | `/api/conversations/{id}` | 删除对话及其全部消息 | `backend/routers/chat.py` |
| `POST` | `/api/chat/stream` | 对话模式 SSE 流式接口（接收 `conversation_id` + `content`，返回 `text/event-stream`） | `backend/routers/chat.py` |
| `POST` | `/api/chat/reasoning` | 推理模式 SSE 流式接口（同上，使用 deepseek-reasoner 模型） | `backend/routers/chat.py` |

#### 四. 交付物

| 文件 | 职责 |
|------|------|
| `backend/models/conversation.py` | Conversation + Message ORM 模型 |
| `backend/services/llm_client.py` | DeepSeek API 客户端（对话+推理双模式） |
| `backend/services/chat_service.py` | 对话业务逻辑（CRUD + 流式生成） |
| `backend/routers/chat.py` | 全部 7 个 API 端点 |
| `backend/main.py` | 应用入口、路由注册、CORS、自动建表 |

---

### Phase 4: 前后端联调与流式通信

**目标**：实现 SSE 客户端，串联前后端流式对话，集成 DeepSeek 推理模式与对话模式

#### 一. SSE 客户端实现流程图

```
前端 (React)                              后端 (FastAPI)                    DeepSeek API
─────────                                 ──────────────                    ────────────

用户输入消息
    │
    ▼
chatStore.sendMessage()
    │
    ├─ 追加 user Message 到 messages[]
    ├─ 追加空的 assistant Message
    │  (content="", reasoningContent="")
    ├─ 设置 isStreaming = true
    │
    ▼
api/chat.ts: streamChat()
    │
    ├─ fetch POST /api/chat/stream ──────────► router: chat_stream()
    │  (body: conversation_id, content)           │
    │                                             ├─ 保存 user message 到 DB
    │                                             ├─ 构建 messages 上下文
    │                                             │  (system + 历史 + 当前)
    │                                             │
    │                                             ▼
    │                                         llm_client.chat_completion_stream()
    │                                             │
    │                                             └──── HTTP POST (stream=True) ──► DeepSeek
    │                                                                                    │
    │                                          ◄── SSE chunk (delta.content) ────────────┘
    │                                             │
    │                                         yield "data: {json}\n\n"
    │                                             │
    │  ◄── ReadableStream chunk ─────────────────┘
    │
    ├─ 解析 chunk: {"type":"content", "data":"你好"}
    │       │
    │       ▼
    ├─ chatStore.appendStreamChunk("你好")
    │       │
    │       ▼
    ├─ React 响应式重渲染 MessageBubble
    │  (MarkdownRenderer 增量渲染)
    │       │
    │       ▼ (循环直到...)
    │
    ├─ 收到 chunk: {"type":"done"}
    │
    ▼
chatStore.finishStreaming()
    │
    ├─ 设置 isStreaming = false
    ├─ 刷新对话列表
    └─ 最终渲染完整 Markdown

推理模式 (/api/chat/reasoning) 同理，区别在于：
  - chunk 可能 type="reasoning"（思考过程）或 type="content"（最终回答）
  - 前端 ThinkingPanel 实时累积 reasoningContent
  - 推理结束后折叠面板，展示最终 content
```

#### 二. 前端 SSE 消费层实现

| 任务 | 说明 | 文件 |
|------|------|------|
| 封装 `streamChat()` | Fetch API 读取 ReadableStream，逐行解析 `data: {...}`；按 type 回调 `onContent` / `onReasoning` / `onDone` / `onError` | `frontend/src/api/chat.ts` |
| 实现 `chatStore.sendMessage()` | 编排完整发送流程：创建对话（如需） → 追加用户消息 → 调用 streamChat → 实时更新 assistant 消息 | `frontend/src/stores/chatStore.ts` |
| 实现模式切换 | Store 中维护 `mode: 'chat' | 'reasoning'` 状态，通过 ModeSwitch 组件切换；`sendMessage()` 根据 `mode` 自动选择调用 `/api/chat/stream` 或 `/api/chat/reasoning` | `frontend/src/stores/chatStore.ts`, `frontend/src/components/ModeSwitch.tsx` |

#### 三. 交付物

| 文件 | 职责 |
|------|------|
| `frontend/src/api/chat.ts` | SSE 流消费 + 全部 HTTP 请求封装 |
| `frontend/src/stores/chatStore.ts` | Zustand 全局状态管理（含聊天模式切换） |

---

### Phase 5: 对话历史与功能完善

**目标**：实现完整的对话管理功能，串联全部交互流程

| 任务 | 说明 | 文件 |
|------|------|------|
| 对话列表加载 | 进入页面时调用 `fetchConversations()` 加载历史对话，渲染到 Sidebar | `frontend/src/stores/chatStore.ts` |
| 对话切换 | 点击 Sidebar 中的对话项 → 调用 `fetchConversationDetail(id)` → 替换 messages 列表 → ChatWindow 重新渲染历史消息 | `frontend/src/stores/chatStore.ts` |
| 删除对话 | Sidebar 中点击删除按钮 → 确认弹窗 → `deleteConversation(id)` → 从列表移除；若删除的是当前对话，自动选中下一个或显示空状态 | `frontend/src/stores/chatStore.ts` |
| 自动生成标题 | 后端在创建对话并收到首条用户消息后，用首条消息前 30 字作为 `title` | `backend/services/chat_service.py` |
| 对话持久化 | 每次发送消息：用户消息立即写入 DB → AI 回复流式结束后完整写入 DB（content + reasoning_content） | `backend/services/chat_service.py` |
| 对话排序 | Sidebar 按 `updated_at` 降序排列，最新对话在最上方 | `frontend/src/components/Sidebar.tsx` |

**交付物**：上述修改涉及的文件

---

### Phase 6: 体验优化与收尾

**目标**：处理边界情况，提升用户体验

| 任务 | 说明 | 文件 |
|------|------|------|
| 错误处理 | API 调用失败时显示 Toast 错误提示；流中断时标记消息为「回复中断」；网络异常时提供重试按钮 | `frontend/src/stores/chatStore.ts`, `frontend/src/components/Toast.tsx` |
| 加载状态 | 对话列表加载时显示骨架屏（Skeleton）；流式输出中 assistant 消息显示闪烁光标动画；发送按钮显示旋转加载图标 | `frontend/src/components/ChatWindow.tsx`, `frontend/src/components/MessageBubble.tsx` |
| 空状态引导 | 无对话时 ChatWindow 显示 Logo + 「开始一段新对话」引导文案 + 快捷输入框 | `frontend/src/components/ChatWindow.tsx` |
| 输入校验 | 空消息或纯空白禁止发送（前端校验 + 后端校验） | `frontend/src/components/MessageInput.tsx`, `backend/routers/chat.py` |
| Token 超限截断 | 后端构建上下文时按字符数 / 2 估算 token 数，超过 64K 时从最早消息开始截断，保留最新 N 轮完整对话 | `backend/services/chat_service.py` |
| 移动端适配 | Sidebar 默认隐藏，顶部导航栏显示汉堡图标点击呼出；消息气泡宽度响应式；输入框移动端高度优化 | `frontend/src/App.tsx`, `frontend/src/components/Sidebar.tsx` |
| 代码清理 | 移除调试 console.log、无用导入、注释掉的代码；补充关键函数 JSDoc 注释 | 各文件 |
