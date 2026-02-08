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
ipcMain.handle('terminal:create', async (_, cols: number, rows: number, cwd?: string, shellType?: ShellType) => {
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

  // Merge env from ~/.claude/settings.json
  try {
    const settingsPath = path.join(os.homedir(), '.claude', 'settings.json')
    const content = await fs.promises.readFile(settingsPath, 'utf-8')
    const json = JSON.parse(content)
    if (json.env && typeof json.env === 'object') {
      Object.assign(env, json.env)
    }
  } catch { /* settings.json missing or invalid — ignore */ }

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
ipcMain.handle('fs:readDirectory', async (_, dirPath: string, withStats?: boolean) => {
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    if (!withStats) {
      return entries.map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
      }))
    }
    const results = await Promise.all(entries.map(async (entry) => {
      try {
        const fullPath = path.join(dirPath, entry.name)
        const stat = await fs.promises.stat(fullPath)
        return {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' as const : 'file' as const,
          size: stat.size,
          mtime: stat.mtimeMs,
        }
      } catch {
        return { name: entry.name, type: entry.isDirectory() ? 'directory' as const : 'file' as const, size: 0, mtime: 0 }
      }
    }))
    return results
  } catch (error) {
    console.error('Failed to read directory:', error)
    return []
  }
})

ipcMain.handle('fs:listFilesRecursive', async (_, dirPath: string, maxFiles: number = 5000) => {
  const results: string[] = []
  const ignoreDirs = new Set([
    'node_modules', '.git', '.next', '.nuxt', 'dist', 'build', 'out',
    '__pycache__', '.cache', '.vscode', '.idea', 'coverage', '.svn',
    'vendor', 'target', '.gradle', 'bower_components',
  ])
  const normalizedRoot = dirPath.replace(/\\/g, '/')

  async function walk(dir: string) {
    if (results.length >= maxFiles) return
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (results.length >= maxFiles) break
        if (entry.name.startsWith('.') && entry.isDirectory()) continue
        if (ignoreDirs.has(entry.name) && entry.isDirectory()) continue
        const fullPath = path.join(dir, entry.name).replace(/\\/g, '/')
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else {
          results.push(fullPath.slice(normalizedRoot.length + 1))
        }
      }
    } catch { /* permission errors etc. */ }
  }

  await walk(dirPath)
  return results
})

ipcMain.handle('fs:searchInFiles', async (_, dirPath: string, query: string, maxResults: number = 200) => {
  const results: Array<{ file: string; line: number; text: string }> = []
  const ignoreDirs = new Set([
    'node_modules', '.git', '.next', '.nuxt', 'dist', 'build', 'out',
    '__pycache__', '.cache', '.vscode', '.idea', 'coverage', '.svn',
    'vendor', 'target', '.gradle', 'bower_components',
  ])
  const binaryExts = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'webp', 'svg',
    'woff', 'woff2', 'ttf', 'eot', 'otf',
    'zip', 'tar', 'gz', 'rar', '7z',
    'exe', 'dll', 'so', 'dylib', 'bin',
    'pdf', 'doc', 'docx', 'xls', 'xlsx',
    'mp3', 'mp4', 'wav', 'avi', 'mov',
    'sqlite', 'db', 'lock',
  ])
  const normalizedRoot = dirPath.replace(/\\/g, '/')
  const queryLower = query.toLowerCase()

  async function walk(dir: string) {
    if (results.length >= maxResults) return
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (results.length >= maxResults) break
        if (entry.name.startsWith('.') && entry.isDirectory()) continue
        if (ignoreDirs.has(entry.name) && entry.isDirectory()) continue
        const fullPath = path.join(dir, entry.name).replace(/\\/g, '/')
        if (entry.isDirectory()) {
          await walk(fullPath)
        } else {
          const ext = entry.name.split('.').pop()?.toLowerCase() || ''
          if (binaryExts.has(ext)) continue
          try {
            const stat = await fs.promises.stat(fullPath)
            if (stat.size > 512 * 1024) continue // Skip files > 512KB
            const content = await fs.promises.readFile(fullPath, 'utf-8')
            const lines = content.split('\n')
            for (let i = 0; i < lines.length && results.length < maxResults; i++) {
              if (lines[i].toLowerCase().includes(queryLower)) {
                results.push({
                  file: fullPath.slice(normalizedRoot.length + 1),
                  line: i + 1,
                  text: lines[i].trim().slice(0, 200),
                })
              }
            }
          } catch { /* read error, skip */ }
        }
      }
    } catch { /* permission errors etc. */ }
  }

  await walk(dirPath)
  return results
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
    const watcher = fs.watch(dirPath, { persistent: false, recursive: true }, (eventType, filename) => {
      // Send to renderer
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

ipcMain.handle('git:getBranch', async (_, dirPath: string) => {
  try {
    const { stdout } = await execAsync('git branch --show-current', {
      cwd: dirPath,
      timeout: 5000,
    })
    return stdout.trim() || null
  } catch {
    return null
  }
})

ipcMain.handle('git:getIgnored', async (_, repoRoot: string) => {
  try {
    const { stdout } = await execAsync('git ls-files --others --ignored --exclude-standard --directory', {
      cwd: repoRoot,
      timeout: 10000,
      maxBuffer: 1024 * 1024,
    })
    // Returns relative paths, one per line; directories end with /
    return stdout.split('\n').filter(Boolean).map(p => p.replace(/\/$/, ''))
  } catch {
    return []
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
    const skills: { name: string; description: string; commands: string[] }[] = []
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md')
        try {
          const content = await fs.promises.readFile(skillMdPath, 'utf-8')
          // Parse frontmatter description
          let description = ''
          const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)
          if (fmMatch) {
            const descMatch = fmMatch[1].match(/description:\s*(.+)/)
            if (descMatch) description = descMatch[1].trim()
          }
          if (!description) {
            description = content.split('\n').find(l => l.trim() && !l.startsWith('---')) || ''
          }
          // Parse trigger commands from ## Trigger section
          const commands: string[] = []
          const triggerMatch = content.match(/## Trigger\s*\n([\s\S]*?)(?=\n## |\n---|$)/)
          if (triggerMatch) {
            const triggerBlock = triggerMatch[1]
            const lines = triggerBlock.split('\n')
            for (const line of lines) {
              // Match "- `/command`" or "- /command" patterns
              const cmdMatch = line.match(/^-\s+`?(\/\S+)`?/)
              if (cmdMatch) {
                commands.push(cmdMatch[1])
                continue
              }
              // Match "/command args" inside code blocks
              const codeMatch = line.match(/^\s*(\/\S+(?:\s+\S+)*)/)
              if (codeMatch && !line.startsWith('#') && !line.startsWith('```')) {
                commands.push(codeMatch[1])
              }
            }
          }
          // Fallback: extract slash commands from description
          if (commands.length === 0) {
            const slashCmds = description.match(/"(\/\S+)"/g)
            if (slashCmds) {
              for (const m of slashCmds) commands.push(m.replace(/"/g, ''))
            }
          }
          // Deduplicate
          const uniqueCommands = [...new Set(commands)]
          skills.push({ name: entry.name, description, commands: uniqueCommands })
        } catch {
          skills.push({ name: entry.name, description: '', commands: [] })
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

// Skill Store: fetch with custom headers (text + JSON support)
function fetchWithHeaders(url: string, headers?: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url)
    const req = https.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || undefined,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: { 'User-Agent': 'myo-node/1.0', ...headers },
    }, (res) => {
      let body = ''
      res.on('data', (chunk: Buffer) => { body += chunk.toString() })
      res.on('end', () => resolve(body))
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')) })
    req.end()
  })
}

const skillSourcesPath = path.join(os.homedir(), '.claude', 'skill-sources.json')

ipcMain.handle('claude:readSkillSources', async () => {
  try {
    const content = await fs.promises.readFile(skillSourcesPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
})

ipcMain.handle('claude:writeSkillSources', async (_, sources: unknown[]) => {
  try {
    await fs.promises.mkdir(path.dirname(skillSourcesPath), { recursive: true })
    await fs.promises.writeFile(skillSourcesPath, JSON.stringify(sources, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
})

ipcMain.handle('claude:fetchRemoteSkills', async () => {
  try {
    const content = await fs.promises.readFile(skillSourcesPath, 'utf-8')
    const sources = JSON.parse(content) as Array<{ url: string; project: string; token: string; branch: string }>
    if (!sources.length) return {}

    const src = sources[0]
    const projectEncoded = encodeURIComponent(src.project)
    const apiUrl = `${src.url}/api/v4/projects/${projectEncoded}/repository/files/manifest.json/raw?ref=${src.branch}`
    const body = await fetchWithHeaders(apiUrl, { 'PRIVATE-TOKEN': src.token })
    const manifest = JSON.parse(body) as { skills: Record<string, { description: string; version: string; dependencies: string[] }> }
    return manifest.skills || {}
  } catch (err) {
    console.error('fetchRemoteSkills error:', err)
    return {}
  }
})

function resolveDependencies(
  skillName: string,
  manifest: Record<string, { dependencies?: string[] }>,
  resolved: Set<string> = new Set(),
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(skillName)) return [...resolved]
  visited.add(skillName)

  const skill = manifest[skillName]
  if (!skill) return [...resolved]

  for (const dep of skill.dependencies || []) {
    if (!resolved.has(dep)) {
      resolveDependencies(dep, manifest, resolved, visited)
    }
  }
  resolved.add(skillName)
  return [...resolved]
}

ipcMain.handle('claude:installRemoteSkill', async (_, skillName: string, forceReinstall?: boolean) => {
  const installed: string[] = []
  const skipped: string[] = []
  const errors: string[] = []

  try {
    const content = await fs.promises.readFile(skillSourcesPath, 'utf-8')
    const sources = JSON.parse(content) as Array<{ url: string; project: string; token: string; branch: string }>
    if (!sources.length) { errors.push('No skill sources configured'); return { installed, skipped, errors } }

    const src = sources[0]
    const projectEncoded = encodeURIComponent(src.project)
    const headers = { 'PRIVATE-TOKEN': src.token }

    // Fetch manifest
    const manifestUrl = `${src.url}/api/v4/projects/${projectEncoded}/repository/files/manifest.json/raw?ref=${src.branch}`
    const manifestBody = await fetchWithHeaders(manifestUrl, headers)
    const manifest = JSON.parse(manifestBody) as { skills: Record<string, { dependencies?: string[] }> }

    // Resolve dependencies
    const toInstall = resolveDependencies(skillName, manifest.skills)

    for (const name of toInstall) {
      const skillDir = path.join(os.homedir(), '.claude', 'skills', name)

      // Check if already installed
      if (!forceReinstall) {
        try {
          await fs.promises.access(skillDir)
          skipped.push(name)
          continue
        } catch { /* not installed, proceed */ }
      }

      try {
        // Get file tree for this skill
        const treeUrl = `${src.url}/api/v4/projects/${projectEncoded}/repository/tree?path=${encodeURIComponent(name)}&recursive=true&ref=${src.branch}`
        const treeBody = await fetchWithHeaders(treeUrl, headers)
        const tree = JSON.parse(treeBody) as Array<{ path: string; type: string }>

        const blobs = tree.filter(item => item.type === 'blob')
        if (blobs.length === 0) {
          errors.push(`${name}: no files found`)
          continue
        }

        // Download and save each file
        for (const blob of blobs) {
          const fileUrl = `${src.url}/api/v4/projects/${projectEncoded}/repository/files/${encodeURIComponent(blob.path)}/raw?ref=${src.branch}`
          const fileContent = await fetchWithHeaders(fileUrl, headers)

          // blob.path is like "skillName/SKILL.md" or "skillName/stages/stage1.md"
          // We want to save to ~/.claude/skills/skillName/...
          const relativePath = blob.path.startsWith(name + '/') ? blob.path.slice(name.length + 1) : blob.path
          const destPath = path.join(skillDir, relativePath)
          await fs.promises.mkdir(path.dirname(destPath), { recursive: true })
          await fs.promises.writeFile(destPath, fileContent, 'utf-8')
        }

        installed.push(name)
      } catch (err) {
        errors.push(`${name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  } catch (err) {
    errors.push(`Setup error: ${err instanceof Error ? err.message : String(err)}`)
  }

  return { installed, skipped, errors }
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

// Claude Model config handlers
ipcMain.handle('claude:readModelConfig', async () => {
  try {
    const configPath = path.join(os.homedir(), '.claude', 'settings.json')
    const content = await fs.promises.readFile(configPath, 'utf-8')
    const json = JSON.parse(content)
    const env = (json.env || {}) as Record<string, string>
    return {
      model: (json.model as string) || '',
      maxOutputTokens: env.CLAUDE_CODE_MAX_OUTPUT_TOKENS || '',
      maxThinkingTokens: env.MAX_THINKING_TOKENS || '',
      effortLevel: env.CLAUDE_CODE_EFFORT_LEVEL || '',
    }
  } catch {
    return { model: '', maxOutputTokens: '', maxThinkingTokens: '', effortLevel: '' }
  }
})

ipcMain.handle('claude:writeModelConfig', async (_, config: { model: string; maxOutputTokens: string; maxThinkingTokens: string; effortLevel: string }) => {
  try {
    const configPath = path.join(os.homedir(), '.claude', 'settings.json')
    let existing: Record<string, unknown> = {}
    try {
      const content = await fs.promises.readFile(configPath, 'utf-8')
      existing = JSON.parse(content)
    } catch { /* file doesn't exist */ }

    // Handle model
    if (config.model) {
      existing.model = config.model
    } else {
      delete existing.model
    }

    // Handle env vars
    if (!existing.env || typeof existing.env !== 'object') {
      existing.env = {}
    }
    const env = existing.env as Record<string, string>

    // CLAUDE_CODE_MAX_OUTPUT_TOKENS
    if (config.maxOutputTokens) {
      env.CLAUDE_CODE_MAX_OUTPUT_TOKENS = config.maxOutputTokens
    } else {
      delete env.CLAUDE_CODE_MAX_OUTPUT_TOKENS
    }

    // MAX_THINKING_TOKENS
    if (config.maxThinkingTokens) {
      env.MAX_THINKING_TOKENS = config.maxThinkingTokens
    } else {
      delete env.MAX_THINKING_TOKENS
    }

    // CLAUDE_CODE_EFFORT_LEVEL
    if (config.effortLevel) {
      env.CLAUDE_CODE_EFFORT_LEVEL = config.effortLevel
    } else {
      delete env.CLAUDE_CODE_EFFORT_LEVEL
    }

    // Clean up empty env
    if (Object.keys(env).length === 0) {
      delete existing.env
    }

    await fs.promises.mkdir(path.dirname(configPath), { recursive: true })
    await fs.promises.writeFile(configPath, JSON.stringify(existing, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
})

// Claude Agent Teams config handlers
ipcMain.handle('claude:readAgentTeamsConfig', async () => {
  try {
    const configPath = path.join(os.homedir(), '.claude', 'settings.json')
    const content = await fs.promises.readFile(configPath, 'utf-8')
    const json = JSON.parse(content)
    return {
      enabled: json.env?.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS === '1',
      teammateMode: json.teammateMode || 'auto',
    }
  } catch {
    return { enabled: false, teammateMode: 'auto' }
  }
})

ipcMain.handle('claude:writeAgentTeamsConfig', async (_, config: { enabled: boolean; teammateMode: string }) => {
  try {
    const configPath = path.join(os.homedir(), '.claude', 'settings.json')
    let existing: Record<string, unknown> = {}
    try {
      const content = await fs.promises.readFile(configPath, 'utf-8')
      existing = JSON.parse(content)
    } catch { /* file doesn't exist */ }

    // Handle env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
    if (config.enabled) {
      if (!existing.env || typeof existing.env !== 'object') {
        existing.env = {}
      }
      (existing.env as Record<string, string>).CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS = '1'
    } else {
      if (existing.env && typeof existing.env === 'object') {
        delete (existing.env as Record<string, string>).CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS
        if (Object.keys(existing.env as Record<string, string>).length === 0) {
          delete existing.env
        }
      }
    }

    // Handle teammateMode
    if (config.teammateMode && config.teammateMode !== 'auto') {
      existing.teammateMode = config.teammateMode
    } else {
      delete existing.teammateMode
    }

    await fs.promises.mkdir(path.dirname(configPath), { recursive: true })
    await fs.promises.writeFile(configPath, JSON.stringify(existing, null, 2), 'utf-8')
    return true
  } catch {
    return false
  }
})

// Claude Auth status handler
ipcMain.handle('claude:getAuthStatus', async () => {
  try {
    const credPath = path.join(os.homedir(), '.claude', '.credentials.json')
    const content = await fs.promises.readFile(credPath, 'utf-8')
    const json = JSON.parse(content)
    const oauth = json.claudeAiOauth
    if (!oauth || !oauth.accessToken) return { loggedIn: false, subscriptionType: '', expiresAt: 0 }
    return {
      loggedIn: true,
      subscriptionType: oauth.subscriptionType || '',
      expiresAt: oauth.expiresAt || 0,
    }
  } catch {
    return { loggedIn: false, subscriptionType: '', expiresAt: 0 }
  }
})

// Claude global input history handler
ipcMain.handle('claude:readInputHistory', async (_, limit?: number) => {
  try {
    const histPath = path.join(os.homedir(), '.claude', 'history.jsonl')
    const content = await fs.promises.readFile(histPath, 'utf-8')
    const lines = content.trim().split('\n').filter(Boolean)
    const entries: Array<{ display: string; timestamp: number; project: string; sessionId: string }> = []
    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        if (obj.display) entries.push({
          display: obj.display.trim(),
          timestamp: obj.timestamp || 0,
          project: obj.project || '',
          sessionId: obj.sessionId || '',
        })
      } catch { /* skip malformed lines */ }
    }
    // Sort newest first
    entries.sort((a, b) => b.timestamp - a.timestamp)
    return limit ? entries.slice(0, limit) : entries
  } catch {
    return []
  }
})

// Claude manifest (command registry) handler
ipcMain.handle('claude:readManifest', async () => {
  try {
    const manifestPath = path.join(os.homedir(), '.claude', 'manifest.json')
    const content = await fs.promises.readFile(manifestPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
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

// Agent Teams monitoring handlers
const agentTeamsWatchers: Map<string, fs.FSWatcher> = new Map()

ipcMain.handle('agentTeams:list', async () => {
  try {
    const teamsDir = path.join(os.homedir(), '.claude', 'teams')
    if (!fs.existsSync(teamsDir)) return []
    const entries = await fs.promises.readdir(teamsDir, { withFileTypes: true })
    return entries.filter(e => e.isDirectory()).map(e => e.name)
  } catch {
    return []
  }
})

ipcMain.handle('agentTeams:getInfo', async (_, teamName: string) => {
  try {
    const teamsDir = path.join(os.homedir(), '.claude', 'teams')
    const configPath = path.join(teamsDir, teamName, 'config.json')

    // Read team config
    let members: Array<{ name: string; agentId: string; agentType: string; model?: string; color?: string }> = []
    try {
      const content = await fs.promises.readFile(configPath, 'utf-8')
      const json = JSON.parse(content)
      if (Array.isArray(json.members)) {
        members = json.members.map((m: Record<string, unknown>) => ({
          name: String(m.name || ''),
          agentId: String(m.agentId || m.agent_id || ''),
          agentType: String(m.agentType || m.agent_type || 'teammate'),
          model: m.model ? String(m.model) : undefined,
          color: m.color ? String(m.color) : undefined,
        }))
      }
    } catch { /* config missing or invalid */ }

    // Read tasks
    const tasks: Array<{ id: string; subject: string; status: string; assignee?: string; blockedBy?: string[] }> = []
    try {
      const tasksDir = path.join(os.homedir(), '.claude', 'tasks', teamName)
      if (fs.existsSync(tasksDir)) {
        const taskFiles = await fs.promises.readdir(tasksDir)
        for (const file of taskFiles) {
          if (!file.endsWith('.json')) continue
          try {
            const taskContent = await fs.promises.readFile(path.join(tasksDir, file), 'utf-8')
            const taskJson = JSON.parse(taskContent)
            // Defensive: handle both single task object and array
            const taskItems = Array.isArray(taskJson) ? taskJson : [taskJson]
            for (const t of taskItems) {
              tasks.push({
                id: String(t.id || file.replace('.json', '')),
                subject: String(t.subject || t.title || ''),
                status: String(t.status || 'pending'),
                assignee: t.assignee ? String(t.assignee) : undefined,
                blockedBy: Array.isArray(t.blockedBy) ? t.blockedBy.map(String) : undefined,
              })
            }
          } catch { /* skip invalid task file */ }
        }
      }
    } catch { /* tasks dir missing */ }

    // Read inbox messages
    const messages: Array<{ from: string; text: string; summary?: string; timestamp: number; color?: string; read: boolean }> = []
    try {
      const inboxDir = path.join(teamsDir, teamName, 'inboxes')
      if (fs.existsSync(inboxDir)) {
        const inboxFiles = await fs.promises.readdir(inboxDir)
        for (const file of inboxFiles) {
          if (!file.endsWith('.json')) continue
          try {
            const msgContent = await fs.promises.readFile(path.join(inboxDir, file), 'utf-8')
            const msgJson = JSON.parse(msgContent)
            const msgItems = Array.isArray(msgJson) ? msgJson : [msgJson]
            for (const msg of msgItems) {
              messages.push({
                from: String(msg.from || msg.sender || ''),
                text: String(msg.text || msg.message || msg.content || ''),
                summary: msg.summary ? String(msg.summary) : undefined,
                timestamp: Number(msg.timestamp || msg.time || Date.now()),
                color: msg.color ? String(msg.color) : undefined,
                read: Boolean(msg.read),
              })
            }
          } catch { /* skip invalid inbox file */ }
        }
        // Sort messages by timestamp descending (newest first)
        messages.sort((a, b) => b.timestamp - a.timestamp)
      }
    } catch { /* inboxes dir missing */ }

    return { teamName, members, tasks, messages }
  } catch {
    return null
  }
})

ipcMain.handle('agentTeams:watch', async () => {
  // Already watching
  if (agentTeamsWatchers.size > 0) return true

  const teamsDir = path.join(os.homedir(), '.claude', 'teams')
  const tasksDir = path.join(os.homedir(), '.claude', 'tasks')

  const startWatcher = (dir: string, label: string) => {
    try {
      // Ensure directory exists before watching
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const watcher = fs.watch(dir, { persistent: false, recursive: true }, (_eventType, filename) => {
        // Extract team name from filename (e.g., "team-name/config.json" → "team-name")
        const teamName = filename ? filename.split(/[\\/]/)[0] : ''
        mainWindow?.webContents.send('agentTeams:changed', teamName)
      })
      watcher.on('error', (err) => {
        console.error(`Agent teams watcher error (${label}):`, err)
        agentTeamsWatchers.delete(label)
      })
      agentTeamsWatchers.set(label, watcher)
    } catch (err) {
      console.error(`Failed to watch ${label}:`, err)
    }
  }

  startWatcher(teamsDir, 'teams')
  startWatcher(tasksDir, 'tasks')
  return true
})

ipcMain.handle('agentTeams:unwatch', async () => {
  for (const [key, watcher] of agentTeamsWatchers) {
    watcher.close()
    agentTeamsWatchers.delete(key)
  }
  return true
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
