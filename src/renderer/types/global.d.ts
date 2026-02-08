export {}

declare global {
  interface Window {
    terminal: {
      create: (cols: number, rows: number, cwd?: string) => Promise<number>
      write: (id: number, data: string) => void
      resize: (id: number, cols: number, rows: number) => void
      kill: (id: number) => void
      onData: (callback: (id: number, data: string) => void) => () => void
      onExit: (callback: (id: number, exitCode: number) => void) => () => void
    }
    windowControls: {
      minimize: () => void
      maximize: () => void
      close: () => void
    }
    fileSystem: {
      readDirectory: (path: string, withStats?: boolean) => Promise<Array<{ name: string; type: 'file' | 'directory'; size?: number; mtime?: number }>>
      listFilesRecursive: (path: string, maxFiles?: number) => Promise<string[]>
      searchInFiles: (dirPath: string, query: string, maxResults?: number) => Promise<Array<{ file: string; line: number; text: string }>>
      getCurrentDirectory: () => Promise<string>
      readFile: (path: string) => Promise<string | null>
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
    clipboard: {
      writeFiles: (paths: string[]) => Promise<boolean>
      readFiles: () => Promise<string[]>
      hasFiles: () => Promise<boolean>
    }
    dialog: {
      saveFile: (options: {
        title?: string
        defaultPath?: string
        filters?: { name: string; extensions: string[] }[]
      }) => Promise<string | null>
    }
    shell: {
      openExternal: (url: string) => Promise<boolean>
    }
    git: {
      getRepoRoot: (dirPath: string) => Promise<string | null>
      getBranch: (dirPath: string) => Promise<string | null>
      getStatus: (repoRoot: string) => Promise<Record<string, { index: string; workTree: string }> | null>
      getIgnored: (repoRoot: string) => Promise<string[]>
    }
    agentTeams: AgentTeamsAPI
    claude: {
      listSkills: () => Promise<Array<{ name: string; description: string; commands: string[] }>>
      readSkill: (name: string) => Promise<string | null>
      writeSkill: (name: string, content: string) => Promise<boolean>
      deleteSkill: (name: string) => Promise<boolean>
      readMcpConfig: (scope: string, projectPath?: string) => Promise<Record<string, unknown>>
      writeMcpConfig: (scope: string, servers: Record<string, unknown>, projectPath?: string) => Promise<boolean>
      readClaudeMd: (scope: string, projectPath?: string) => Promise<string>
      writeClaudeMd: (scope: string, content: string, projectPath?: string) => Promise<boolean>
      readStatsCache: () => Promise<StatsCache | null>
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
      readAgentTeamsConfig: () => Promise<{ enabled: boolean; teammateMode: string }>
      writeAgentTeamsConfig: (config: { enabled: boolean; teammateMode: string }) => Promise<boolean>
      readModelConfig: () => Promise<{ model: string; maxOutputTokens: string; maxThinkingTokens: string; effortLevel: string }>
      writeModelConfig: (config: { model: string; maxOutputTokens: string; maxThinkingTokens: string; effortLevel: string }) => Promise<boolean>
      getAuthStatus: () => Promise<{ loggedIn: boolean; subscriptionType: string; expiresAt: number }>
      readInputHistory: (limit?: number) => Promise<InputHistoryEntry[]>
      readManifest: () => Promise<ManifestData | null>
      readSkillSources: () => Promise<SkillSource[]>
      writeSkillSources: (sources: SkillSource[]) => Promise<boolean>
      fetchRemoteSkills: () => Promise<Record<string, RemoteSkillInfo>>
      installRemoteSkill: (name: string, forceReinstall?: boolean) => Promise<{ installed: string[]; skipped: string[]; errors: string[] }>
    }
  }

  interface AgentTeamMember {
    name: string
    agentId: string
    agentType: string  // "lead" | "teammate"
    model?: string
    color?: string
  }

  interface AgentTeamMessage {
    from: string
    text: string
    summary?: string
    timestamp: number
    color?: string
    read: boolean
  }

  interface AgentTeamTask {
    id: string
    subject: string
    status: 'pending' | 'in_progress' | 'completed'
    assignee?: string
    blockedBy?: string[]
  }

  interface AgentTeamInfo {
    teamName: string
    members: AgentTeamMember[]
    tasks: AgentTeamTask[]
    messages: AgentTeamMessage[]
  }

  interface AgentTeamsAPI {
    listTeams: () => Promise<string[]>
    getTeamInfo: (teamName: string) => Promise<AgentTeamInfo | null>
    watchTeams: () => Promise<boolean>
    unwatchTeams: () => Promise<boolean>
    onTeamsChanged: (callback: (teamName: string) => void) => () => void
  }

  interface SkillSource {
    name: string
    url: string
    project: string
    token: string
    branch: string
  }

  interface RemoteSkillInfo {
    description: string
    version: string
    dependencies: string[]
  }

  interface InputHistoryEntry {
    display: string
    timestamp: number
    project: string
    sessionId: string
  }

  interface ManifestSkill {
    version: string
    description: string
    entry: string
    files: string[]
    triggers?: string[]
    category?: string
  }

  interface ManifestCommand {
    description: string
    file: string
    category?: string
  }

  interface ManifestData {
    version: string
    description: string
    updated: string
    skills: Record<string, ManifestSkill>
    commands?: Record<string, ManifestCommand>
  }

  interface MarketplacePlugin {
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

  interface PlanInfo {
    name: string
    title: string
    size: number
    mtime: string
  }

  interface TodoInfo {
    id: string
    tasks: Array<{
      id: string
      subject: string
      status: string
      description?: string
    }>
    mtime: string
  }

  interface SessionInfo {
    id: string
    size: number
    mtime: string
    firstMessage: string
  }

  interface SessionMessage {
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

  interface OAuthUsageResponse {
    five_hour?: { utilization: number; resets_at: string }
    seven_day?: { utilization: number; resets_at: string }
    seven_day_sonnet?: { utilization: number; resets_at: string }
    extra_usage?: { is_enabled: boolean; monthly_limit: number | null; used_credits: number | null; utilization: number | null }
  }

  interface StatsCacheModelUsage {
    inputTokens: number
    outputTokens: number
    cacheCreationInputTokens: number
    cacheReadInputTokens: number
    costUSD: number
  }

  interface StatsCacheDailyActivity {
    date: string
    messageCount: number
    sessionCount: number
    toolCallCount: number
  }

  interface StatsCacheDailyModelTokens {
    date: string
    tokensByModel: Record<string, number>
  }

  interface StatsCache {
    totalSessions: number
    totalMessages: number
    lastComputedDate: string
    dailyActivity: StatsCacheDailyActivity[]
    dailyModelTokens: StatsCacheDailyModelTokens[]
    modelUsage: Record<string, StatsCacheModelUsage>
  }
}
