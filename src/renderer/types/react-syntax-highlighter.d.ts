declare module 'react-syntax-highlighter' {
  import { ComponentType, ReactNode } from 'react'

  interface SyntaxHighlighterProps {
    language?: string
    style?: { [key: string]: React.CSSProperties }
    children: string | string[]
    customStyle?: React.CSSProperties
    PreTag?: string | ComponentType<any>
    [key: string]: any
  }

  export const Prism: ComponentType<SyntaxHighlighterProps>
  export const Light: ComponentType<SyntaxHighlighterProps>
  export default ComponentType<SyntaxHighlighterProps>
}

declare module 'react-syntax-highlighter/dist/esm/styles/prism' {
  export const oneDark: { [key: string]: React.CSSProperties }
  export const oneLight: { [key: string]: React.CSSProperties }
  export const vscDarkPlus: { [key: string]: React.CSSProperties }
  export const dracula: { [key: string]: React.CSSProperties }
  export const nord: { [key: string]: React.CSSProperties }
}
