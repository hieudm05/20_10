import { shareContent } from './content';

export function getShareUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('to');
  url.hash = '';
  return url.toString();
}

export async function copyLink(): Promise<boolean> {
  const url = getShareUrl();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return true;
    }
  } catch {
    /* A blocked Clipboard API can still allow copying during a click. */
  }
  const previousFocus = document.activeElement as HTMLElement | null;
  const textarea = document.createElement('textarea');
  textarea.value = url;
  textarea.setAttribute('readonly', '');
  textarea.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';
  document.body.append(textarea);
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    /* Show a selectable link instead. */
  }
  textarea.remove();
  previousFocus?.focus({ preventScroll: true });
  return copied;
}

export async function shareCard(): Promise<'shared' | 'cancelled' | 'copied' | 'manual'> {
  const data = { ...shareContent, url: getShareUrl() };
  if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare(data))) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  return (await copyLink()) ? 'copied' : 'manual';
}
