// Type declarations for modules that ship no types and have no installed @types.
// (redux-persist, react-dom/client, and history ship their own types — stubs removed;
//  url-parse is replaced by native URL and redux-logger removed in Phase 5.)

declare module 'url-parse' {
  interface ParsedUrl {
    protocol: string;
    hostname: string;
    host: string;
    pathname: string;
    hash: string;
    query: Record<string, string>;
  }

  function parse(url: string, parseQuery?: boolean): ParsedUrl;
  export default parse;
}

declare module 'redux-logger' {
  import { Middleware } from 'redux';

  interface LoggerOptions {
    level?: string;
    collapsed?: boolean;
  }

  export function createLogger(options?: LoggerOptions): Middleware;
}
