// Type declarations for modules that ship no types and have no installed @types.
// (redux-persist, react-dom/client, and history ship their own types — stubs removed;
//  url-parse is replaced by native URL and redux-logger removed in Phase 5.)

declare module 'redux-logger' {
  import { Middleware } from 'redux';

  interface LoggerOptions {
    level?: string;
    collapsed?: boolean;
  }

  export function createLogger(options?: LoggerOptions): Middleware;
}

// Static image imports — Vite resolves these to a URL string at build; tsc needs the ambient module.
declare module '*.png' {
  const src: string;
  export default src;
}
declare module '*.jpg' {
  const src: string;
  export default src;
}
declare module '*.gif' {
  const src: string;
  export default src;
}
declare module '*.svg' {
  const src: string;
  export default src;
}
