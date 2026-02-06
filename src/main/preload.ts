import { contextBridge, ipcRenderer } from 'electron'

export type ShellType = 'default' | 'powershell' | 'cmd' | 'bash' | 'zsh'

export type TerminalAPI = {
  create: (cols: number, rows: number, cwd?: string, shell?: ShellType) => Promise<number>
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
  readFileBase64: (path: string) => Promise<string | null>
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

export type DialogAPI = {
  saveFile: (options: {
    title?: string
    defaultPath?: string
    filters?: { name: string; extensions: string[] }[]
  }) => Promise<string | null>
  openFolder: (options?: {
    title?: string
    defaultPath?: string
  }) => Promise<string | null>
}

contextBridge.exposeInMainWorld('terminal', {
  create: (cols: number, rows: number, cwd?: string, shell?: ShellType) => ipcRenderer.invoke('terminal:create', cols, rows, cwd, shell),
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
  readFileBase64: (path: string) => ipcRenderer.invoke('fs:readFileBase64', path),
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

contextBridge.exposeInMainWorld('dialog', {
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  openFolder: (options) => ipcRenderer.invoke('dialog:openFolder', options),
} as DialogAPI)

contextBridge.exposeInMainWorld('shell', {
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
})

export type SessionInfo = {
  id: string
  size: number
  mtime: string
  firstMessage: string
}

export type SessionMessage = {
  type: string
  role?: string
  content?: unknown
  model?: string
  timestamp?: string
  usage?: {
    input_tokens?: number
    output_tokens?: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
}

export type PlanInfo = {
  name: string
  title: string
  size: number
  mtime: string
}

export type TodoInfo = {
  id: string
  tasks: Array<{
    id: string
    subject: string
    status: string
    description?: string
  }>
  mtime: string
}

export type MarketplacePlugin = {
  name: string
  description: string
  version?: string
  author?: { name: string; email?: string }
  source?: string
  category?: string
  homepage?: string
  marketplace: string
  tags?: string[]
  lspServers?: Record<string, unknown>
}

export type ClaudeAPI = {
  listSkills: () => Promise<Array<{ name: string; description: string }>>
  readSkill: (name: string) => Promise<string | null>
  writeSkill: (name: string, content: string) => Promise<boolean>
  deleteSkill: (name: string) => Promise<boolean>
  readMcpConfig: (scope: string, projectPath?: string) => Promise<Record<string, unknown>>
  writeMcpConfig: (scope: string, servers: Record<string, unknown>, projectPath?: string) => Promise<boolean>
  readClaudeMd: (scope: string, projectPath?: string) => Promise<string>
  writeClaudeMd: (scope: string, content: string, projectPath?: string) => Promise<boolean>
  readStatsCache: () => Promise<Record<string, unknown> | null>
  getUsage: () => Promise<OAuthUsageResponse | null>
  listProjects: () => Promise<string[]>
  listSessions: (projectName: string) => Promise<SessionInfo[]>
  readSession: (projectName: string, sessionId: string) => Promise<SessionMessage[]>
  listPlans: () => Promise<PlanInfo[]>
  readPlan: (planName: string) => Promise<string | null>
  listTodos: () => Promise<TodoInfo[]>
  readKeybindings: () => Promise<Record<string, unknown> | null>
  fetchMarketplace: () => Promise<MarketplacePlugin[]>
  getInstalledPlugins: () => Promise<string[]>
}

export type OAuthUsageResponse = {
  five_hour?: { utilization: number; resets_at: string }
  seven_day?: { utilization: number; resets_at: string }
  seven_day_sonnet?: { utilization: number; resets_at: string }
  extra_usage?: { is_enabled: boolean; monthly_limit: number | null; used_credits: number | null; utilization: number | null }
}

export type GitAPI = {
  getRepoRoot: (dirPath: string) => Promise<string | null>
  getStatus: (repoRoot: string) => Promise<Record<string, { index: string; workTree: string }> | null>
}

contextBridge.exposeInMainWorld('git', {
  getRepoRoot: (dirPath: string) => ipcRenderer.invoke('git:getRepoRoot', dirPath),
  getStatus: (repoRoot: string) => ipcRenderer.invoke('git:getStatus', repoRoot),
} as GitAPI)

contextBridge.exposeInMainWorld('claude', {
  listSkills: () => ipcRenderer.invoke('claude:listSkills'),
  readSkill: (name: string) => ipcRenderer.invoke('claude:readSkill', name),
  writeSkill: (name: string, content: string) => ipcRenderer.invoke('claude:writeSkill', name, content),
  deleteSkill: (name: string) => ipcRenderer.invoke('claude:deleteSkill', name),
  readMcpConfig: (scope: string, projectPath?: string) => ipcRenderer.invoke('claude:readMcpConfig', scope, projectPath),
  writeMcpConfig: (scope: string, servers: Record<string, unknown>, projectPath?: string) => ipcRenderer.invoke('claude:writeMcpConfig', scope, servers, projectPath),
  readClaudeMd: (scope: string, projectPath?: string) => ipcRenderer.invoke('claude:readClaudeMd', scope, projectPath),
  writeClaudeMd: (scope: string, content: string, projectPath?: string) => ipcRenderer.invoke('claude:writeClaudeMd', scope, content, projectPath),
  readStatsCache: () => ipcRenderer.invoke('claude:readStatsCache'),
  getUsage: () => ipcRenderer.invoke('claude:getUsage'),
  listProjects: () => ipcRenderer.invoke('claude:listProjects'),
  listSessions: (projectName: string) => ipcRenderer.invoke('claude:listSessions', projectName),
  readSession: (projectName: string, sessionId: string) => ipcRenderer.invoke('claude:readSession', projectName, sessionId),
  listPlans: () => ipcRenderer.invoke('claude:listPlans'),
  readPlan: (planName: string) => ipcRenderer.invoke('claude:readPlan', planName),
  listTodos: () => ipcRenderer.invoke('claude:listTodos'),
  readKeybindings: () => ipcRenderer.invoke('claude:readKeybindings'),
  fetchMarketplace: () => ipcRenderer.invoke('claude:fetchMarketplace'),
  getInstalledPlugins: () => ipcRenderer.invoke('claude:getInstalledPlugins'),
} as ClaudeAPI)
