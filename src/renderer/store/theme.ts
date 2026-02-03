import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Theme {
  name: string
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selection: string
  fontFamily: string
  fontSize: number
  // ANSI colors
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  brightBlack: string
  brightRed: string
  brightGreen: string
  brightYellow: string
  brightBlue: string
  brightMagenta: string
  brightCyan: string
  brightWhite: string
}

const defaultThemes: Record<string, Theme> = {
  // Default: Dark Neon theme (Linear/Raycast inspired)
  neon: {
    name: 'Neon',
    background: '#0D0D0D',
    foreground: '#FFFFFF',
    cursor: '#00D9FF',
    cursorAccent: '#0D0D0D',
    selection: 'rgba(0,217,255,0.3)',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', monospace",
    fontSize: 14,
    // ANSI colors - Neon palette
    black: '#1A1A2E',
    red: '#FF0066',
    green: '#00FF88',
    yellow: '#FFCC00',
    blue: '#00D9FF',
    magenta: '#FF00FF',
    cyan: '#00D9FF',
    white: '#B4B4B4',
    brightBlack: '#6B7280',
    brightRed: '#FF6B9D',
    brightGreen: '#00FFB3',
    brightYellow: '#FFE066',
    brightBlue: '#00F5FF',
    brightMagenta: '#FF66FF',
    brightCyan: '#00F5FF',
    brightWhite: '#FFFFFF',
  },
  dark: {
    name: 'Dark',
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#ffffff',
    cursorAccent: '#1e1e1e',
    selection: '#264f78',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 14,
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#ffffff',
  },
  light: {
    name: 'Light',
    background: '#ffffff',
    foreground: '#1e1e1e',
    cursor: '#000000',
    cursorAccent: '#ffffff',
    selection: '#add6ff',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 14,
    black: '#000000',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#666666',
    brightRed: '#cd3131',
    brightGreen: '#14ce14',
    brightYellow: '#b5ba00',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5',
  },
  monokai: {
    name: 'Monokai',
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    cursorAccent: '#272822',
    selection: '#49483e',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 14,
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
    brightBlack: '#75715e',
    brightRed: '#f92672',
    brightGreen: '#a6e22e',
    brightYellow: '#f4bf75',
    brightBlue: '#66d9ef',
    brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4',
    brightWhite: '#f9f8f5',
  },
  dracula: {
    name: 'Dracula',
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#282a36',
    selection: '#44475a',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 14,
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },
  nord: {
    name: 'Nord',
    background: '#2e3440',
    foreground: '#d8dee9',
    cursor: '#d8dee9',
    cursorAccent: '#2e3440',
    selection: '#434c5e',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 14,
    black: '#3b4252',
    red: '#bf616a',
    green: '#a3be8c',
    yellow: '#ebcb8b',
    blue: '#81a1c1',
    magenta: '#b48ead',
    cyan: '#88c0d0',
    white: '#e5e9f0',
    brightBlack: '#4c566a',
    brightRed: '#bf616a',
    brightGreen: '#a3be8c',
    brightYellow: '#ebcb8b',
    brightBlue: '#81a1c1',
    brightMagenta: '#b48ead',
    brightCyan: '#8fbcbb',
    brightWhite: '#eceff4',
  },
  cyberpunk: {
    name: 'Cyberpunk',
    background: '#0a0a0f',
    foreground: '#00ff9f',
    cursor: '#ff00ff',
    cursorAccent: '#0a0a0f',
    selection: 'rgba(255,0,255,0.3)',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    fontSize: 14,
    black: '#0a0a0f',
    red: '#ff003c',
    green: '#00ff9f',
    yellow: '#fffc58',
    blue: '#00b3ff',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    white: '#d0d0d0',
    brightBlack: '#545454',
    brightRed: '#ff5c8d',
    brightGreen: '#00ffb7',
    brightYellow: '#fffb7d',
    brightBlue: '#69c3ff',
    brightMagenta: '#ff69ff',
    brightCyan: '#69ffff',
    brightWhite: '#ffffff',
  },
}

interface ThemeStore {
  currentTheme: Theme
  themeName: string
  themes: Record<string, Theme>
  setTheme: (name: string) => void
  setFontSize: (size: number) => void
  setFontFamily: (family: string) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      currentTheme: defaultThemes.neon,
      themeName: 'neon',
      themes: defaultThemes,

      setTheme: (name) => {
        const theme = get().themes[name]
        if (theme) {
          set({ themeName: name, currentTheme: theme })
        }
      },

      setFontSize: (size) =>
        set((state) => ({
          currentTheme: { ...state.currentTheme, fontSize: size },
        })),

      setFontFamily: (family) =>
        set((state) => ({
          currentTheme: { ...state.currentTheme, fontFamily: family },
        })),
    }),
    {
      name: 'myonode-theme',
    }
  )
)
