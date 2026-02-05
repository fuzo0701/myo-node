import { Theme } from '../store/theme'

interface AnsiStyle {
  bold: boolean
  italic: boolean
  underline: boolean
  dim: boolean
  fgColor: string | null
  bgColor: string | null
}

const ANSI_COLORS_BASIC: Record<number, keyof Theme> = {
  30: 'black', 31: 'red', 32: 'green', 33: 'yellow',
  34: 'blue', 35: 'magenta', 36: 'cyan', 37: 'white',
  90: 'brightBlack', 91: 'brightRed', 92: 'brightGreen', 93: 'brightYellow',
  94: 'brightBlue', 95: 'brightMagenta', 96: 'brightCyan', 97: 'brightWhite',
}

const ANSI_BG_BASIC: Record<number, keyof Theme> = {
  40: 'black', 41: 'red', 42: 'green', 43: 'yellow',
  44: 'blue', 45: 'magenta', 46: 'cyan', 47: 'white',
  100: 'brightBlack', 101: 'brightRed', 102: 'brightGreen', 103: 'brightYellow',
  104: 'brightBlue', 105: 'brightMagenta', 106: 'brightCyan', 107: 'brightWhite',
}

// 256-color lookup (colors 16-231 are a 6x6x6 color cube, 232-255 are grayscale)
function color256ToHex(n: number): string {
  if (n < 16) {
    // Standard colors handled by basic mapping
    const hex = [
      '#000000', '#cd3131', '#0dbc79', '#e5e510', '#2472c8', '#bc3fbc', '#11a8cd', '#e5e5e5',
      '#666666', '#f14c4c', '#23d18b', '#f5f543', '#3b8eea', '#d670d6', '#29b8db', '#ffffff',
    ]
    return hex[n]
  }
  if (n < 232) {
    // 6x6x6 color cube
    const idx = n - 16
    const r = Math.floor(idx / 36)
    const g = Math.floor((idx % 36) / 6)
    const b = idx % 6
    const toHex = (v: number) => (v === 0 ? 0 : 55 + v * 40).toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }
  // Grayscale ramp (232-255)
  const level = 8 + (n - 232) * 10
  const hex = level.toString(16).padStart(2, '0')
  return `#${hex}${hex}${hex}`
}

function parseAnsiParams(params: number[], style: AnsiStyle, theme: Theme): void {
  let i = 0
  while (i < params.length) {
    const p = params[i]
    if (p === 0) {
      style.bold = false; style.italic = false; style.underline = false; style.dim = false
      style.fgColor = null; style.bgColor = null
    } else if (p === 1) { style.bold = true }
    else if (p === 2) { style.dim = true }
    else if (p === 3) { style.italic = true }
    else if (p === 4) { style.underline = true }
    else if (p === 22) { style.bold = false; style.dim = false }
    else if (p === 23) { style.italic = false }
    else if (p === 24) { style.underline = false }
    else if (p === 39) { style.fgColor = null }
    else if (p === 49) { style.bgColor = null }
    else if (ANSI_COLORS_BASIC[p]) {
      style.fgColor = theme[ANSI_COLORS_BASIC[p]] as string
    } else if (ANSI_BG_BASIC[p]) {
      style.bgColor = theme[ANSI_BG_BASIC[p]] as string
    } else if (p === 38 && params[i + 1] === 5) {
      // 256-color foreground
      style.fgColor = color256ToHex(params[i + 2] ?? 0)
      i += 2
    } else if (p === 48 && params[i + 1] === 5) {
      // 256-color background
      style.bgColor = color256ToHex(params[i + 2] ?? 0)
      i += 2
    } else if (p === 38 && params[i + 1] === 2) {
      // 24-bit foreground
      const r = (params[i + 2] ?? 0).toString(16).padStart(2, '0')
      const g = (params[i + 3] ?? 0).toString(16).padStart(2, '0')
      const b = (params[i + 4] ?? 0).toString(16).padStart(2, '0')
      style.fgColor = `#${r}${g}${b}`
      i += 4
    } else if (p === 48 && params[i + 1] === 2) {
      // 24-bit background
      const r = (params[i + 2] ?? 0).toString(16).padStart(2, '0')
      const g = (params[i + 3] ?? 0).toString(16).padStart(2, '0')
      const b = (params[i + 4] ?? 0).toString(16).padStart(2, '0')
      style.bgColor = `#${r}${g}${b}`
      i += 4
    }
    i++
  }
}

function styleToInline(style: AnsiStyle): string {
  const parts: string[] = []
  if (style.bold) parts.push('font-weight:bold')
  if (style.italic) parts.push('font-style:italic')
  if (style.underline) parts.push('text-decoration:underline')
  if (style.dim) parts.push('opacity:0.6')
  if (style.fgColor) parts.push(`color:${style.fgColor}`)
  if (style.bgColor) parts.push(`background-color:${style.bgColor}`)
  return parts.join(';')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// SGR sequence regex: \x1b[ followed by params and ending with m
const SGR_RE = /\x1B\[([0-9;]*)m/g
// Non-SGR escape sequences (cursor movement, etc.) - strip them
// Handles: DEC private mode (\x1b[?25h), CSI sequences (\x1b[2J), OSC (\x1b]...\x07), charset (\x1b(B)
const NON_SGR_RE = /\x1B(?:\[\?[0-9;]*[A-Za-z]|\[[0-9;]*[A-LN-Za-ln-z]|\].*?(?:\x07|\x1B\\)|\([A-Z])/g

export function ansiToHtml(text: string, theme: Theme): string {
  // Strip non-SGR sequences first
  let cleaned = text.replace(NON_SGR_RE, '')
  // Strip carriage returns (terminal line overwrite)
  cleaned = cleaned.replace(/\r/g, '')

  const style: AnsiStyle = {
    bold: false, italic: false, underline: false, dim: false,
    fgColor: null, bgColor: null,
  }

  let result = ''
  let lastIndex = 0

  SGR_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = SGR_RE.exec(cleaned)) !== null) {
    // Add text before this escape
    const before = cleaned.slice(lastIndex, match.index)
    if (before) {
      const inlineStyle = styleToInline(style)
      if (inlineStyle) {
        result += `<span style="${inlineStyle}">${escapeHtml(before)}</span>`
      } else {
        result += escapeHtml(before)
      }
    }

    // Parse and apply SGR params
    const params = match[1] ? match[1].split(';').map(Number) : [0]
    parseAnsiParams(params, style, theme)
    lastIndex = SGR_RE.lastIndex
  }

  // Add remaining text
  const remaining = cleaned.slice(lastIndex)
  if (remaining) {
    const inlineStyle = styleToInline(style)
    if (inlineStyle) {
      result += `<span style="${inlineStyle}">${escapeHtml(remaining)}</span>`
    } else {
      result += escapeHtml(remaining)
    }
  }

  return result
}
