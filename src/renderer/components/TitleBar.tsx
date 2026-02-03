declare global {
  interface Window {
    windowControls: {
      minimize: () => void
      maximize: () => void
      close: () => void
    }
  }
}

export default function TitleBar() {
  return (
    <header className="title-bar">
      <div className="title-bar-drag">
        <div className="title-logo" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="14" stroke="url(#logoGrad)" strokeWidth="2"/>
            <circle cx="11" cy="13" r="3" fill="#00D9FF"/>
            <circle cx="21" cy="13" r="3" fill="#FF00FF"/>
            <path d="M10 22 Q16 26 22 22" stroke="#00FF88" strokeWidth="2" strokeLinecap="round" fill="none"/>
            <defs>
              <linearGradient id="logoGrad" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stopColor="#00D9FF"/>
                <stop offset="100%" stopColor="#FF00FF"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="title">묘로드</span>
      </div>
      <div className="window-controls">
        <button
          className="window-control minimize"
          onClick={() => window.windowControls.minimize()}
          aria-label="Minimize"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1" fill="currentColor" />
          </svg>
        </button>
        <button
          className="window-control maximize"
          onClick={() => window.windowControls.maximize()}
          aria-label="Maximize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
        <button
          className="window-control close"
          onClick={() => window.windowControls.close()}
          aria-label="Close"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" />
            <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </header>
  )
}
