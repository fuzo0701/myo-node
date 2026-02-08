export interface CommandOption {
  label: string
  value: string
  description?: string
}

export interface CommandSuggestion {
  id: string
  label: string
  command: string
  source: 'palette' | 'slash' | 'history'
  description?: string
  category?: 'claude' | 'session' | 'info' | 'config' | 'tools' | 'skill' | 'shell' | 'git' | 'npm'
  icon?: string // emoji icon
  options?: CommandOption[]
}

export const paletteCommands: CommandSuggestion[] = [
  // Claude Launch
  { id: 'p-claude-full', label: 'Claude Code (Full)', command: 'claude --dangerously-skip-permissions', source: 'palette', category: 'claude', description: 'Start Claude with all permissions', icon: '🚀', options: [
    { label: '--chrome', value: 'claude --dangerously-skip-permissions --chrome', description: 'With Chrome browser control' },
    { label: '--resume', value: 'claude --dangerously-skip-permissions --resume', description: 'Resume last session' },
    { label: '--continue', value: 'claude --dangerously-skip-permissions --continue', description: 'Continue last conversation' },
    { label: '--verbose', value: 'claude --dangerously-skip-permissions --verbose', description: 'Verbose output' },
  ]},
  { id: 'p-claude-chrome', label: 'Claude Code + Chrome', command: 'claude --dangerously-skip-permissions --chrome', source: 'palette', category: 'claude', description: 'Start Claude with Chrome browser control', icon: '🌐' },
  { id: 'p-claude-resume', label: 'Claude Code Resume', command: 'claude --resume', source: 'palette', category: 'claude', description: 'Resume last session', icon: '▶️' },
  { id: 'p-claude-continue', label: 'Claude Code Continue', command: 'claude --continue', source: 'palette', category: 'claude', description: 'Continue from last conversation', icon: '➡️' },
  { id: 'p-claude-teams', label: 'Claude Code + Agent Teams', command: '__AGENT_TEAMS__', source: 'palette', category: 'claude', description: 'Enable Agent Teams in settings and start Claude', icon: '👥' },
  { id: 'p-teams-dashboard', label: 'Agent Teams: Show Dashboard', command: '__TEAMS_DASHBOARD__', source: 'palette', category: 'claude', description: 'Toggle Agent Teams dashboard (Ctrl+Shift+D)', icon: '📊' },
  { id: 'p-teams-shutdown', label: 'Agent Teams: Shutdown Team', command: '__TEAMS_SHUTDOWN__', source: 'palette', category: 'claude', description: 'Stop all teammate terminals and clean tabs', icon: '🛑' },
  { id: 'p-task-panel', label: 'Tasks: Toggle Task Panel', command: '__TASK_PANEL__', source: 'palette', category: 'tools', description: 'Toggle TASKS.md monitor panel (Ctrl+Shift+T)', icon: '📋' },
  // Shell
  { id: 'p-ps-exec', label: 'PowerShell: Execution Policy', command: 'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser', source: 'palette', category: 'shell', description: 'Allow script execution', icon: '⚙️' },
  { id: 'p-chcp', label: 'CMD: UTF-8 Encoding', command: 'chcp 65001', source: 'palette', category: 'shell', description: 'Set UTF-8 code page', icon: '🔤' },
  { id: 'p-ps-utf8', label: 'PowerShell: UTF-8 Encoding', command: '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Console]::InputEncoding = [System.Text.Encoding]::UTF8', source: 'palette', category: 'shell', description: 'Set UTF-8 encoding', icon: '🔤' },
  // Git
  { id: 'p-git-status', label: 'Git Status', command: 'git status', source: 'palette', category: 'git', description: 'Show working tree status', icon: '📊' },
  { id: 'p-git-log', label: 'Git Log (oneline)', command: 'git log --oneline -10', source: 'palette', category: 'git', description: 'Show recent commits', icon: '📜' },
  // NPM
  { id: 'p-npm-dev', label: 'NPM Dev', command: 'npm run dev', source: 'palette', category: 'npm', description: 'Run development server', icon: '🔧' },
  { id: 'p-npm-install', label: 'NPM Install', command: 'npm install', source: 'palette', category: 'npm', description: 'Install dependencies', icon: '📦' },
]

export const slashCommands: CommandSuggestion[] = [
  // Info commands
  { id: 's-help', label: '/help', command: '/help', source: 'slash', category: 'info', description: 'Show available commands', icon: '❓' },
  { id: 's-status', label: '/status', command: '/status', source: 'slash', category: 'info', description: 'Show usage status and limits', icon: '📊' },
  { id: 's-cost', label: '/cost', command: '/cost', source: 'slash', category: 'info', description: 'Show session cost breakdown', icon: '💰' },
  { id: 's-context', label: '/context', command: '/context', source: 'slash', category: 'info', description: 'Show current context info', icon: '📋' },
  { id: 's-stats', label: '/stats', command: '/stats', source: 'slash', category: 'info', description: 'Show usage statistics', icon: '📈' },
  { id: 's-doctor', label: '/doctor', command: '/doctor', source: 'slash', category: 'info', description: 'Run diagnostic checks', icon: '🩺' },

  // Session commands
  { id: 's-clear', label: '/clear', command: '/clear', source: 'slash', category: 'session', description: 'Clear conversation history', icon: '🗑️' },
  { id: 's-compact', label: '/compact', command: '/compact', source: 'slash', category: 'session', description: 'Compress conversation to save context', icon: '📦', options: [
    { label: 'with instructions', value: '/compact ', description: 'Compact with custom focus instructions' },
  ]},
  { id: 's-resume', label: '/resume', command: '/resume', source: 'slash', category: 'session', description: 'Resume a previous session', icon: '▶️' },
  { id: 's-undo', label: '/undo', command: '/undo', source: 'slash', category: 'session', description: 'Undo last file change', icon: '↩️' },

  // Config commands
  { id: 's-config', label: '/config', command: '/config', source: 'slash', category: 'config', description: 'Open configuration', icon: '⚙️' },
  { id: 's-model', label: '/model', command: '/model', source: 'slash', category: 'config', description: 'Change AI model', icon: '🤖', options: [
    { label: 'opus', value: '/model opus', description: 'Claude Opus (most capable)' },
    { label: 'sonnet', value: '/model sonnet', description: 'Claude Sonnet (balanced)' },
    { label: 'haiku', value: '/model haiku', description: 'Claude Haiku (fastest)' },
  ]},
  { id: 's-permissions', label: '/permissions', command: '/permissions', source: 'slash', category: 'config', description: 'Set permission mode', icon: '🔐' },
  { id: 's-theme', label: '/theme', command: '/theme', source: 'slash', category: 'config', description: 'Change theme', icon: '🎨' },
  { id: 's-vim', label: '/vim', command: '/vim', source: 'slash', category: 'config', description: 'Toggle vim mode', icon: '⌨️' },
  { id: 's-terminal-setup', label: '/terminal-setup', command: '/terminal-setup', source: 'slash', category: 'config', description: 'Configure terminal settings', icon: '🖥️' },

  // Tools commands
  { id: 's-mcp', label: '/mcp', command: '/mcp', source: 'slash', category: 'tools', description: 'Manage MCP servers', icon: '🔌', options: [
    { label: 'add', value: '/mcp add', description: 'Add a new MCP server' },
    { label: 'remove', value: '/mcp remove', description: 'Remove an MCP server' },
    { label: 'list', value: '/mcp list', description: 'List configured MCP servers' },
  ]},
  { id: 's-memory', label: '/memory', command: '/memory', source: 'slash', category: 'tools', description: 'Auto memory management', icon: '🧠' },
  { id: 's-review', label: '/review', command: '/review', source: 'slash', category: 'tools', description: 'Code review mode', icon: '👀' },
  { id: 's-diff', label: '/diff', command: '/diff', source: 'slash', category: 'tools', description: 'Show recent changes', icon: '📝' },
  { id: 's-init', label: '/init', command: '/init', source: 'slash', category: 'tools', description: 'Initialize project config', icon: '🚀' },
  { id: 's-bug', label: '/bug', command: '/bug', source: 'slash', category: 'tools', description: 'Report a bug', icon: '🐛' },
  { id: 's-install-github-app', label: '/install-github-app', command: '/install-github-app', source: 'slash', category: 'tools', description: 'Install GitHub app', icon: '🐙' },

  // Context commands
  { id: 's-add', label: '/add', command: '/add ', source: 'slash', category: 'tools', description: 'Add file to context', icon: '📎', options: [
    { label: '<file path>', value: '/add ', description: 'Add a file to conversation context' },
  ]},
  { id: 's-add-dir', label: '/add-dir', command: '/add-dir ', source: 'slash', category: 'tools', description: 'Add folder to context', icon: '📂', options: [
    { label: '<folder path>', value: '/add-dir ', description: 'Add entire folder to context' },
  ]},
  { id: 's-pr-comments', label: '/pr-comments', command: '/pr-comments', source: 'slash', category: 'tools', description: 'Analyze PR comments', icon: '💬' },
  { id: 's-hooks', label: '/hooks', command: '/hooks', source: 'slash', category: 'config', description: 'Interactive hooks configuration', icon: '🪝' },

  // Auth / Session commands
  { id: 's-login', label: '/login', command: '/login', source: 'slash', category: 'config', description: 'Log in to Claude', icon: '🔑' },
  { id: 's-logout', label: '/logout', command: '/logout', source: 'slash', category: 'config', description: 'Log out', icon: '🚪' },
  { id: 's-exit', label: '/exit', command: '/exit', source: 'slash', category: 'session', description: 'Exit current session', icon: '🚪' },

  // Skill commands (Claude Code skills)
  { id: 's-commit', label: '/commit', command: '/commit', source: 'slash', category: 'skill', description: 'Commit changes with AI message', icon: '✅', options: [
    { label: '-m "message"', value: '/commit -m "', description: 'Commit with specific message' },
  ]},
  { id: 's-review-pr', label: '/review-pr', command: '/review-pr', source: 'slash', category: 'skill', description: 'Review a pull request', icon: '🔍', options: [
    { label: '<PR number>', value: '/review-pr ', description: 'Review specific PR by number' },
  ]},
  { id: 's-3ds', label: '/3ds', command: '/3ds', source: 'slash', category: 'skill', description: 'Interactive project init & design tokens', icon: '🎯', options: [
    { label: 'new', value: '/3ds new', description: 'Start new project from scratch' },
    { label: 'quick', value: '/3ds quick', description: 'Quick setup with defaults' },
    { label: 'preview', value: '/3ds preview', description: 'Preview current design tokens' },
  ]},
  { id: 's-socrates', label: '/socrates', command: '/socrates', source: 'slash', category: 'skill', description: 'Socratic 1:1 planning consultation', icon: '🏛️' },
  { id: 's-tasks-generator', label: '/tasks-generator', command: '/tasks-generator', source: 'slash', category: 'skill', description: 'Generate or update TASKS.md', icon: '📋', options: [
    { label: 'new', value: '/tasks-generator new', description: 'Generate new TASKS.md' },
    { label: 'update', value: '/tasks-generator update', description: 'Update existing TASKS.md' },
  ]},
  { id: 's-task-done', label: '/task-done', command: '/task-done', source: 'slash', category: 'skill', description: 'Mark task as completed', icon: '☑️', options: [
    { label: '<task ID>', value: '/task-done ', description: 'e.g. /task-done T2.1' },
  ]},
  { id: 's-deep-research', label: '/deep-research', command: '/deep-research', source: 'slash', category: 'skill', description: 'Deep research with parallel search', icon: '🔬' },
  { id: 's-orchestrate', label: '/orchestrate', command: '/orchestrate', source: 'slash', category: 'skill', description: 'Orchestrate expert agents', icon: '🎼' },
  { id: 's-chrome-browser', label: '/chrome-browser', command: '/chrome-browser', source: 'slash', category: 'skill', description: 'Chrome browser automation', icon: '🌐' },
  { id: 's-design-linker', label: '/design-linker', command: '/design-linker', source: 'slash', category: 'skill', description: 'Link design mockups to tasks', icon: '🔗' },
  { id: 's-design-mockup', label: '/design-mockup-analyzer', command: '/design-mockup-analyzer', source: 'slash', category: 'skill', description: 'Analyze design mockups & extract styles', icon: '🎨' },
  { id: 's-project-bootstrap', label: '/project-bootstrap', command: '/project-bootstrap', source: 'slash', category: 'skill', description: 'Generate agent team structure', icon: '🏗️' },
  { id: 's-keybindings', label: '/keybindings-help', command: '/keybindings-help', source: 'slash', category: 'skill', description: 'Customize keyboard shortcuts', icon: '⌨️' },
]

// Category labels and order
export const categoryLabels: Record<string, string> = {
  claude: 'Claude',
  info: 'Info',
  session: 'Session',
  config: 'Config',
  tools: 'Tools',
  skill: 'Skills',
  shell: 'Shell',
  git: 'Git',
  npm: 'NPM',
}

export const categoryOrder = ['claude', 'info', 'session', 'config', 'tools', 'skill', 'shell', 'git', 'npm']
