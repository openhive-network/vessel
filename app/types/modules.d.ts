// Type declarations for modules during transition period
// These will be replaced by actual types once npm install runs with new packages

declare module 'redux-persist/integration/react' {
  import { ComponentType, ReactNode } from 'react';
  import { Persistor } from 'redux-persist';

  interface PersistGateProps {
    persistor: Persistor;
    loading?: ReactNode;
    children?: ReactNode;
  }

  export const PersistGate: ComponentType<PersistGateProps>;
}

declare module 'redux-persist/lib/storage' {
  import { Storage } from 'redux-persist';
  const storage: Storage;
  export default storage;
}

declare module 'redux-persist' {
  import { Reducer, Store } from 'redux';

  export interface PersistConfig<S> {
    key: string;
    storage: any;
    whitelist?: string[];
    blacklist?: string[];
  }

  export interface Persistor {
    purge(): Promise<void>;
    flush(): Promise<void>;
    pause(): void;
    persist(): void;
  }

  export function persistReducer<S>(config: PersistConfig<S>, reducer: Reducer<S>): Reducer<S>;
  export function persistStore(store: Store): Persistor;

  export const FLUSH: string;
  export const REHYDRATE: string;
  export const PAUSE: string;
  export const PERSIST: string;
  export const PURGE: string;
  export const REGISTER: string;
}

declare module 'react-dom/client' {
  import { ReactNode } from 'react';

  interface Root {
    render(children: ReactNode): void;
    unmount(): void;
  }

  export function createRoot(container: Element | DocumentFragment): Root;
}

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

declare module 'history' {
  export interface History {
    push(path: string): void;
    replace(path: string): void;
    go(n: number): void;
    goBack(): void;
    goForward(): void;
    listen(listener: (location: any) => void): () => void;
  }

  export function createHashHistory(): History;
  export function createBrowserHistory(): History;
}

declare module 'redux-logger' {
  import { Middleware } from 'redux';

  interface LoggerOptions {
    level?: string;
    collapsed?: boolean;
  }

  export function createLogger(options?: LoggerOptions): Middleware;
}
