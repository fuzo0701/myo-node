# 묘로드 (Myo-node)

Cross-platform terminal emulator for Claude Code

## Features

- Tab/split pane support
- Theme customization (Neon, Dark, Light, Monokai, Dracula, Nord, Cyberpunk)
- File explorer with auto-refresh
- Command palette (Ctrl+Shift+P)
- Conversation history
- Claude Code output rendering (hybrid mode)

## Tech Stack

- Electron
- React
- TypeScript
- xterm.js
- Zustand

## Requirements

- Node.js 18+
- npm 9+

## Installation

```bash
# Clone the repository
git clone https://gitlab.hyperledger.store/fuzo0701/myo-node.git
cd myo-node

# Install dependencies
npm install
```

## Development

```bash
# Run in development mode (Vite dev server + Electron)
npm run dev
```

## Build

```bash
# Build for production
npm run build

# Build renderer only
npm run build:renderer

# Build main process only
npm run build:main
```

## Package

```bash
# Package for current platform
npm run package

# Package for Windows (nsis, portable)
npm run package:win

# Package for macOS (dmg, zip)
npm run package:mac

# Package for Linux (AppImage, deb)
npm run package:linux
```

## Build Output

- `dist/main/` - Compiled main process (CommonJS)
- `dist/renderer/` - Compiled renderer (Vite bundle)
- `release/` - Packaged distributables

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+T | New tab |
| Ctrl+W | Close tab |
| Ctrl+Tab | Next tab |
| Ctrl+Shift+Tab | Previous tab |
| Ctrl+1~9 | Switch to tab |
| Ctrl+B | Toggle file explorer |
| Ctrl+H | Toggle history panel |
| Ctrl+, | Toggle settings |
| Ctrl+\ | Horizontal split |
| Ctrl+Shift+\ | Vertical split |
| Ctrl+Shift+P | Command palette |
| Ctrl+Shift+C | Quick Claude command |

## License

MIT
