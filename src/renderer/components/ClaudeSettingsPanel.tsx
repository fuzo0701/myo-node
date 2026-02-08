import { useState, useEffect, useCallback } from 'react'

interface ClaudeSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  projectPath?: string
  onSendCommand?: (command: string) => void
}

type PanelTab = 'skills' | 'mcp' | 'plugins' | 'teams' | 'model'
type Mode = 'list' | 'edit' | 'create'
type Scope = 'global' | 'project'

interface SkillItem {
  name: string
  description: string
  commands: string[]
}

interface McpServer {
  command: string
  args?: string[]
  env?: Record<string, string>
}

const Icons = {
  plus: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  trash: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19,6v14a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2" />
    </svg>
  ),
  back: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  refresh: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  ),
  skill: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  mcp: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="6" height="6" rx="1" />
      <rect x="16" y="2" width="6" height="6" rx="1" />
      <rect x="9" y="16" width="6" height="6" rx="1" />
      <path d="M5 8v3a3 3 0 003 3h8a3 3 0 003-3V8" />
      <line x1="12" y1="14" x2="12" y2="16" />
    </svg>
  ),
  plugin: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
    </svg>
  ),
  copy: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  download: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  link: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  ),
  search: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  teams: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  model: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
}

const ALL_CATEGORIES = ['all', 'development', 'productivity', 'security', 'learning', 'testing', 'database', 'design', 'deployment', 'monitoring'] as const

interface TeamTemplate {
  id: string
  name: string
  icon: string
  description: string
  members: number
  roles: string[]
  prompt: string  // instruction text sent to Claude to configure the team
}

const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    id: 'security-audit',
    name: 'Security Audit',
    icon: '🔒',
    description: 'Vulnerability scanning, dependency audit, and OWASP review',
    members: 3,
    roles: ['Lead Auditor', 'Dependency Scanner', 'OWASP Reviewer'],
    prompt: 'Create a team of 3 agents for security audit: 1) Lead Auditor who coordinates and reviews findings, 2) Dependency Scanner who checks for vulnerable packages and outdated dependencies, 3) OWASP Reviewer who checks for common web vulnerabilities. Start scanning this project.',
  },
  {
    id: 'fullstack-dev',
    name: 'Full-Stack Dev',
    icon: '🚀',
    description: 'Frontend, backend, and testing agents working in parallel',
    members: 3,
    roles: ['Frontend Dev', 'Backend Dev', 'Test Engineer'],
    prompt: 'Create a team of 3 agents for full-stack development: 1) Frontend Dev for UI components and styling, 2) Backend Dev for API endpoints and data logic, 3) Test Engineer who writes tests for both frontend and backend. Coordinate their work on the current task.',
  },
  {
    id: 'code-review',
    name: 'Code Review',
    icon: '👀',
    description: 'Architecture review, bug detection, and performance analysis',
    members: 3,
    roles: ['Architecture Reviewer', 'Bug Detective', 'Performance Analyst'],
    prompt: 'Create a team of 3 agents for code review: 1) Architecture Reviewer who examines code structure and design patterns, 2) Bug Detective who identifies potential bugs, edge cases, and error handling issues, 3) Performance Analyst who checks for bottlenecks and optimization opportunities. Review the current codebase.',
  },
  {
    id: 'refactor',
    name: 'Refactoring',
    icon: '🔧',
    description: 'Code cleanup, type safety, and documentation',
    members: 2,
    roles: ['Refactorer', 'Type Safety & Docs'],
    prompt: 'Create a team of 2 agents for refactoring: 1) Refactorer who improves code structure, extracts reusable functions, and removes duplication, 2) Type Safety & Docs agent who adds proper TypeScript types and essential documentation. Work on the current project.',
  },
]

export default function ClaudeSettingsPanel({ isOpen, onClose, projectPath, onSendCommand }: ClaudeSettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('skills')
  const [mode, setMode] = useState<Mode>('list')

  // Skills state
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [editingSkillName, setEditingSkillName] = useState('')
  const [editingSkillContent, setEditingSkillContent] = useState('')
  const [newSkillName, setNewSkillName] = useState('')

  // MCP state
  const [mcpScope, setMcpScope] = useState<Scope>('global')
  const [servers, setServers] = useState<Record<string, McpServer>>({})
  const [mcpLoading, setMcpLoading] = useState(false)
  const [editingServerName, setEditingServerName] = useState('')
  const [newServerName, setNewServerName] = useState('')
  const [command, setCommand] = useState('')
  const [argsText, setArgsText] = useState('')
  const [envPairs, setEnvPairs] = useState<Array<{ key: string; value: string }>>([])

  // Plugins state
  const [plugins, setPlugins] = useState<MarketplacePlugin[]>([])
  const [pluginsLoading, setPluginsLoading] = useState(false)
  const [pluginsError, setPluginsError] = useState<string | null>(null)
  const [pluginSearch, setPluginSearch] = useState('')
  const [pluginCategory, setPluginCategory] = useState<string>('all')
  const [installedPlugins, setInstalledPlugins] = useState<Set<string>>(new Set())

  // Teams state
  const [teamsEnabled, setTeamsEnabled] = useState(false)
  const [teammateMode, setTeammateMode] = useState<string>('auto')
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  // Skill Store state
  const [skillView, setSkillView] = useState<'local' | 'store'>('local')
  const [remoteSkills, setRemoteSkills] = useState<Record<string, RemoteSkillInfo>>({})
  const [storeLoading, setStoreLoading] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installResult, setInstallResult] = useState<{ installed: string[]; skipped: string[]; errors: string[] } | null>(null)
  const [skillSources, setSkillSources] = useState<SkillSource[]>([])
  const [editingSource, setEditingSource] = useState(false)
  const [sourceForm, setSourceForm] = useState<SkillSource>({ name: 'My Skills', url: '', project: '', token: '', branch: 'main' })

  // Model config state
  const [modelName, setModelName] = useState('')
  const [maxOutputTokens, setMaxOutputTokens] = useState('')
  const [maxThinkingTokens, setMaxThinkingTokens] = useState('')
  const [effortLevel, setEffortLevel] = useState('')
  const [modelLoading, setModelLoading] = useState(false)

  // Reset mode when switching tabs
  const handleTabChange = (tab: PanelTab) => {
    setActiveTab(tab)
    setMode('list')
  }

  // === Skills Logic ===
  const loadSkills = useCallback(async () => {
    setSkillsLoading(true)
    const list = await window.claude?.listSkills() || []
    setSkills(list)
    setSkillsLoading(false)
  }, [])

  const handleEditSkill = async (name: string) => {
    const content = await window.claude?.readSkill(name)
    setEditingSkillName(name)
    setEditingSkillContent(content || '')
    setMode('edit')
  }

  const handleCreateSkill = () => {
    setNewSkillName('')
    setEditingSkillContent('')
    setMode('create')
  }

  const handleSaveSkill = async () => {
    const name = mode === 'create' ? newSkillName.trim() : editingSkillName
    if (!name) return
    await window.claude?.writeSkill(name, editingSkillContent)
    await loadSkills()
    setMode('list')
  }

  const handleDeleteSkill = async (name: string) => {
    if (!confirm(`Delete skill "${name}"?`)) return
    await window.claude?.deleteSkill(name)
    await loadSkills()
  }

  const handleCloneSkill = async (name: string) => {
    const content = await window.claude?.readSkill(name)
    if (content == null) return
    let cloneName = `${name}-copy`
    let i = 2
    while (skills.some(s => s.name === cloneName)) {
      cloneName = `${name}-copy-${i++}`
    }
    await window.claude?.writeSkill(cloneName, content)
    await loadSkills()
  }

  // === MCP Logic ===
  const loadServers = useCallback(async () => {
    setMcpLoading(true)
    const result = await window.claude?.readMcpConfig(mcpScope, projectPath) as Record<string, McpServer> | undefined
    setServers(result || {})
    setMcpLoading(false)
  }, [mcpScope, projectPath])

  const handleEditServer = (name: string) => {
    const server = servers[name]
    if (!server) return
    setEditingServerName(name)
    setCommand(server.command || '')
    setArgsText((server.args || []).join('\n'))
    setEnvPairs(
      Object.entries(server.env || {}).map(([key, value]) => ({ key, value }))
    )
    setMode('edit')
  }

  const handleCreateServer = () => {
    setNewServerName('')
    setCommand('')
    setArgsText('')
    setEnvPairs([])
    setMode('create')
  }

  const handleSaveServer = async () => {
    const name = mode === 'create' ? newServerName.trim() : editingServerName
    if (!name || !command.trim()) return

    const args = argsText.split('\n').filter(l => l.trim())
    const env: Record<string, string> = {}
    envPairs.forEach(p => {
      if (p.key.trim()) env[p.key.trim()] = p.value
    })

    const newServer: McpServer = { command: command.trim() }
    if (args.length > 0) newServer.args = args
    if (Object.keys(env).length > 0) newServer.env = env

    const updated = { ...servers, [name]: newServer }
    await window.claude?.writeMcpConfig(mcpScope, updated, projectPath)
    await loadServers()
    setMode('list')
  }

  const handleDeleteServer = async (name: string) => {
    if (!confirm(`Delete MCP server "${name}"?`)) return
    const updated = { ...servers }
    delete updated[name]
    await window.claude?.writeMcpConfig(mcpScope, updated, projectPath)
    await loadServers()
  }

  const addEnvPair = () => setEnvPairs(prev => [...prev, { key: '', value: '' }])
  const removeEnvPair = (index: number) => setEnvPairs(prev => prev.filter((_, i) => i !== index))
  const updateEnvPair = (index: number, field: 'key' | 'value', val: string) => {
    setEnvPairs(prev => prev.map((p, i) => i === index ? { ...p, [field]: val } : p))
  }

  // === Plugins Logic ===
  const inferPluginType = (p: MarketplacePlugin): 'LSP' | 'Hook' | 'Skill' => {
    if (p.lspServers || p.name.endsWith('-lsp')) return 'LSP'
    const desc = (p.description || '').toLowerCase()
    const name = p.name.toLowerCase()
    if (name.includes('hook') || desc.includes('hook that') || desc.includes('hook to')) return 'Hook'
    return 'Skill'
  }

  const loadPlugins = useCallback(async () => {
    setPluginsLoading(true)
    setPluginsError(null)
    try {
      const [list, installed] = await Promise.all([
        window.claude?.fetchMarketplace() || [],
        window.claude?.getInstalledPlugins() || [],
      ])
      setPlugins(list)
      setInstalledPlugins(new Set(installed.map(n => n.toLowerCase())))
    } catch {
      setPluginsError('Failed to load marketplace')
    }
    setPluginsLoading(false)
  }, [])

  const isPluginInstalled = (name: string) => installedPlugins.has(name.toLowerCase())

  const filteredPlugins = plugins.filter(p => {
    const matchSearch = !pluginSearch ||
      p.name.toLowerCase().includes(pluginSearch.toLowerCase()) ||
      p.description?.toLowerCase().includes(pluginSearch.toLowerCase())
    const matchCategory = pluginCategory === 'all' || p.category === pluginCategory
    return matchSearch && matchCategory
  })

  const handleInstallPlugin = (plugin: MarketplacePlugin) => {
    const cmd = `/plugin install ${plugin.name}@${plugin.marketplace}`
    onSendCommand?.(cmd)
  }

  // === Teams Logic ===
  const loadTeamsConfig = useCallback(async () => {
    setTeamsLoading(true)
    try {
      const config = await window.claude?.readAgentTeamsConfig()
      if (config) {
        setTeamsEnabled(config.enabled)
        setTeammateMode(config.teammateMode || 'auto')
      }
    } catch { /* ignore */ }
    setTeamsLoading(false)
  }, [])

  const saveTeamsConfig = useCallback(async (enabled: boolean, mode: string) => {
    await window.claude?.writeAgentTeamsConfig({ enabled, teammateMode: mode })
  }, [])

  const handleTeamsToggle = async (enabled: boolean) => {
    setTeamsEnabled(enabled)
    await saveTeamsConfig(enabled, teammateMode)
  }

  const handleTeammateModeChange = async (mode: string) => {
    setTeammateMode(mode)
    await saveTeamsConfig(teamsEnabled, mode)
  }

  // === Model Config Logic ===
  const loadModelConfig = useCallback(async () => {
    setModelLoading(true)
    try {
      const config = await window.claude?.readModelConfig()
      if (config) {
        setModelName(config.model || '')
        setMaxOutputTokens(config.maxOutputTokens || '')
        setMaxThinkingTokens(config.maxThinkingTokens || '')
        setEffortLevel(config.effortLevel || '')
      }
    } catch { /* ignore */ }
    setModelLoading(false)
  }, [])

  const saveModelConfig = useCallback(async (
    model: string, outputTokens: string, thinkingTokens: string, effort: string
  ) => {
    await window.claude?.writeModelConfig({
      model, maxOutputTokens: outputTokens, maxThinkingTokens: thinkingTokens, effortLevel: effort,
    })
  }, [])

  const handleModelChange = async (model: string) => {
    setModelName(model)
    await saveModelConfig(model, maxOutputTokens, maxThinkingTokens, effortLevel)
  }

  const contextSuffixRegex = /\[\d+m\]$/
  const getBaseModel = (m: string) => m.replace(contextSuffixRegex, '')
  const getContextSuffix = (m: string) => { const match = m.match(contextSuffixRegex); return match ? match[0] : '' }

  const handleContextChange = async (suffix: string) => {
    const base = getBaseModel(modelName) || 'opus'
    const newModel = suffix ? `${base}${suffix}` : base
    setModelName(newModel)
    await saveModelConfig(newModel, maxOutputTokens, maxThinkingTokens, effortLevel)
  }

  const handleOutputTokensChange = async (val: string) => {
    setMaxOutputTokens(val)
    await saveModelConfig(modelName, val, maxThinkingTokens, effortLevel)
  }

  const handleThinkingTokensChange = async (val: string) => {
    setMaxThinkingTokens(val)
    await saveModelConfig(modelName, maxOutputTokens, val, effortLevel)
  }

  const handleEffortChange = async (val: string) => {
    setEffortLevel(val)
    await saveModelConfig(modelName, maxOutputTokens, maxThinkingTokens, val)
  }

  // === Skill Store Logic ===
  const loadSkillSources = useCallback(async () => {
    const sources = await window.claude?.readSkillSources() || []
    setSkillSources(sources)
    if (sources.length > 0) {
      setSourceForm(sources[0])
    }
  }, [])

  const loadRemoteSkills = useCallback(async () => {
    setStoreLoading(true)
    setInstallResult(null)
    const skills = await window.claude?.fetchRemoteSkills() || {}
    setRemoteSkills(skills)
    setStoreLoading(false)
  }, [])

  const handleSaveSource = async () => {
    if (!sourceForm.url.trim() || !sourceForm.project.trim() || !sourceForm.token.trim()) return
    const sources = [sourceForm]
    await window.claude?.writeSkillSources(sources)
    setSkillSources(sources)
    setEditingSource(false)
    // Reload remote skills with new source
    setStoreLoading(true)
    const skills = await window.claude?.fetchRemoteSkills() || {}
    setRemoteSkills(skills)
    setStoreLoading(false)
  }

  const handleInstallSkill = async (name: string) => {
    setInstalling(name)
    setInstallResult(null)
    const result = await window.claude?.installRemoteSkill(name) || { installed: [], skipped: [], errors: [] }
    setInstallResult(result)
    setInstalling(null)
    // Refresh local skills list
    await loadSkills()
  }

  const isSkillInstalled = (name: string) => {
    return skills.some(s => s.name === name)
  }

  const getDepsCount = (name: string): number => {
    const skill = remoteSkills[name]
    if (!skill?.dependencies?.length) return 0
    let count = 0
    const visited = new Set<string>()
    const countDeps = (n: string) => {
      if (visited.has(n)) return
      visited.add(n)
      const s = remoteSkills[n]
      if (!s) return
      for (const d of s.dependencies || []) {
        if (!visited.has(d)) {
          count++
          countDeps(d)
        }
      }
    }
    countDeps(name)
    return count
  }

  // Load data when panel opens or tab/scope changes
  useEffect(() => {
    if (isOpen && activeTab === 'skills') {
      loadSkills()
      setMode('list')
      if (skillView === 'store') {
        loadSkillSources()
        loadRemoteSkills()
      }
    }
  }, [isOpen, activeTab, loadSkills, skillView, loadSkillSources, loadRemoteSkills])

  useEffect(() => {
    if (isOpen && activeTab === 'mcp') {
      loadServers()
      setMode('list')
    }
  }, [isOpen, activeTab, loadServers])

  useEffect(() => {
    if (isOpen && activeTab === 'plugins' && plugins.length === 0 && !pluginsLoading) {
      loadPlugins()
    }
  }, [isOpen, activeTab, plugins.length, pluginsLoading, loadPlugins])

  useEffect(() => {
    if (isOpen && activeTab === 'teams') {
      loadTeamsConfig()
    }
  }, [isOpen, activeTab, loadTeamsConfig])

  useEffect(() => {
    if (isOpen && activeTab === 'model') {
      loadModelConfig()
    }
  }, [isOpen, activeTab, loadModelConfig])

  if (!isOpen) return null

  const serverEntries = Object.entries(servers)

  return (
    <div className="side-panel claude-settings-panel">
      {/* Header */}
      <div className="side-panel-header">
        {mode !== 'list' ? (
          <button className="side-panel-back-btn" onClick={() => setMode('list')} title="Back to list">
            {Icons.back}
          </button>
        ) : null}
        <h2>
          {mode === 'list'
            ? 'Claude Code'
            : mode === 'create'
              ? (activeTab === 'skills' ? 'New Skill' : 'New Server')
              : (activeTab === 'skills' ? editingSkillName : editingServerName)
          }
        </h2>
        <div className="side-panel-header-actions">
          {mode === 'list' && (
            <>
              <button
                className="side-panel-icon-btn"
                onClick={activeTab === 'skills' ? loadSkills : activeTab === 'mcp' ? loadServers : activeTab === 'plugins' ? loadPlugins : activeTab === 'teams' ? loadTeamsConfig : loadModelConfig}
                title="Refresh"
              >
                {Icons.refresh}
              </button>
              {activeTab !== 'plugins' && activeTab !== 'teams' && activeTab !== 'model' && (
                <button
                  className="side-panel-icon-btn"
                  onClick={activeTab === 'skills' ? handleCreateSkill : handleCreateServer}
                  title={activeTab === 'skills' ? 'New Skill' : 'New Server'}
                >
                  {Icons.plus}
                </button>
              )}
            </>
          )}
          <button className="side-panel-icon-btn close" onClick={onClose} title="Close">×</button>
        </div>
      </div>

      {/* Tab selector */}
      {mode === 'list' && (
        <div className="side-panel-scope-toggle">
          <button
            className={`scope-tab ${activeTab === 'skills' ? 'active' : ''}`}
            onClick={() => handleTabChange('skills')}
          >
            {Icons.skill} Skills
          </button>
          <button
            className={`scope-tab ${activeTab === 'mcp' ? 'active' : ''}`}
            onClick={() => handleTabChange('mcp')}
          >
            {Icons.mcp} MCP
          </button>
          <button
            className={`scope-tab ${activeTab === 'plugins' ? 'active' : ''}`}
            onClick={() => handleTabChange('plugins')}
          >
            {Icons.plugin} Plugins
          </button>
          <button
            className={`scope-tab ${activeTab === 'teams' ? 'active' : ''}`}
            onClick={() => handleTabChange('teams')}
          >
            {Icons.teams} Teams
          </button>
          <button
            className={`scope-tab ${activeTab === 'model' ? 'active' : ''}`}
            onClick={() => handleTabChange('model')}
          >
            {Icons.model} Model
          </button>
        </div>
      )}

      {/* Skills view toggle (Local / Store) */}
      {mode === 'list' && activeTab === 'skills' && (
        <div className="side-panel-sub-toggle">
          <button
            className={`sub-toggle-btn ${skillView === 'local' ? 'active' : ''}`}
            onClick={() => setSkillView('local')}
          >
            Local
          </button>
          <button
            className={`sub-toggle-btn ${skillView === 'store' ? 'active' : ''}`}
            onClick={() => { setSkillView('store'); loadSkillSources(); loadRemoteSkills() }}
          >
            Store
          </button>
        </div>
      )}

      {/* MCP scope toggle (sub-level) */}
      {mode === 'list' && activeTab === 'mcp' && (
        <div className="side-panel-sub-toggle">
          <button
            className={`sub-toggle-btn ${mcpScope === 'global' ? 'active' : ''}`}
            onClick={() => setMcpScope('global')}
          >
            Global
          </button>
          <button
            className={`sub-toggle-btn ${mcpScope === 'project' ? 'active' : ''}`}
            onClick={() => setMcpScope('project')}
          >
            Project
          </button>
        </div>
      )}

      {/* Info bar */}
      {mode === 'list' && (
        <div className="side-panel-info-bar">
          {activeTab === 'skills' && skillView === 'local' && !skillsLoading && (
            <>
              <span className="side-panel-count">{skills.length} skill{skills.length !== 1 ? 's' : ''}</span>
              <span className="side-panel-path">~/.claude/skills/</span>
            </>
          )}
          {activeTab === 'skills' && skillView === 'store' && !storeLoading && (
            <>
              <span className="side-panel-count">{Object.keys(remoteSkills).length} remote skill{Object.keys(remoteSkills).length !== 1 ? 's' : ''}</span>
              <span className="side-panel-path">{skillSources[0]?.project || 'No source configured'}</span>
            </>
          )}
          {activeTab === 'mcp' && !mcpLoading && (
            <>
              <span className="side-panel-count">{serverEntries.length} server{serverEntries.length !== 1 ? 's' : ''}</span>
              <span className="side-panel-path">{mcpScope === 'global' ? '~/.claude/settings.json' : '.mcp.json'}</span>
            </>
          )}
          {activeTab === 'plugins' && !pluginsLoading && (
            <>
              <span className="side-panel-count">{filteredPlugins.length} / {plugins.length} plugin{plugins.length !== 1 ? 's' : ''}</span>
              <span className="side-panel-path">Marketplace</span>
            </>
          )}
          {activeTab === 'teams' && !teamsLoading && (
            <>
              <span className="side-panel-count">{teamsEnabled ? 'Enabled' : 'Disabled'}</span>
              <span className="side-panel-path">~/.claude/settings.json</span>
            </>
          )}
          {activeTab === 'model' && !modelLoading && (
            <>
              <span className="side-panel-count">{modelName || 'default'}</span>
              <span className="side-panel-path">~/.claude/settings.json</span>
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div className="side-panel-content">
        {/* === Skills List (Local) === */}
        {activeTab === 'skills' && mode === 'list' && skillView === 'local' && (
          <>
            {skillsLoading ? (
              <div className="side-panel-loading">
                <div className="loading-spinner" />
                Loading skills...
              </div>
            ) : skills.length === 0 ? (
              <div className="side-panel-empty">
                <span className="empty-icon">{Icons.skill}</span>
                <p>No skills found</p>
                <p className="hint">Create skills to teach Claude new capabilities</p>
                <button className="side-panel-action-btn" onClick={handleCreateSkill}>
                  {Icons.plus} Create Skill
                </button>
              </div>
            ) : (
              <div className="side-panel-list">
                {skills.map((skill) => (
                  <div key={skill.name} className="side-panel-item" onClick={() => handleEditSkill(skill.name)}>
                    <div className="item-status-dot configured" title="Configured" />
                    <div className="item-info">
                      <span className="item-name">{skill.name}</span>
                      {skill.description && (
                        <span className="item-desc">{skill.description.replace(/^#\s*/, '')}</span>
                      )}
                      {skill.commands && skill.commands.length > 0 && (
                        <div className="skill-commands">
                          {skill.commands.map((cmd, i) => (
                            <span key={i} className="skill-command-badge">{cmd}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="item-actions">
                      <button
                        className="item-action-btn"
                        onClick={(e) => { e.stopPropagation(); handleCloneSkill(skill.name) }}
                        title="Clone"
                      >
                        {Icons.copy}
                      </button>
                      <button
                        className="item-action-btn delete"
                        onClick={(e) => { e.stopPropagation(); handleDeleteSkill(skill.name) }}
                        title="Delete"
                      >
                        {Icons.trash}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* === Skills Store === */}
        {activeTab === 'skills' && mode === 'list' && skillView === 'store' && (
          <>
            {/* Source config */}
            {editingSource ? (
              <div className="skill-store-source-editor">
                <div className="editor-field">
                  <label>Name</label>
                  <input
                    type="text"
                    value={sourceForm.name}
                    onChange={(e) => setSourceForm({ ...sourceForm, name: e.target.value })}
                    placeholder="My Skills"
                    className="editor-input"
                  />
                </div>
                <div className="editor-field">
                  <label>GitLab URL</label>
                  <input
                    type="text"
                    value={sourceForm.url}
                    onChange={(e) => setSourceForm({ ...sourceForm, url: e.target.value })}
                    placeholder="https://gitlab.example.com"
                    className="editor-input"
                  />
                </div>
                <div className="editor-field">
                  <label>Project</label>
                  <input
                    type="text"
                    value={sourceForm.project}
                    onChange={(e) => setSourceForm({ ...sourceForm, project: e.target.value })}
                    placeholder="username/repo"
                    className="editor-input"
                  />
                </div>
                <div className="editor-field">
                  <label>Access Token</label>
                  <input
                    type="password"
                    value={sourceForm.token}
                    onChange={(e) => setSourceForm({ ...sourceForm, token: e.target.value })}
                    placeholder="glpat-..."
                    className="editor-input"
                  />
                </div>
                <div className="editor-field">
                  <label>Branch</label>
                  <input
                    type="text"
                    value={sourceForm.branch}
                    onChange={(e) => setSourceForm({ ...sourceForm, branch: e.target.value })}
                    placeholder="main"
                    className="editor-input"
                  />
                </div>
                <div className="editor-actions">
                  <button className="editor-btn cancel" onClick={() => setEditingSource(false)}>Cancel</button>
                  <button
                    className="editor-btn save"
                    onClick={handleSaveSource}
                    disabled={!sourceForm.url.trim() || !sourceForm.project.trim() || !sourceForm.token.trim()}
                  >
                    Save & Load
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Source info bar */}
                <div className="skill-store-source-bar" onClick={() => setEditingSource(true)}>
                  <span className="store-source-label">
                    {skillSources.length > 0 ? skillSources[0].name : 'No source configured'}
                  </span>
                  <span className="store-source-url">
                    {skillSources.length > 0
                      ? `${skillSources[0].url.replace(/^https?:\/\//, '')} / ${skillSources[0].project}`
                      : 'Click to configure'}
                  </span>
                </div>

                {/* Install result */}
                {installResult && (
                  <div className="skill-install-result">
                    {installResult.installed.length > 0 && (
                      <div className="install-result-success">
                        Installed: {installResult.installed.join(', ')}
                      </div>
                    )}
                    {installResult.skipped.length > 0 && (
                      <div className="install-result-skipped">
                        Already installed: {installResult.skipped.join(', ')}
                      </div>
                    )}
                    {installResult.errors.length > 0 && (
                      <div className="install-result-error">
                        Errors: {installResult.errors.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {/* Skills list */}
                {storeLoading ? (
                  <div className="side-panel-loading">
                    <div className="loading-spinner" />
                    Loading remote skills...
                  </div>
                ) : Object.keys(remoteSkills).length === 0 ? (
                  <div className="side-panel-empty">
                    <span className="empty-icon">{Icons.skill}</span>
                    <p>No remote skills</p>
                    <p className="hint">{skillSources.length === 0 ? 'Configure a source to get started' : 'No skills found in the repository'}</p>
                    <button className="side-panel-action-btn" onClick={() => setEditingSource(true)}>
                      Configure Source
                    </button>
                  </div>
                ) : (
                  <div className="side-panel-list">
                    {Object.entries(remoteSkills).map(([name, info]) => {
                      const installed = isSkillInstalled(name)
                      const depsCount = getDepsCount(name)
                      const isCurrentlyInstalling = installing === name
                      return (
                        <div key={name} className={`remote-skill-card ${installed ? 'installed' : ''}`}>
                          <div className="remote-skill-header">
                            <span className="remote-skill-name">{name}</span>
                            <span className="remote-skill-version">v{info.version}</span>
                          </div>
                          <p className="remote-skill-desc">{info.description}</p>
                          {info.dependencies && info.dependencies.length > 0 ? (
                            <div className="remote-skill-deps">
                              Deps: {info.dependencies.map(d => (
                                <span key={d} className={`dep-badge ${isSkillInstalled(d) ? 'installed' : ''}`}>{d}</span>
                              ))}
                            </div>
                          ) : (
                            <div className="remote-skill-deps">No dependencies</div>
                          )}
                          <div className="remote-skill-actions">
                            {isCurrentlyInstalling ? (
                              <button className="remote-skill-install-btn installing" disabled>
                                <div className="loading-spinner small" />
                                Installing{depsCount > 0 ? ` ${name} + ${depsCount} deps...` : '...'}
                              </button>
                            ) : installed ? (
                              <button
                                className="remote-skill-install-btn installed"
                                onClick={() => handleInstallSkill(name)}
                                title="Click to reinstall"
                              >
                                Installed
                              </button>
                            ) : (
                              <button
                                className="remote-skill-install-btn"
                                onClick={() => handleInstallSkill(name)}
                              >
                                {Icons.download} Install{depsCount > 0 ? ` (+${depsCount})` : ''}
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* === MCP List === */}
        {activeTab === 'mcp' && mode === 'list' && (
          <>
            {mcpLoading ? (
              <div className="side-panel-loading">
                <div className="loading-spinner" />
                Loading servers...
              </div>
            ) : serverEntries.length === 0 ? (
              <div className="side-panel-empty">
                <span className="empty-icon">{Icons.mcp}</span>
                <p>No MCP servers</p>
                <p className="hint">Add servers to extend Claude's capabilities</p>
                <button className="side-panel-action-btn" onClick={handleCreateServer}>
                  {Icons.plus} Add Server
                </button>
              </div>
            ) : (
              <div className="side-panel-list">
                {serverEntries.map(([name, server]) => (
                  <div key={name} className="side-panel-item" onClick={() => handleEditServer(name)}>
                    <div className="item-status-dot configured" title="Configured" />
                    <div className="item-info">
                      <span className="item-name">{name}</span>
                      <span className="item-desc mono">{server.command} {(server.args || []).join(' ')}</span>
                    </div>
                    <div className="item-actions">
                      <button
                        className="item-action-btn delete"
                        onClick={(e) => { e.stopPropagation(); handleDeleteServer(name) }}
                        title="Delete"
                      >
                        {Icons.trash}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* === Plugins List === */}
        {activeTab === 'plugins' && mode === 'list' && (
          <>
            {/* Search + Filter */}
            <div className="plugin-controls">
              <div className="plugin-search-box">
                {Icons.search}
                <input
                  type="text"
                  value={pluginSearch}
                  onChange={(e) => setPluginSearch(e.target.value)}
                  placeholder="Search plugins..."
                  className="plugin-search-input"
                />
                {pluginSearch && (
                  <button className="plugin-search-clear" onClick={() => setPluginSearch('')}>×</button>
                )}
              </div>
              <div className="plugin-category-bar">
                {ALL_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    className={`plugin-category-tag ${pluginCategory === cat ? 'active' : ''}`}
                    onClick={() => setPluginCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {pluginsLoading ? (
              <div className="side-panel-loading">
                <div className="loading-spinner" />
                Loading marketplace...
              </div>
            ) : pluginsError ? (
              <div className="side-panel-empty">
                <p>{pluginsError}</p>
                <button className="side-panel-action-btn" onClick={loadPlugins}>
                  {Icons.refresh} Retry
                </button>
              </div>
            ) : filteredPlugins.length === 0 ? (
              <div className="side-panel-empty">
                <span className="empty-icon">{Icons.plugin}</span>
                <p>No plugins found</p>
                {pluginSearch && <p className="hint">Try a different search term</p>}
              </div>
            ) : (
              <div className="side-panel-list plugin-list">
                {filteredPlugins.map((plugin) => {
                  const pluginType = inferPluginType(plugin)
                  const installed = isPluginInstalled(plugin.name)
                  return (
                    <div key={`${plugin.marketplace}-${plugin.name}`} className={`plugin-card ${installed ? 'installed' : ''}`}>
                      <div className="plugin-card-header">
                        <span className="plugin-name">{plugin.name}</span>
                        <span className={`plugin-type-badge type-${pluginType.toLowerCase()}`}>{pluginType}</span>
                        {plugin.version && <span className="plugin-version">v{plugin.version}</span>}
                        {installed && <span className="plugin-installed-badge">Installed</span>}
                      </div>
                      <p className="plugin-desc">{plugin.description}</p>
                      <div className="plugin-card-footer">
                        <div className="plugin-tags">
                          {plugin.category && (
                            <span className={`plugin-badge category-${plugin.category}`}>{plugin.category}</span>
                          )}
                          <span className={`plugin-badge marketplace-${plugin.marketplace}`}>
                            {plugin.marketplace === 'claude-plugins-official' ? 'official'
                              : plugin.marketplace === 'claude-code' ? 'bundled'
                              : plugin.marketplace === 'claude-code-marketplace' ? 'community'
                              : plugin.marketplace}
                          </span>
                        </div>
                        <div className="plugin-actions">
                          {plugin.homepage && (
                            <button
                              className="plugin-link-btn"
                              onClick={() => window.shell?.openExternal(plugin.homepage!)}
                              title="Open homepage"
                            >
                              {Icons.link}
                            </button>
                          )}
                          <button
                            className={`plugin-install-btn ${installed ? 'reinstall' : ''}`}
                            onClick={() => handleInstallPlugin(plugin)}
                            title={installed ? 'Reinstall plugin' : 'Install plugin'}
                          >
                            {Icons.download} {installed ? 'Reinstall' : 'Install'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* === Teams Settings === */}
        {activeTab === 'teams' && mode === 'list' && (
          <>
            {teamsLoading ? (
              <div className="side-panel-loading">
                <div className="loading-spinner" />
                Loading config...
              </div>
            ) : (
              <div className="teams-settings">
                <div className="teams-setting-group">
                  <div className="teams-setting-header">
                    <div className="teams-setting-label">
                      <span className="teams-setting-title">Agent Teams</span>
                      <span className="teams-setting-desc">Multiple Claude agents collaborate in parallel on your tasks</span>
                    </div>
                    <label className="teams-toggle">
                      <input
                        type="checkbox"
                        checked={teamsEnabled}
                        onChange={(e) => handleTeamsToggle(e.target.checked)}
                      />
                      <span className="teams-toggle-slider" />
                    </label>
                  </div>
                </div>

                <div className="teams-setting-group">
                  <div className="teams-setting-label">
                    <span className="teams-setting-title">Teammate Mode</span>
                    <span className="teams-setting-desc">How teammate agents are displayed</span>
                  </div>
                  <select
                    className="teams-select"
                    value={teammateMode}
                    onChange={(e) => handleTeammateModeChange(e.target.value)}
                    disabled={!teamsEnabled}
                  >
                    <option value="auto">auto</option>
                    <option value="in-process">in-process</option>
                    <option value="tmux">tmux</option>
                  </select>
                  <div className="teams-mode-descriptions">
                    <div className={`teams-mode-item ${teammateMode === 'auto' ? 'active' : ''}`}>
                      <span className="teams-mode-name">auto</span>
                      <span className="teams-mode-desc">Uses tmux split if in tmux session, otherwise in-process</span>
                    </div>
                    <div className={`teams-mode-item ${teammateMode === 'in-process' ? 'active' : ''}`}>
                      <span className="teams-mode-name">in-process</span>
                      <span className="teams-mode-desc">All agents run within a single terminal</span>
                    </div>
                    <div className={`teams-mode-item ${teammateMode === 'tmux' ? 'active' : ''}`}>
                      <span className="teams-mode-name">tmux</span>
                      <span className="teams-mode-desc">Each agent gets its own tmux split pane</span>
                    </div>
                  </div>
                </div>

                <div className="teams-warning">
                  <span className="teams-warning-icon">!</span>
                  <div className="teams-warning-text">
                    <strong>Experimental Feature</strong>
                    <span>Token usage may increase significantly when using Agent Teams</span>
                  </div>
                </div>

                {/* Team Templates */}
                <div className="teams-templates-section">
                  <div className="teams-setting-label">
                    <span className="teams-setting-title">Team Templates</span>
                    <span className="teams-setting-desc">Quick-launch a pre-configured team</span>
                  </div>
                  <div className="teams-templates-grid">
                    {TEAM_TEMPLATES.map(tpl => (
                      <div
                        key={tpl.id}
                        className={`teams-template-card ${selectedTemplate === tpl.id ? 'selected' : ''}`}
                        onClick={() => setSelectedTemplate(selectedTemplate === tpl.id ? null : tpl.id)}
                      >
                        <div className="teams-template-header">
                          <span className="teams-template-icon">{tpl.icon}</span>
                          <span className="teams-template-name">{tpl.name}</span>
                          <span className="teams-template-count">{tpl.members} agents</span>
                        </div>
                        <div className="teams-template-desc">{tpl.description}</div>
                        {selectedTemplate === tpl.id && (
                          <div className="teams-template-details">
                            <div className="teams-template-roles">
                              {tpl.roles.map((r, i) => (
                                <span key={i} className="teams-template-role">{r}</span>
                              ))}
                            </div>
                            <button
                              className="teams-template-launch"
                              onClick={(e) => {
                                e.stopPropagation()
                                // Enable teams + send the template prompt
                                handleTeamsToggle(true)
                                onSendCommand?.('claude --dangerously-skip-permissions')
                                // Send the prompt after a short delay for Claude to start
                                setTimeout(() => {
                                  onSendCommand?.(tpl.prompt)
                                }, 1500)
                                setSelectedTemplate(null)
                                onClose()
                              }}
                            >
                              Launch Team
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* === Model Config === */}
        {activeTab === 'model' && mode === 'list' && (
          <>
            {modelLoading ? (
              <div className="side-panel-loading">
                <div className="loading-spinner" />
                Loading config...
              </div>
            ) : (
              <div className="model-settings">
                {/* Model Selection */}
                <div className="model-setting-group">
                  <div className="model-setting-label">
                    <span className="model-setting-title">Model</span>
                    <span className="model-setting-desc">Select the default Claude model</span>
                  </div>
                  <div className="model-preset-row">
                    {['opus', 'sonnet', 'haiku'].map((m) => (
                      <button
                        key={m}
                        className={`model-preset-btn ${getBaseModel(modelName) === m ? 'active' : ''}`}
                        onClick={() => {
                          const suffix = getContextSuffix(modelName)
                          handleModelChange(suffix ? `${m}${suffix}` : m)
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Context Window */}
                <div className="model-setting-group">
                  <div className="model-setting-label">
                    <span className="model-setting-title">Context Window</span>
                    <span className="model-setting-desc">Extended context uses premium pricing (2x input)</span>
                  </div>
                  <div className="model-preset-row">
                    {[
                      { label: '200K', suffix: '' },
                      { label: '1M', suffix: '[1m]' },
                      { label: '10M', suffix: '[10m]' },
                      { label: '20M', suffix: '[20m]' },
                      { label: '50M', suffix: '[50m]' },
                      { label: '100M', suffix: '[100m]' },
                    ].map(({ label, suffix }) => (
                      <button
                        key={label}
                        className={`model-preset-btn ${getContextSuffix(modelName) === suffix ? 'active' : ''}`}
                        onClick={() => handleContextChange(suffix)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Output Tokens */}
                <div className="model-setting-group">
                  <div className="model-setting-label">
                    <span className="model-setting-title">Max Output Tokens</span>
                    <span className="model-setting-desc">Maximum tokens per response (Opus: 128K, Sonnet/Haiku: 64K)</span>
                  </div>
                  <div className="model-preset-row">
                    {[
                      { label: '16K', value: '16000' },
                      { label: '32K', value: '32000' },
                      { label: '64K', value: '64000' },
                      { label: '128K', value: '128000' },
                    ].map((opt) => {
                      const base = modelName.replace(/\[1m\]$/, '')
                      const maxAllowed = base === 'opus' ? 128000 : 64000
                      const disabled = Number(opt.value) > maxAllowed
                      return (
                        <button
                          key={opt.value}
                          className={`model-preset-btn ${maxOutputTokens === opt.value ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
                          onClick={() => !disabled && handleOutputTokensChange(maxOutputTokens === opt.value ? '' : opt.value)}
                          disabled={disabled}
                          title={disabled ? `Exceeds ${base || 'model'} limit` : opt.value === maxOutputTokens ? 'Click to reset to default' : ''}
                        >
                          {opt.label}
                        </button>
                      )
                    })}
                  </div>
                  {maxOutputTokens && (
                    <span className="model-current-value">Current: {Number(maxOutputTokens).toLocaleString()}</span>
                  )}
                </div>

                {/* Thinking Tokens */}
                <div className="model-setting-group">
                  <div className="model-setting-label">
                    <span className="model-setting-title">Thinking Tokens</span>
                    <span className="model-setting-desc">Budget for extended thinking (default: 31,999)</span>
                  </div>
                  <div className="model-preset-row">
                    {[
                      { label: '8K', value: '8000' },
                      { label: '16K', value: '16000' },
                      { label: '32K', value: '31999' },
                      { label: '64K', value: '64000' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        className={`model-preset-btn ${maxThinkingTokens === opt.value ? 'active' : ''}`}
                        onClick={() => handleThinkingTokensChange(maxThinkingTokens === opt.value ? '' : opt.value)}
                        title={opt.value === maxThinkingTokens ? 'Click to reset to default' : ''}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  {maxThinkingTokens && (
                    <span className="model-current-value">Current: {Number(maxThinkingTokens).toLocaleString()}</span>
                  )}
                </div>

                {/* Effort Level */}
                <div className="model-setting-group">
                  <div className="model-setting-label">
                    <span className="model-setting-title">Effort Level</span>
                    <span className="model-setting-desc">Higher effort = better quality, more token usage</span>
                  </div>
                  <div className="model-preset-row effort-row">
                    {[
                      { label: 'Low', value: 'low', desc: 'Fast' },
                      { label: 'Medium', value: 'medium', desc: 'Balanced' },
                      { label: 'High', value: 'high', desc: 'Best quality' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        className={`model-preset-btn effort-btn ${effortLevel === opt.value ? 'active' : ''}`}
                        onClick={() => handleEffortChange(effortLevel === opt.value ? '' : opt.value)}
                        title={opt.desc}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Warning */}
                <div className="teams-warning">
                  <span className="teams-warning-icon">!</span>
                  <div className="teams-warning-text">
                    <strong>Settings apply to new sessions</strong>
                    <span>Changes are saved to ~/.claude/settings.json and take effect on next Claude launch</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* === Skills Editor === */}
        {activeTab === 'skills' && (mode === 'edit' || mode === 'create') && (
          <div className="side-panel-editor">
            {mode === 'create' && (
              <div className="editor-field">
                <label>Skill Name</label>
                <input
                  type="text"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="my-skill"
                  className="editor-input"
                  autoFocus
                />
              </div>
            )}
            <div className="editor-field grow">
              <label>SKILL.md</label>
              <textarea
                value={editingSkillContent}
                onChange={(e) => setEditingSkillContent(e.target.value)}
                placeholder={"# Skill description\n\nInstructions for Claude..."}
                className="editor-textarea"
              />
            </div>
            <div className="editor-actions">
              <button className="editor-btn cancel" onClick={() => setMode('list')}>Cancel</button>
              <button
                className="editor-btn save"
                onClick={handleSaveSkill}
                disabled={mode === 'create' && !newSkillName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* === MCP Editor === */}
        {activeTab === 'mcp' && (mode === 'edit' || mode === 'create') && (
          <div className="side-panel-editor">
            {mode === 'create' && (
              <div className="editor-field">
                <label>Server Name</label>
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="server-name"
                  className="editor-input"
                  autoFocus
                />
              </div>
            )}
            <div className="editor-field">
              <label>Command</label>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="npx, node, python..."
                className="editor-input"
              />
            </div>
            <div className="editor-field">
              <label>Arguments (one per line)</label>
              <textarea
                value={argsText}
                onChange={(e) => setArgsText(e.target.value)}
                placeholder={"-y\n@modelcontextprotocol/server-filesystem"}
                className="editor-textarea small"
                rows={4}
              />
            </div>
            <div className="editor-field">
              <label>
                Environment
                <button className="env-add-btn" onClick={addEnvPair} type="button">+ Add</button>
              </label>
              {envPairs.map((pair, i) => (
                <div key={i} className="env-pair">
                  <input
                    type="text"
                    value={pair.key}
                    onChange={(e) => updateEnvPair(i, 'key', e.target.value)}
                    placeholder="KEY"
                    className="env-key-input"
                  />
                  <span className="env-eq">=</span>
                  <input
                    type="text"
                    value={pair.value}
                    onChange={(e) => updateEnvPair(i, 'value', e.target.value)}
                    placeholder="value"
                    className="env-value-input"
                  />
                  <button className="env-remove-btn" onClick={() => removeEnvPair(i)} type="button">×</button>
                </div>
              ))}
            </div>
            <div className="editor-actions">
              <button className="editor-btn cancel" onClick={() => setMode('list')}>Cancel</button>
              <button
                className="editor-btn save"
                onClick={handleSaveServer}
                disabled={mode === 'create' && !newServerName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
