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
      watch: (path: string) => Promise<boolean>
      unwatch: (path: string) => Promise<boolean>
      onFsChange: (callback: (dirPath: string, eventType: string, filename: string) => void) => () => void
      copyFile: (src: string, dest: string) => Promise<boolean>
      copyDirectory: (src: string, dest: string) => Promise<boolean>
      exists: (path: string) => Promise<boolean>
      stat: (path: string) => Promise<{ isDirectory: boolean; isFile: boolean; size: number; mtime: string } | null>
      createDirectory: (path: string) => Promise<boolean>
      rename: (oldPath: string, newPath: string) => Promise<boolean>
      delete: (path: string) => Promise<boolean>
    }
    clipboard: {
      writeFiles: (paths: string[]) => Promise<boolean>
      readFiles: () => Promise<string[]>
      hasFiles: () => Promise<boolean>
    }
    dialog: {
      saveFile: (options: {
        title?: string
        defaultPath?: string
        filters?: { name: string; extensions: string[] }[]
      }) => Promise<string | null>
    }
    shell: {
      openExternal: (url: string) => Promise<boolean>
    }
  }
}
