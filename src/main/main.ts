import { app, BrowserWindow, ipcMain } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import * as pty from 'node-pty'
import * as os from 'os'

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
    mainWindow.loadURL('http://localhost:5173')
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
