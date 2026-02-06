/**
 * DOM-based text search using TreeWalker.
 * Wraps matches in <mark class="search-highlight"> elements.
 */

const HIGHLIGHT_CLASS = 'search-highlight'
const ACTIVE_CLASS = 'active'

/**
 * Clear all search highlights from a container and normalize text nodes.
 */
export function clearHighlights(container: HTMLElement): void {
  const marks = container.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`)
  marks.forEach((mark) => {
    const parent = mark.parentNode
    if (parent) {
      // Replace mark with its text content
      const text = document.createTextNode(mark.textContent || '')
      parent.replaceChild(text, mark)
    }
  })
  // Merge adjacent text nodes
  container.normalize()
}

/**
 * Highlight all occurrences of `term` inside `container`.
 * Returns the total number of matches found.
 */
export function highlightMatches(container: HTMLElement, term: string): number {
  clearHighlights(container)
  if (!term) return 0

  const lowerTerm = term.toLowerCase()
  let matchCount = 0

  // Collect text nodes via TreeWalker
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null)
  const textNodes: Text[] = []
  let node: Node | null
  while ((node = walker.nextNode())) {
    textNodes.push(node as Text)
  }

  // Process each text node (iterate in reverse so DOM mutations don't affect indices)
  for (let i = textNodes.length - 1; i >= 0; i--) {
    const textNode = textNodes[i]
    const text = textNode.textContent || ''
    const lowerText = text.toLowerCase()

    // Find all match positions in this text node
    const positions: number[] = []
    let searchFrom = 0
    while (searchFrom < lowerText.length) {
      const idx = lowerText.indexOf(lowerTerm, searchFrom)
      if (idx === -1) break
      positions.push(idx)
      searchFrom = idx + lowerTerm.length
    }

    if (positions.length === 0) continue

    const parent = textNode.parentNode
    if (!parent) continue

    // Split text node into segments with marks
    const fragment = document.createDocumentFragment()
    let lastEnd = 0

    for (const pos of positions) {
      // Text before match
      if (pos > lastEnd) {
        fragment.appendChild(document.createTextNode(text.slice(lastEnd, pos)))
      }
      // The match
      const mark = document.createElement('mark')
      mark.className = HIGHLIGHT_CLASS
      mark.textContent = text.slice(pos, pos + term.length)
      fragment.appendChild(mark)
      matchCount++
      lastEnd = pos + term.length
    }

    // Remaining text after last match
    if (lastEnd < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastEnd)))
    }

    parent.replaceChild(fragment, textNode)
  }

  return matchCount
}

/**
 * Activate the match at `index` (0-based) — add .active class and scroll into view.
 */
export function activateMatch(container: HTMLElement, index: number): void {
  const marks = container.querySelectorAll(`mark.${HIGHLIGHT_CLASS}`)
  marks.forEach((m) => m.classList.remove(ACTIVE_CLASS))
  if (index >= 0 && index < marks.length) {
    marks[index].classList.add(ACTIVE_CLASS)
    marks[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}
