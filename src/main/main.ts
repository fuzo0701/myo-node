import { app, BrowserWindow, ipcMain, clipboard, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as pty from 'node-pty'
import * as os from 'os'
import * as https from 'https'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

let mainWindow: BrowserWindow | null = null
const terminals: Map<number, pty.IPty> = new Map()
const terminalCwds: Map<number, string> = new Map()
let terminalIdCounter = 0

// File watchers
const fileWatchers: Map<string, fs.FSWatcher> = new Map()

type ShellType = 'default' | 'powershell' | 'cmd' | 'bash' | 'zsh'

function getShell(shellType: ShellType = 'default'): string {
  if (process.platform === 'win32') {
    switch (shellType) {
      case 'powershell':
        return 'powershell.exe'
      case 'cmd':
        return 'cmd.exe'
      default:
        return process.env.COMSPEC || 'powershell.exe'
    }
  }
  // macOS / Linux
  switch (shellType) {
    case 'bash':
      return '/bin/bash'
    case 'zsh':
      return '/bin/zsh'
    default:
      return process.env.SHELL || '/bin/bash'
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0D0D0D',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:15180')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))

    // Disable reload shortcuts in production
    mainWindow.webContents.on('before-input-event', (_event, input) => {
      if (
        (input.control || input.meta) &&
        (input.key === 'r' || input.key === 'R')
      ) {
        _event.preventDefault()
      }
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    terminals.forEach((term) => term.kill())
    terminals.clear()
    terminalCwds.clear()
  })
}

// Terminal IPC handlers
ipcMain.handle('terminal:create', (_, cols: number, rows: number, cwd?: string, shellType?: ShellType) => {
  const id = ++terminalIdCounter
  const shell = getShell(shellType)

  // Resolve cwd - use provided path, fall back to home directory
  let workingDir = os.homedir()
  if (cwd && cwd !== '~') {
    try {
      if (fs.existsSync(cwd)) {
        workingDir = cwd
      }
    } catch {
      // Fall back to home directory
    }
  }

  // Set up environment with UTF-8 support
  const env: { [key: string]: string } = {
    ...process.env as { [key: string]: string },
    LANG: 'ko_KR.UTF-8',
    LC_ALL: 'ko_KR.UTF-8',
  }

  // Windows-specific: Use UTF-8 code page
  if (process.platform === 'win32') {
    env.PYTHONIOENCODING = 'utf-8'
  }

  const term = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: workingDir,
    env,
  })

  // Windows: Set UTF-8 encoding on startup
  if (process.platform === 'win32') {
    if (shell.toLowerCase().includes('powershell')) {
      // PowerShell UTF-8 encoding
      term.write('[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8; clear\r')
    } else {
      // CMD UTF-8 code page
      term.write('chcp 65001 >nul && cls\r')
    }
  }

  term.onData((data) => {
    mainWindow?.webContents.send('terminal:data', id, data)
  })

  term.onExit(({ exitCode }) => {
    mainWindow?.webContents.send('terminal:exit', id, exitCode)
    terminals.delete(id)
  })

  terminals.set(id, term)
  terminalCwds.set(id, workingDir)
  return id
})

ipcMain.on('terminal:write', (_, id: number, data: string) => {
  terminals.get(id)?.write(data)
})

ipcMain.on('terminal:resize', (_, id: number, cols: number, rows: number) => {
  terminals.get(id)?.resize(cols, rows)
})

ipcMain.on('terminal:kill', (_, id: number) => {
  terminals.get(id)?.kill()
  terminals.delete(id)
  terminalCwds.delete(id)
})

ipcMain.handle('terminal:getCwd', (_, id: number) => {
  return terminalCwds.get(id) || null
})

// File system handlers
ipcMain.handle('fs:readDirectory', async (_, dirPath: string) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    return entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file',
    }))
  } catch (error) {
    console.error('Failed to read directory:', error)
    return []
  }
})

ipcMain.handle('fs:getCurrentDirectory', () => {
  return process.cwd()
})

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8')
    return content
  } catch (error) {
    console.error('Failed to read file:', error)
    return null
  }
})

ipcMain.handle('fs:readFileBase64', async (_, filePath: string) => {
  try {
    const buffer = await fs.promises.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase().slice(1)
    const mimeTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      bmp: 'image/bmp',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      ico: 'image/x-icon',
    }
    const mime = mimeTypes[ext] || 'application/octet-stream'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch (error) {
    console.error('Failed to read file as base64:', error)
    return null
  }
})

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf-8')
    return true
  } catch (error) {
    console.error('Failed to write file:', error)
    return false
  }
})

// File watcher handlers
ipcMain.handle('fs:watch', (_, dirPath: string) => {
  // Don't create duplicate watchers
  if (fileWatchers.has(dirPath)) {
    return true
  }

  try {
    const watcher = fs.watch(dirPath, { persistent: false }, (eventType, filename) => {
      // Debounce events and send to renderer
      mainWindow?.webContents.send('fs:changed', dirPath, eventType, filename)
    })

    watcher.on('error', (error) => {
      console.error('Watcher error:', error)
      fileWatchers.delete(dirPath)
    })

    fileWatchers.set(dirPath, watcher)
    return true
  } catch (error) {
    console.error('Failed to watch directory:', error)
    return false
  }
})

ipcMain.handle('fs:unwatch', (_, dirPath: string) => {
  const watcher = fileWatchers.get(dirPath)
  if (watcher) {
    watcher.close()
    fileWatchers.delete(dirPath)
  }
  return true
})

// File copy operations
async function copyDirectoryRecursive(src: string, dest: string): Promise<void> {
  await fs.promises.mkdir(dest, { recursive: true })
  const entries = await fs.promises.readdir(src, { withFileTypes: true })

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)

    if (entry.isDirectory()) {
      await copyDirectoryRecursive(srcPath, destPath)
    } else {
      await fs.promises.copyFile(srcPath, destPath)
    }
  }
}

ipcMain.handle('fs:copyFile', async (_, src: string, dest: string) => {
  try {
    await fs.promises.copyFile(src, dest)
    return true
  } catch (error) {
    console.error('Failed to copy file:', error)
    return false
  }
})

ipcMain.handle('fs:copyDirectory', async (_, src: string, dest: string) => {
  try {
    await copyDirectoryRecursive(src, dest)
    return true
  } catch (error) {
    console.error('Failed to copy directory:', error)
    return false
  }
})

ipcMain.handle('fs:exists', async (_, filePath: string) => {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('fs:stat', async (_, filePath: string) => {
  try {
    const stat = await fs.promises.stat(filePath)
    return {
      isDirectory: stat.isDirectory(),
      isFile: stat.isFile(),
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    }
  } catch (error) {
    console.error('Failed to stat file:', error)
    return null
  }
})

ipcMain.handle('fs:createDirectory', async (_, dirPath: string) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true })
    return true
  } catch (error) {
    console.error('Failed to create directory:', error)
    return false
  }
})

ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
  try {
    await fs.promises.rename(oldPath, newPath)
    return true
  } catch (error) {
    console.error('Failed to rename:', error)
    return false
  }
})

ipcMain.handle('fs:delete', async (_, filePath: string) => {
  try {
    const stat = await fs.promises.stat(filePath)
    if (stat.isDirectory()) {
      await fs.promises.rm(filePath, { recursive: true, force: true })
    } else {
      await fs.promises.unlink(filePath)
    }
    return true
  } catch (error) {
    console.error('Failed to delete:', error)
    return false
  }
})

// Git handlers
ipcMain.handle('git:getRepoRoot', async (_, dirPath: string) => {
  try {
    const { stdout } = await execAsync('git rev-parse --show-toplevel', {
      cwd: dirPath,
      timeout: 5000,
    })
    return stdout.trim().replace(/\\/g, '/')
  } catch {
    return null
  }
})

ipcMain.handle('git:getStatus', async (_, repoRoot: string) => {
  try {
    const { stdout } = await execAsync('git status --porcelain=v1 -uall', {
      cwd: repoRoot,
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10000,
    })
    const result: Record<string, { index: string; workTree: string }> = {}
    for (const line of stdout.split('\n')) {
      if (line.length < 4) continue
      const index = line[0]
      const workTree = line[1]
      // Handle renamed files: "R  old -> new"
      let filePath = line.substring(3)
      if (filePath.includes(' -> ')) {
        filePath = filePath.split(' -> ')[1]
      }
      result[filePath] = { index, workTree }
    }
    return result
  } catch {
    return null
  }
})

// Clipboard file operations (Windows-specific using PowerShell)
// Uses temp script file instead of EncodedCommand to avoid antivirus false positives
async function runPowerShell(script: string): Promise<string> {
  const os = await import('os')
  const tempDir = os.tmpdir()
  const scriptPath = path.join(tempDir, `myo-clip-${Date.now()}.ps1`)

  try {
    // Write script to temp file with UTF-8 BOM for PowerShell compatibility
    const bom = Buffer.from([0xEF, 0xBB, 0xBF])
    await fs.promises.writeFile(scriptPath, Buffer.concat([bom, Buffer.from(script, 'utf8')]))

    // Execute script file with -STA for clipboard access
    const { stdout } = await execAsync(`powershell -STA -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}"`, {
      encoding: 'utf8',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    })
    return stdout.trim()
  } finally {
    // Clean up temp file
    try {
      await fs.promises.unlink(scriptPath)
    } catch {
      // Ignore cleanup errors
    }
  }
}

ipcMain.handle('clipboard:writeFiles', async (_, paths: string[]) => {
  try {
    if (process.platform === 'win32') {
      // Windows: Use PowerShell to set files to clipboard in CF_HDROP format
      const pathsList = paths.map(p => `'${p.replace(/\//g, '\\').replace(/'/g, "''")}'`).join(',')
      const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$files = New-Object System.Collections.Specialized.StringCollection
@(${pathsList}) | ForEach-Object { [void]$files.Add($_) }
[System.Windows.Forms.Clipboard]::SetFileDropList($files)
`
      await runPowerShell(psScript)
    } else {
      // For other platforms, just write as text
      clipboard.writeText(paths.join('\n'))
    }
    return true
  } catch (error) {
    console.error('Failed to write files to clipboard:', error)
    return false
  }
})

ipcMain.handle('clipboard:readFiles', async () => {
  try {
    if (process.platform === 'win32') {
      // Try to read CF_HDROP format directly using Electron
      const formats = clipboard.availableFormats()
      if (formats.includes('FileNameW') || formats.some(f => f.includes('FileName'))) {
        const hdropBuffer = clipboard.readBuffer('FileNameW')
        if (hdropBuffer && hdropBuffer.length > 0) {
          // Parse null-terminated UTF-16LE strings
          const paths: string[] = []
          let currentPath = ''

          for (let i = 0; i < hdropBuffer.length - 1; i += 2) {
            const charCode = hdropBuffer.readUInt16LE(i)
            if (charCode === 0) {
              if (currentPath) {
                paths.push(currentPath)
                currentPath = ''
              } else {
                break
              }
            } else {
              currentPath += String.fromCharCode(charCode)
            }
          }

          if (paths.length > 0) {
            return paths
          }
        }
      }

      // Alternative: Try reading 'text/uri-list' format
      if (formats.includes('text/uri-list')) {
        const uriList = clipboard.read('text/uri-list')
        if (uriList) {
          const paths = uriList.split('\n')
            .map(uri => uri.trim())
            .filter(uri => uri && !uri.startsWith('#'))
            .map(uri => {
              if (uri.startsWith('file:///')) {
                return decodeURIComponent(uri.slice(8)).replace(/\//g, '\\')
              }
              return uri
            })
          if (paths.length > 0) {
            return paths
          }
        }
      }

      // Fallback: Use PowerShell
      const psScript = `
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
$files = [System.Windows.Forms.Clipboard]::GetFileDropList()
if ($files.Count -gt 0) {
  $files -join '|FILESEP|'
}
`
      try {
        const stdout = await runPowerShell(psScript)
        if (stdout) {
          const paths = stdout.split('|FILESEP|').filter(p => p)
          if (paths.length > 0) {
            return paths
          }
        }
      } catch {
        // PowerShell failed, continue to fallback
      }
    }

    // Fallback: check if clipboard text looks like file paths
    const text = clipboard.readText()
    if (text) {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l)
      // Check if lines look like absolute paths
      const looksLikePaths = lines.every(line => {
        if (process.platform === 'win32') {
          return /^[A-Za-z]:\\/.test(line) || line.startsWith('\\\\')
        }
        return line.startsWith('/')
      })

      if (looksLikePaths && lines.length > 0) {
        // Verify paths exist
        const validPaths: string[] = []
        for (const line of lines) {
          try {
            await fs.promises.access(line)
            validPaths.push(line)
          } catch {
            // Path doesn't exist, skip
          }
        }
        return validPaths
      }
    }

    return []
  } catch (error) {
    console.error('Failed to read files from clipboard:', error)
    return []
  }
})

ipcMain.handle('clipboard:hasFiles', async () => {
  try {
    if (process.platform === 'win32') {
      // Windows: Use PowerShell to check if clipboard contains files
      const psScript = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Clipboard]::ContainsFileDropList()
`
      try {
        const stdout = await runPowerShell(psScript)
        if (stdout.toLowerCase() === 'true') {
          return true
        }
      } catch {
        // PowerShell failed, continue to fallback
      }
    }

    // Fallback: Check text for file paths
    const text = clipboard.readText()
    if (text) {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l)
      if (lines.length > 0) {
        const firstLine = lines[0]
        if (process.platform === 'win32') {
          return /^[A-Za-z]:\\/.test(firstLine) || firstLine.startsWith('\\\\')
        }
        return firstLine.startsWith('/')
      }
    }

    return false
  } catch (error) {
    console.error('Failed to check clipboard for files:', error)
    return false
  }
})

// Dialog handlers
ipcMain.handle('dialog:saveFile', async (_, options: {
  title?: string
  defaultPath?: string
  filters?: { name: string; extensions: string[] }[]
}) => {
  if (!mainWindow) return null

  const result = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'Save File',
    defaultPath: options.defaultPath,
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
  })

  return result.canceled ? null : result.filePath
})

ipcMain.handle('dialog:openFolder', async (_, options?: {
  title?: string
  defaultPath?: string
}) => {
  if (!mainWindow) return null

  const result = await dialog.showOpenDialog(mainWindow, {
    title: options?.title || 'Open Folder',
    defaultPath: options?.defaultPath,
    properties: ['openDirectory'],
  })

  return result.canceled ? null : result.filePaths[0]
})

// Shell - open external URLs
ipcMain.handle('shell:openExternal', async (_, url: string) => {
  try {
    const { shell } = await import('electron')
    await shell.openExternal(url)
    return true
  } catch (error) {
    console.error('Failed to open external URL:', error)
    return false
  }
})

// Claude Skills handlers
ipcMain.handle('claude:listSkills', async () => {
  try {
    const skillsDir = path.join(os.homedir(), '.claude', 'skills')
    if (!fs.existsSync(skillsDir)) return []
    const entries = await fs.promises.readdir(skillsDir, { withFileTypes: true })
    const skills: { name: string; description: string }[] = []
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md')
        try {
          const content = await fs.promises.readFile(skillMdPath, 'utf-8')
          const firstLine = content.split('\n').find(l => l.trim()) || ''
          skills.push({ name: entry.name, description: firstLine })
        } catch {
          skills.push({ name: entry.name, description: '' })
        }
      }
    }
    return skills
  } catch {
    return []
  }
})

ipcMain.handle('claude:readSkill', async (_, name: string) => {
  try {
    const skillPath = path.join(os.homedir(), '.claude', 'skills', name, 'SKILL.md')
    return await fs.promises.readFile(skillPath, 'utf-8')
  } catch {
    return null
  }
})

ipcMain.handle('claude:writeSkill', async (_, name: string, content: string) => {
  try {
    const skillDir = path.join(os.homedir(), '.claude', 'skills', name)
    await fs.promises.mkdir(skillDir, { recursive: true })
    await fs.promises.writeFile(path.join(skillDir, 'SKILL.md'), content, 'utf-8')
    return true
  } catch {
    return false
  }
})

ipcMain.handle('claude:deleteSkill', async (_, name: string) => {
  try {
    const skillDir = path.join(os.homedir(), '.claude', 'skills', name)
    await fs.promises.rm(skillDir, { recursive: true, force: true })
    return true
  } catch {
    return false
  }
})

// Claude MCP config handlers
ipcMain.handle('claude:readMcpConfig', async (_, scope: string, projectPath?: string) => {
  try {
    let configPath: string
    if (scope === 'global') {
      configPath = path.join(os.homedir(), '.claude', 'settings.json')
    } else {
      configPath = path.join(projectPath || process.cwd(), '.mcp.json')
    }
    const content = await fs.promises.readFile(configPath, 'utf-8')
    const json = JSON.parse(content)
    if (scope === 'global') {
      return json.mcpServers || {}
    }
    return json.mcpServers || {}
  } catch {
    return {}
  }
})

ipcMain.handle('claude:writeMcpConfig', async (_, scope: string, servers: Record<string, unknown>, projectPath?: string) => {
  try {
    let configPath: string
    if (scope === 'global') {
      configPath = path.join(os.homedir(), '.claude', 'settings.json')
      // Merge with existing settings
      let existing: Record<string, unknown> = {}
      try {
        const content = await fs.promises.readFile(configPath, 'utf-8')
        existing = JSON.parse(content)
      } catch { /* file doesn't exist */ }
      existing.mcpServers = servers
      await fs.promises.mkdir(path.dirname(configPath), { recursive: true })
      await fs.promises.writeFile(configPath, JSON.stringify(existing, null, 2), 'utf-8')
    } else {
      configPath = path.join(projectPath || process.cwd(), '.mcp.json')
      const data = { mcpServers: servers }
      await fs.promises.writeFile(configPath, JSON.stringify(data, null, 2), 'utf-8')
    }
    return true
  } catch {
    return false
  }
})

// Claude CLAUDE.md handlers
ipcMain.handle('claude:readClaudeMd', async (_, scope: string, projectPath?: string) => {
  try {
    let filePath: string
    if (scope === 'global') {
      filePath = path.join(os.homedir(), '.claude', 'CLAUDE.md')
    } else {
      filePath = path.join(projectPath || process.cwd(), 'CLAUDE.md')
    }
    return await fs.promises.readFile(filePath, 'utf-8')
  } catch {
    return ''
  }
})

ipcMain.handle('claude:writeClaudeMd', async (_, scope: string, content: string, projectPath?: string) => {
  try {
    let filePath: string
    if (scope === 'global') {
      filePath = path.join(os.homedir(), '.claude', 'CLAUDE.md')
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    } else {
      filePath = path.join(projectPath || process.cwd(), 'CLAUDE.md')
    }
    await fs.promises.writeFile(filePath, content, 'utf-8')
    return true
  } catch {
    return false
  }
})

ipcMain.handle('claude:readStatsCache', async () => {
  try {
    const statsPath = path.join(os.homedir(), '.claude', 'stats-cache.json')
    const content = await fs.promises.readFile(statsPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
})

ipcMain.handle('claude:getUsage', async () => {
  try {
    // Read credentials
    const credPath = path.join(os.homedir(), '.claude', '.credentials.json')
    const credContent = await fs.promises.readFile(credPath, 'utf-8')
    const cred = JSON.parse(credContent)
    const token = cred?.claudeAiOauth?.accessToken
    if (!token) return null

    // Call OAuth usage API
    return await new Promise((resolve) => {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/api/oauth/usage',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'anthropic-beta': 'oauth-2025-04-20',
          'User-Agent': 'claude-code/2.0.31',
        },
      }, (res) => {
        let body = ''
        res.on('data', (chunk: Buffer) => { body += chunk.toString() })
        res.on('end', () => {
          try {
            resolve(JSON.parse(body))
          } catch {
            resolve(null)
          }
        })
      })
      req.on('error', () => resolve(null))
      req.setTimeout(10000, () => { req.destroy(); resolve(null) })
      req.end()
    })
  } catch {
    return null
  }
})

// Claude Session JSONL handlers
ipcMain.handle('claude:listProjects', async () => {
  try {
    const projectsDir = path.join(os.homedir(), '.claude', 'projects')
    if (!fs.existsSync(projectsDir)) return []
    const entries = await fs.promises.readdir(projectsDir, { withFileTypes: true })
    return entries.filter(e => e.isDirectory()).map(e => e.name)
  } catch {
    return []
  }
})

ipcMain.handle('claude:listSessions', async (_, projectName: string) => {
  try {
    const projectDir = path.join(os.homedir(), '.claude', 'projects', projectName)
    if (!fs.existsSync(projectDir)) return []
    const entries = await fs.promises.readdir(projectDir)
    const sessions: Array<{
      id: string
      size: number
      mtime: string
      firstMessage: string
    }> = []
    for (const entry of entries) {
      if (entry.endsWith('.jsonl')) {
        const sessionId = entry.replace('.jsonl', '')
        const filePath = path.join(projectDir, entry)
        const stat = await fs.promises.stat(filePath)
        // Read first user message for preview
        let firstMessage = ''
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8')
          const lines = content.split('\n').filter(l => l.trim())
          for (const line of lines) {
            const parsed = JSON.parse(line)
            if (parsed.type === 'user' && parsed.message?.content) {
              const content = parsed.message.content
              firstMessage = typeof content === 'string'
                ? content.slice(0, 100)
                : JSON.stringify(content).slice(0, 100)
              break
            }
          }
        } catch { /* ignore parse errors */ }
        sessions.push({
          id: sessionId,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          firstMessage,
        })
      }
    }
    // Sort by mtime descending (newest first)
    sessions.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime())
    return sessions
  } catch {
    return []
  }
})

ipcMain.handle('claude:readSession', async (_, projectName: string, sessionId: string) => {
  try {
    const filePath = path.join(os.homedir(), '.claude', 'projects', projectName, `${sessionId}.jsonl`)
    const content = await fs.promises.readFile(filePath, 'utf-8')
    const lines = content.split('\n').filter(l => l.trim())
    const messages: Array<{
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
    }> = []
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line)
        if (parsed.type === 'user' || parsed.type === 'assistant') {
          messages.push({
            type: parsed.type,
            role: parsed.message?.role,
            content: parsed.message?.content,
            model: parsed.message?.model,
            timestamp: parsed.timestamp,
            usage: parsed.message?.usage,
          })
        }
      } catch { /* skip invalid lines */ }
    }
    return messages
  } catch {
    return []
  }
})

// Claude Plans handlers
ipcMain.handle('claude:listPlans', async () => {
  try {
    const plansDir = path.join(os.homedir(), '.claude', 'plans')
    if (!fs.existsSync(plansDir)) return []
    const entries = await fs.promises.readdir(plansDir)
    const plans: Array<{
      name: string
      title: string
      size: number
      mtime: string
    }> = []
    for (const entry of entries) {
      if (entry.endsWith('.md')) {
        const filePath = path.join(plansDir, entry)
        const stat = await fs.promises.stat(filePath)
        // Read first line for title
        let title = entry.replace('.md', '')
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8')
          const firstLine = content.split('\n').find(l => l.trim())
          if (firstLine) {
            title = firstLine.replace(/^#+\s*/, '').trim()
          }
        } catch { /* ignore */ }
        plans.push({
          name: entry.replace('.md', ''),
          title,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
        })
      }
    }
    plans.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime())
    return plans
  } catch {
    return []
  }
})

ipcMain.handle('claude:readPlan', async (_, planName: string) => {
  try {
    const filePath = path.join(os.homedir(), '.claude', 'plans', `${planName}.md`)
    return await fs.promises.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
})

// Claude Todos handlers
ipcMain.handle('claude:listTodos', async () => {
  try {
    const todosDir = path.join(os.homedir(), '.claude', 'todos')
    if (!fs.existsSync(todosDir)) return []
    const entries = await fs.promises.readdir(todosDir)
    const todos: Array<{
      id: string
      tasks: Array<{
        id: string
        subject: string
        status: string
        description?: string
      }>
      mtime: string
    }> = []
    for (const entry of entries) {
      if (entry.endsWith('.json')) {
        const filePath = path.join(todosDir, entry)
        const stat = await fs.promises.stat(filePath)
        try {
          const content = await fs.promises.readFile(filePath, 'utf-8')
          const tasks = JSON.parse(content)
          // Only include if has tasks
          if (Array.isArray(tasks) && tasks.length > 0) {
            todos.push({
              id: entry.replace('.json', ''),
              tasks: tasks.map((t: { id?: string; subject?: string; status?: string; description?: string }) => ({
                id: t.id || '',
                subject: t.subject || '',
                status: t.status || 'pending',
                description: t.description,
              })),
              mtime: stat.mtime.toISOString(),
            })
          }
        } catch { /* skip invalid */ }
      }
    }
    todos.sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime())
    return todos
  } catch {
    return []
  }
})

// Claude Marketplace handler
function fetchJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: { 'User-Agent': 'myo-node/1.0' },
    }, (res) => {
      let body = ''
      res.on('data', (chunk: Buffer) => { body += chunk.toString() })
      res.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch { reject(new Error('Invalid JSON')) }
      })
    })
    req.on('error', reject)
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')) })
    req.end()
  })
}

ipcMain.handle('claude:fetchMarketplace', async () => {
  const sources = [
    { url: 'https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json', marketplace: 'claude-plugins-official' },
    { url: 'https://raw.githubusercontent.com/anthropics/claude-code/main/.claude-plugin/marketplace.json', marketplace: 'claude-code' },
    { url: 'https://raw.githubusercontent.com/DustyWalker/claude-code-marketplace/main/.claude-plugin/marketplace.json', marketplace: 'claude-code-marketplace' },
  ]

  type PluginEntry = Record<string, unknown> & { name: string; marketplace: string }

  const results = await Promise.allSettled(
    sources.map(async (src) => {
      const data = await fetchJson(src.url) as { plugins?: Array<Record<string, unknown>> }
      return (data.plugins || []).map(p => ({ ...p, marketplace: src.marketplace } as PluginEntry))
    })
  )

  const plugins: PluginEntry[] = []
  const seen = new Set<string>()
  for (const result of results) {
    if (result.status === 'fulfilled') {
      for (const p of result.value) {
        if (!seen.has(p.name)) {
          seen.add(p.name)
          plugins.push(p)
        }
      }
    }
  }
  return plugins
})

// Claude Installed Plugins handler
ipcMain.handle('claude:getInstalledPlugins', async () => {
  const installed: string[] = []
  try {
    // 1. Check ~/.claude/skills/ directory
    const skillsDir = path.join(os.homedir(), '.claude', 'skills')
    if (fs.existsSync(skillsDir)) {
      const entries = await fs.promises.readdir(skillsDir, { withFileTypes: true })
      for (const e of entries) {
        if (e.isDirectory()) installed.push(e.name)
      }
    }

    // 2. Check ~/.claude/manifest.json skills/commands
    try {
      const manifestPath = path.join(os.homedir(), '.claude', 'manifest.json')
      const content = await fs.promises.readFile(manifestPath, 'utf-8')
      const manifest = JSON.parse(content)
      if (manifest.skills) {
        for (const name of Object.keys(manifest.skills)) {
          if (!installed.includes(name)) installed.push(name)
        }
      }
      if (manifest.commands) {
        for (const name of Object.keys(manifest.commands)) {
          if (!installed.includes(name)) installed.push(name)
        }
      }
    } catch { /* no manifest */ }

    // 3. Check ~/.claude/settings.json for mcpServers (matching MCP/LSP plugins)
    try {
      const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
      const content = await fs.promises.readFile(settingsPath, 'utf-8')
      const settings = JSON.parse(content)
      if (settings.mcpServers) {
        for (const name of Object.keys(settings.mcpServers)) {
          if (!installed.includes(name)) installed.push(name)
        }
      }
      // Check for plugins key if it exists
      if (settings.plugins && Array.isArray(settings.plugins)) {
        for (const p of settings.plugins) {
          const pName = typeof p === 'string' ? p : p?.name
          if (pName && !installed.includes(pName)) installed.push(pName)
        }
      }
    } catch { /* no settings */ }
  } catch { /* ignore */ }
  return installed
})

// Claude Keybindings handler
ipcMain.handle('claude:readKeybindings', async () => {
  try {
    const filePath = path.join(os.homedir(), '.claude', 'keybindings.json')
    const content = await fs.promises.readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
})

// Window controls
ipcMain.on('window:minimize', () => mainWindow?.minimize())
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})
ipcMain.on('window:close', () => mainWindow?.close())

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})
