import { contextBridge, ipcRenderer } from 'electron'

export type TerminalAPI = {
  create: (cols: number, rows: number, cwd?: string) => Promise<number>
  write: (id: number, data: string) => void
  resize: (id: number, cols: number, rows: number) => void
  kill: (id: number) => void
  getCwd: (id: number) => Promise<string | null>
  onData: (callback: (id: number, data: string) => void) => () => void
  onExit: (callback: (id: number, exitCode: number) => void) => () => void
}

export type WindowAPI = {
  minimize: () => void
  maximize: () => void
  close: () => void
}

export type FileSystemAPI = {
  readDirectory: (path: string) => Promise<Array<{ name: string; type: 'file' | 'directory' }>>
  getCurrentDirectory: () => Promise<string>
  readFile: (path: string) => Promise<string>
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

export type ClipboardAPI = {
  writeFiles: (paths: string[]) => Promise<boolean>
  readFiles: () => Promise<string[]>
  hasFiles: () => Promise<boolean>
}

contextBridge.exposeInMainWorld('terminal', {
  create: (cols: number, rows: number, cwd?: string) => ipcRenderer.invoke('terminal:create', cols, rows, cwd),
  write: (id: number, data: string) => ipcRenderer.send('terminal:write', id, data),
  resize: (id: number, cols: number, rows: number) => ipcRenderer.send('terminal:resize', id, cols, rows),
  kill: (id: number) => ipcRenderer.send('terminal:kill', id),
  getCwd: (id: number) => ipcRenderer.invoke('terminal:getCwd', id),
  onData: (callback: (id: number, data: string) => void) => {
    const handler = (_: unknown, id: number, data: string) => callback(id, data)
    ipcRenderer.on('terminal:data', handler)
    return () => ipcRenderer.removeListener('terminal:data', handler)
  },
  onExit: (callback: (id: number, exitCode: number) => void) => {
    const handler = (_: unknown, id: number, exitCode: number) => callback(id, exitCode)
    ipcRenderer.on('terminal:exit', handler)
    return () => ipcRenderer.removeListener('terminal:exit', handler)
  },
} as TerminalAPI)

contextBridge.exposeInMainWorld('windowControls', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
} as WindowAPI)

contextBridge.exposeInMainWorld('fileSystem', {
  readDirectory: (path: string) => ipcRenderer.invoke('fs:readDirectory', path),
  getCurrentDirectory: () => ipcRenderer.invoke('fs:getCurrentDirectory'),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  watch: (path: string) => ipcRenderer.invoke('fs:watch', path),
  unwatch: (path: string) => ipcRenderer.invoke('fs:unwatch', path),
  onFsChange: (callback: (dirPath: string, eventType: string, filename: string) => void) => {
    const handler = (_: unknown, dirPath: string, eventType: string, filename: string) =>
      callback(dirPath, eventType, filename)
    ipcRenderer.on('fs:changed', handler)
    return () => ipcRenderer.removeListener('fs:changed', handler)
  },
  copyFile: (src: string, dest: string) => ipcRenderer.invoke('fs:copyFile', src, dest),
  copyDirectory: (src: string, dest: string) => ipcRenderer.invoke('fs:copyDirectory', src, dest),
  exists: (path: string) => ipcRenderer.invoke('fs:exists', path),
  stat: (path: string) => ipcRenderer.invoke('fs:stat', path),
  createDirectory: (path: string) => ipcRenderer.invoke('fs:createDirectory', path),
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  delete: (path: string) => ipcRenderer.invoke('fs:delete', path),
} as FileSystemAPI)

contextBridge.exposeInMainWorld('clipboard', {
  writeFiles: (paths: string[]) => ipcRenderer.invoke('clipboard:writeFiles', paths),
  readFiles: () => ipcRenderer.invoke('clipboard:readFiles'),
  hasFiles: () => ipcRenderer.invoke('clipboard:hasFiles'),
} as ClipboardAPI)
