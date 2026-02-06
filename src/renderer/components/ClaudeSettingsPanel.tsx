import { useState, useEffect, useCallback } from 'react'

interface ClaudeSettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  projectPath?: string
  onSendCommand?: (command: string) => void
}

type PanelTab = 'skills' | 'mcp' | 'plugins'
type Mode = 'list' | 'edit' | 'create'
type Scope = 'global' | 'project'

interface SkillItem {
  name: string
  description: string
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
}

const ALL_CATEGORIES = ['all', 'development', 'productivity', 'security', 'learning', 'testing', 'database', 'design', 'deployment', 'monitoring'] as const

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

  // Load data when panel opens or tab/scope changes
  useEffect(() => {
    if (isOpen && activeTab === 'skills') {
      loadSkills()
      setMode('list')
    }
  }, [isOpen, activeTab, loadSkills])

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
                onClick={activeTab === 'skills' ? loadSkills : activeTab === 'mcp' ? loadServers : loadPlugins}
                title="Refresh"
              >
                {Icons.refresh}
              </button>
              {activeTab !== 'plugins' && (
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
          {activeTab === 'skills' && !skillsLoading && (
            <>
              <span className="side-panel-count">{skills.length} skill{skills.length !== 1 ? 's' : ''}</span>
              <span className="side-panel-path">~/.claude/skills/</span>
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
        </div>
      )}

      {/* Content */}
      <div className="side-panel-content">
        {/* === Skills List === */}
        {activeTab === 'skills' && mode === 'list' && (
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
                    </div>
                    <div className="item-actions">
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
