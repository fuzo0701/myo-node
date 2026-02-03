import { app, BrowserWindow, ipcMain, clipboard, dialog } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as pty from 'node-pty'
import * as os from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

let mainWindow: BrowserWindow | null = null
const terminals: Map<number, pty.IPty> = new Map()
const terminalCwds: Map<number, string> = new Map()
let terminalIdCounter = 0

// File watchers
const fileWatchers: Map<string, fs.FSWatcher> = new Map()

function getShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  return process.env.SHELL || '/bin/bash'
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
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    terminals.forEach((term) => term.kill())
    terminals.clear()
    terminalCwds.clear()
  })
}

// Terminal IPC handlers
ipcMain.handle('terminal:create', (_, cols: number, rows: number, cwd?: string) => {
  const id = ++terminalIdCounter
  const shell = getShell()

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

  const term = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: workingDir,
    env: process.env as { [key: string]: string },
  })

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

// Clipboard file operations (Windows-specific using PowerShell)
async function runPowerShell(script: string): Promise<string> {
  // Encode script as Base64 to avoid quoting issues
  // Use -STA flag for clipboard access (requires Single-Threaded Apartment)
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  const { stdout } = await execAsync(`powershell -STA -NoProfile -EncodedCommand ${encoded}`, {
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  })
  return stdout.trim()
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
