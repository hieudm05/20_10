/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  turnstile?: {
    render(
      container: string | HTMLElement,
      options: {
        sitekey: string;
        theme?: 'auto' | 'light' | 'dark';
        callback?: (token: string) => void;
        'error-callback'?: () => void;
        'expired-callback'?: () => void;
      },
    ): string;
    reset(widgetId?: string): void;
  };
}
