# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **시작 전 확인**: `tasks.md` 파일에서 현재 진행 상황과 예정된 작업을 확인하세요.

## Project Overview

**묘로드 (Myo-node)** is a cross-platform terminal emulator built for Claude Code, featuring:
- Tab/split pane support
- Theme customization
- Conversation history (planned)
- Claude response rendering (planned)

**Tech Stack**: Electron + React + TypeScript + xterm.js

## Commands

```bash
# Install dependencies
npm install

# Development (runs Vite dev server + Electron)
npm run dev

# Build for production
npm run build

# Package for distribution
npm run package          # Current platform
npm run package:win      # Windows (nsis, portable)
npm run package:mac      # macOS (dmg, zip)
npm run package:linux    # Linux (AppImage, deb)
```

## Architecture

```
src/
├── main/           # Electron main process (Node.js)
│   ├── main.ts     # App lifecycle, window management, IPC handlers
│   └── preload.ts  # Context bridge (exposes terminal/window APIs to renderer)
│
└── renderer/       # Electron renderer process (React)
    ├── App.tsx
    ├── components/
    │   ├── TitleBar.tsx         # Custom window controls
    │   ├── TabBar.tsx           # Tab management, split controls
    │   ├── HybridTerminal.tsx   # Terminal with Claude rendering support
    │   ├── ClaudeRenderer.tsx   # Markdown/code/diff rendering for Claude output
    │   ├── HistoryPanel.tsx     # Conversation history sidebar
    │   ├── ConversationView.tsx # Message viewer with markdown rendering
    │   └── SettingsPanel.tsx    # App settings (render mode, theme, etc.)
    ├── store/
    │   ├── tabs.ts              # Zustand store for tab state
    │   ├── theme.ts             # Zustand store for theme (persisted)
    │   ├── history.ts           # Zustand store for conversation history (persisted)
    │   └── settings.ts          # Zustand store for app settings (persisted)
    ├── utils/
    │   ├── claudeParser.ts      # Parser to detect Claude Code output
    │   └── dateFormat.ts        # Date formatting utilities
    └── styles/
        ├── global.css
        └── claude-renderer.css  # Styles for Claude output rendering
```

## Key Patterns

**IPC Communication**: Main process manages PTY (node-pty). Renderer communicates via preload-exposed APIs:
- `window.terminal.create/write/resize/kill` - PTY control
- `window.windowControls.minimize/maximize/close` - Window controls

**State Management**: Zustand with persist middleware for theme and conversation history storage (localStorage).

**Terminal Rendering**: xterm.js with FitAddon for auto-resize, WebLinksAddon for clickable URLs.

**Conversation History**: Auto-captures Claude Code sessions. Parser detects Claude output patterns and saves messages. History persisted to localStorage via Zustand persist middleware.

**Claude Rendering**: Three render modes available:
- `terminal`: Classic terminal output only
- `hybrid`: Terminal + rendered Claude blocks (default)
- `rendered`: Full markdown rendering for Claude output

Rendering features:
- Markdown with syntax highlighting (react-markdown + react-syntax-highlighter)
- Collapsible thinking blocks
- Tool use indicators with icons (📖 Read, ✏️ Write, 🔍 Search, ⚡ Bash)
- Diff view with add/remove highlighting
- Code blocks with copy button and language label
- Error/success message styling

## Build Outputs

- `dist/main/` - Compiled main process (CommonJS)
- `dist/renderer/` - Compiled renderer (Vite bundle)
- `release/` - Packaged distributables
