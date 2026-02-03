export {}

declare global {
  interface Window {
    terminal: {
      create: (cols: number, rows: number, cwd?: string) => Promise<number>
      write: (id: number, data: string) => void
      resize: (id: number, cols: number, rows: number) => void
      kill: (id: number) => void
      onData: (callback: (id: number, data: string) => void) => () => void
      onExit: (callback: (id: number, exitCode: number) => void) => () => void
    }
    windowControls: {
      minimize: () => void
      maximize: () => void
      close: () => void
    }
    fileSystem: {
      readDirectory: (path: string) => Promise<Array<{ name: string; type: 'file' | 'directory' }>>
      getCurrentDirectory: () => Promise<string>
      readFile: (path: string) => Promise<string | null>
      writeFile: (path: string, content: string) => Promise<boolean>
    }
  }
}
