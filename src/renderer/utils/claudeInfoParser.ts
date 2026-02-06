import { ClaudeSessionInfo } from '../store/claudeInfo'

/**
 * Parse a token count string like "45.2K", "1.2M", "12,345", "500K" into a number.
 */
function parseTokenCount(s: string): number {
  s = s.replace(/,/g, '').trim()
  const mK = s.match(/^([\d.]+)\s*[kK]$/); if (mK) return Math.round(parseFloat(mK[1]) * 1000)
  const mM = s.match(/^([\d.]+)\s*[mM]$/); if (mM) return Math.round(parseFloat(mM[1]) * 1000000)
  const mB = s.match(/^([\d.]+)\s*[bB]$/); if (mB) return Math.round(parseFloat(mB[1]) * 1000000000)
  return parseInt(s, 10) || 0
}

/**
 * Parse Claude CLI output to extract session info (model, tokens, cost, context, usage).
 * Returns partial session info with only the fields found.
 */
export function parseClaudeInfo(strippedData: string): Partial<ClaudeSessionInfo> | null {
  const result: Partial<ClaudeSessionInfo> = {}
  let found = false

  // Model name — various formats:
  // "Model: claude-sonnet-4-5-20250929"
  // "model: claude-opus-4-5-20251101"
  // "> claude-sonnet-4-5"
  // "claude-sonnet-4-5-20250929"  (standalone on a line)
  // "Sonnet 4.5" in status
  const modelMatch = strippedData.match(/(?:Model|model):\s*(claude-[\w.-]+)/i)
    || strippedData.match(/>\s*(claude-[\w.-]+)/)
    || strippedData.match(/\b(claude-(?:opus|sonnet|haiku)-[\w.-]+)\b/)
  if (modelMatch) {
    result.model = modelMatch[1]
    found = true
  }

  // Input tokens — "Input tokens: 12,345" or "input: 1.2K"
  const inputMatch = strippedData.match(/[Ii]nput\s+tokens?:\s*([\d,.]+[kKmM]?)/i)
  if (inputMatch) {
    result.inputTokens = parseTokenCount(inputMatch[1])
    found = true
  }

  // Output tokens — "Output tokens: 6,789" or "output: 456"
  const outputMatch = strippedData.match(/[Oo]utput\s+tokens?:\s*([\d,.]+[kKmM]?)/i)
  if (outputMatch) {
    result.outputTokens = parseTokenCount(outputMatch[1])
    found = true
  }

  // Total/session cost — "Total cost: $0.1234" or "Session cost: $0.05" or "Cost: $0.12"
  const costMatch = strippedData.match(/(?:Total|Session|total|session)?\s*[Cc]ost:\s*\$?([\d.]+)/i)
  if (costMatch) {
    result.totalCost = parseFloat(costMatch[1])
    found = true
  }

  // Context window usage — "Context: 14,234 / 200,000" or "Context: 14.2K/200K" or "Context: 14.2k / 200k (7.1%)"
  const contextMatch = strippedData.match(/[Cc]ontext(?:\s+window)?:\s*([\d,.]+[kKmM]?)\s*\/\s*([\d,.]+[kKmM]?)/)
  if (contextMatch) {
    result.contextUsed = parseTokenCount(contextMatch[1])
    result.contextMax = parseTokenCount(contextMatch[2])
    found = true
  }

  // Daily usage — various formats:
  // "Sonnet daily: 45.2K / 500K" or "Sonnet 4.5 (daily): 45.2K / 500K tokens"
  // "Opus 4.5 (daily):  114.5K /   5.0M tokens"
  // "Daily usage: 45.2K / 500K" or "daily: 45.2K / 500K"
  const dailyMatch = strippedData.match(/(?:[\w.]+\s+)*\(?daily\)?(?:\s+usage)?:\s*([\d,.]+[kKmM]?)\s*\/\s*([\d,.]+[kKmM]?)/i)
  if (dailyMatch) {
    result.dailyUsed = parseTokenCount(dailyMatch[1])
    result.dailyMax = parseTokenCount(dailyMatch[2])
    found = true
  }

  // Weekly usage — various formats:
  // "Sonnet weekly: 123.4K / 5M" or "Sonnet 4.5 (weekly): 123.4K / 5M tokens"
  // "Opus 4.5 (weekly): 114.5K / 50.0M tokens"
  const weeklyMatch = strippedData.match(/(?:[\w.]+\s+)*\(?weekly\)?(?:\s+usage)?:\s*([\d,.]+[kKmM]?)\s*\/\s*([\d,.]+[kKmM]?)/i)
  if (weeklyMatch) {
    result.weeklyUsed = parseTokenCount(weeklyMatch[1])
    result.weeklyMax = parseTokenCount(weeklyMatch[2])
    found = true
  }

  if (found) {
    console.log('[claudeInfoParser] parsed:', JSON.stringify(result), 'from:', strippedData.substring(0, 200))
  }
  return found ? result : null
}
