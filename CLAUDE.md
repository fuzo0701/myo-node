# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **시작 전 확인**: `tasks.md` 파일에서 현재 진행 상황과 예정된 작업을 확인하세요.
> **작업 완료 시**: 기능 구현이 완료되면 `tasks.md`의 해당 항목을 `[x]`로 체크하고, 구현 방식을 간단히 메모하세요.

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

# Package for distribution (release/ 폴더는 자동 정리됨, 수동 삭제 불필요)
# ⚠️ 중요: 반드시 build 후 package 실행! (이전 빌드 결과물 패키징 방지)
npm run build && npm run package          # Current platform
npm run build && npm run package:win      # Windows (nsis, portable)
npm run build && npm run package:mac      # macOS (dmg, zip)
npm run build && npm run package:linux    # Linux (AppImage, deb)
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

**Keyboard Shortcuts**: Designed to work seamlessly with Claude Code's shortcuts. Input field has priority for all keystrokes.
- **Claude Code shortcuts** (work in input): `Ctrl+C/D/L/R/T/G/O/U/K/Y/Z`, `Esc`, `Esc+Esc`
- **App-level shortcuts** (work globally):
  - Navigation: `Ctrl+Shift+P` (command palette), `Ctrl+P` (quick open), `Ctrl+F` (search)
  - Tabs: `Ctrl+Shift+N` (new tab), `Ctrl+W` (close), `Ctrl+Tab` (switch), `Ctrl+1~9` (jump)
  - Panels: `Ctrl+E` (explorer), `Ctrl+H` (history), `Ctrl+,` (settings), `Ctrl+\` (split)
  - Sidebar: `Alt+1~5` (quick toggle)
- **Auto-focus typing**: Type any regular character (a-z, 0-9, symbols) anywhere to automatically focus input and start typing. Arrow keys remain for OutputArea scrolling.

**Claude Rendering**: Three render modes available:
- `terminal`: Classic terminal output only
- `hybrid`: Terminal + rendered Claude blocks (default)
- `rendered`: Full markdown rendering for Claude output
- `abstracted`: Block-based UI with output area + input textarea (xterm hidden but active for PTY)

**현재 프로젝트는 `abstracted` 모드만 사용합니다.** 렌더 모드 관련 질문은 하지 마세요.

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

## GitLab

**Repository**: https://gitlab.hyperledger.store/fuzo0701/myo-node

**Access Token**: `glpat-xUptZKDJZgncpV4bvI4fIm86MQp1OjMH.01.0w077pc58`

**Release Commands** (Generic Package Registry 사용):
```bash
# 1. Create tag and push
git tag v0.x.0
git push origin v0.x.0

# 2. Create release via API
curl --header "PRIVATE-TOKEN: <token>" \
  --request POST \
  --header "Content-Type: application/json" \
  --data '{"tag_name": "v0.x.0", "name": "v0.x.0", "description": "Release notes"}' \
  "https://gitlab.hyperledger.store/api/v4/projects/fuzo0701%2Fmyo-node/releases"

# 3. Upload files to Package Registry (uploads API는 private 프로젝트에서 404 발생)
curl --header "PRIVATE-TOKEN: <token>" \
  --upload-file "release/Myo-node Setup 0.x.0.exe" \
  "https://gitlab.hyperledger.store/api/v4/projects/fuzo0701%2Fmyo-node/packages/generic/myo-node/0.x.0/Myo-node_Setup_0.x.0.exe"

curl --header "PRIVATE-TOKEN: <token>" \
  --upload-file "release/Myo-node 0.x.0.exe" \
  "https://gitlab.hyperledger.store/api/v4/projects/fuzo0701%2Fmyo-node/packages/generic/myo-node/0.x.0/Myo-node_0.x.0_Portable.exe"

# 4. Get package file IDs
curl --header "PRIVATE-TOKEN: <token>" \
  "https://gitlab.hyperledger.store/api/v4/projects/fuzo0701%2Fmyo-node/packages?package_name=myo-node&package_version=0.x.0"
# Get package ID (e.g., 26), then:
curl --header "PRIVATE-TOKEN: <token>" \
  "https://gitlab.hyperledger.store/api/v4/projects/fuzo0701%2Fmyo-node/packages/<package_id>/package_files"
# Note the file IDs (e.g., 27, 28)

# 5. Add file links to release (using package_files URL)
curl --header "PRIVATE-TOKEN: <token>" \
  --request POST \
  --header "Content-Type: application/json" \
  --data '{"name": "Myo-node Setup 0.x.0.exe", "url": "https://gitlab.hyperledger.store/fuzo0701/myo-node/-/package_files/<file_id>/download", "link_type": "package"}' \
  "https://gitlab.hyperledger.store/api/v4/projects/fuzo0701%2Fmyo-node/releases/v0.x.0/assets/links"

curl --header "PRIVATE-TOKEN: <token>" \
  --request POST \
  --header "Content-Type: application/json" \
  --data '{"name": "Myo-node 0.x.0 Portable.exe", "url": "https://gitlab.hyperledger.store/fuzo0701/myo-node/-/package_files/<file_id>/download", "link_type": "package"}' \
  "https://gitlab.hyperledger.store/api/v4/projects/fuzo0701%2Fmyo-node/releases/v0.x.0/assets/links"
```

**Download URLs** (Package Registry):
- Setup: `https://gitlab.hyperledger.store/fuzo0701/myo-node/-/package_files/<file_id>/download`
- Portable: `https://gitlab.hyperledger.store/fuzo0701/myo-node/-/package_files/<file_id>/download`

**Cleanup - 이전 버전 삭제** (릴리스 완료 후 필수):

> **중요**: 새 버전 릴리스 후 반드시 이전 버전들을 삭제하세요. 최신 버전만 유지합니다.

```bash
# 1. 이전 버전 패키지 목록 확인
curl --header "PRIVATE-TOKEN: <token>" \
  "https://gitlab.hyperledger.store/api/v4/projects/fuzo0701%2Fmyo-node/packages?package_name=myo-node"
# 삭제할 패키지 ID 확인 (최신 버전 제외)

# 2. 이전 버전 패키지 삭제 (모든 이전 버전에 대해 실행)
curl --header "PRIVATE-TOKEN: <token>" \
  --request DELETE \
  "https://gitlab.hyperledger.store/api/v4/projects/fuzo0701%2Fmyo-node/packages/<old_package_id>"

# 3. 이전 버전 릴리스 삭제
curl --header "PRIVATE-TOKEN: <token>" \
  --request DELETE \
  "https://gitlab.hyperledger.store/api/v4/projects/fuzo0701%2Fmyo-node/releases/v0.x.0"

# 4. 이전 버전 태그 삭제
git push origin --delete v0.x.0
git tag -d v0.x.0
```
