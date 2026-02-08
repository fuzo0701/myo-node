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
d
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

**Note**: All Claude Code shortcuts (Ctrl+C/D/L/R/T/G/O/U/K/Y/Z, Esc) work in the input field and are passed through to Claude Code.

### Navigation
| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+P | Command palette |
| Ctrl+P | Quick open (file search) |
| Ctrl+F | Search in output |
| Ctrl+Shift+F | Search in files |

### Tabs
| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+N | New tab |
| Ctrl+W | Close tab |
| Ctrl+Tab | Next tab |
| Ctrl+Shift+Tab | Previous tab |
| Ctrl+1~9 | Switch to tab |

### Panels
| Shortcut | Action |
|----------|--------|
| Ctrl+E | Toggle file explorer |
| Ctrl+H | Toggle history panel |
| Ctrl+, | Toggle settings |
| Ctrl+Shift+L | Toggle Claude settings |
| Ctrl+Shift+T | Toggle task panel |
| Ctrl+Shift+D | Toggle Agent Teams dashboard |
| Ctrl+\ | Horizontal split |
| Ctrl+Shift+\ | Vertical split |

### Sidebar Quick Toggle
| Shortcut | Action |
|----------|--------|
| Alt+1 | File explorer |
| Alt+2 | History |
| Alt+3 | Claude settings |
| Alt+4 | Settings |
| Alt+5 | Search panel |

### Other
| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+C | Quick Claude command |
| Escape | Close panels |

## License

MIT
