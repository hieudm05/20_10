import './style.css';
import './fonts.css';
import { flowerWishes } from './content';
import { BackgroundMusic } from './audio';
import { copyLink, getShareUrl, shareCard } from './share';
import type { BouquetScene } from './scene';

document.documentElement.classList.add('js');
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const experience = el<HTMLElement>('experience');
const trigger = el<HTMLElement>('scene-root');
trigger.setAttribute('role', 'button');
trigger.setAttribute('aria-label', 'Chạm vào bó hoa sữa Alstonia scholaris để mở thiệp.');
trigger.setAttribute('aria-controls', 'letter-card');
trigger.setAttribute('aria-describedby', 'bouquet-hint');
trigger.setAttribute('aria-expanded', 'false');
trigger.tabIndex = 0;
const letter = el<HTMLElement>('letter-card');
const fallingWish = el<HTMLElement>('falling-wish');
const soundButton = el<HTMLButtonElement>('sound-toggle');
const replayButton = el<HTMLButtonElement>('replay-sequence');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const pageLoader = document.getElementById('page-loader');
const pageLoadStartedAt = performance.now();
let pageLoadFinished = false;
let pageLoadFallback: ReturnType<typeof setTimeout> | undefined;

function finishPageLoad(): void {
  if (pageLoadFinished || !document.documentElement.classList.contains('page-loading')) return;
  pageLoadFinished = true;
  if (pageLoadFallback) clearTimeout(pageLoadFallback);
  const minimumDuration = reducedMotion.matches ? 1900 : 2600;
  const remainingDuration = Math.max(0, minimumDuration - (performance.now() - pageLoadStartedAt));
  window.setTimeout(() => {
    document.documentElement.classList.add('page-entering');
    pageLoader?.classList.add('is-exiting');
    pageLoader?.setAttribute('aria-hidden', 'true');
    document.documentElement.classList.remove('page-loading');
    window.setTimeout(() => pageLoader?.remove(), reducedMotion.matches ? 480 : 760);
    window.setTimeout(
      () => document.documentElement.classList.remove('page-entering'),
      reducedMotion.matches ? 1500 : 2400,
    );
  }, remainingDuration);
}

if (document.documentElement.classList.contains('page-loading')) {
  pageLoadFallback = window.setTimeout(finishPageLoad, 6000);
}
type SceneState =
  | 'bouquet_idle'
  | 'ribbon_release'
  | 'flowers_separate'
  | 'letter_emerge'
  | 'letter_open'
  | 'wishes_reveal';
const timeline = [
  { at: 0, state: 'ribbon_release' as const },
  { at: 0.55, state: 'flowers_separate' as const },
  { at: 6.35, state: 'letter_emerge' as const },
  { at: 8.9, desktopAt: 9.7, state: 'letter_open' as const },
  { at: 10.1, desktopAt: 10.6, state: 'wishes_reveal' as const },
];
const desktopViewport = matchMedia('(min-width: 601px)');
const SEQUENCE_DURATION = 13;
const REDUCED_MOBILE_SEQUENCE_FACTOR = 0.6;
const sequenceFactor = () =>
  reducedMotion.matches && !desktopViewport.matches ? REDUCED_MOBILE_SEQUENCE_FACTOR : 1;
const wishMoments = flowerWishes.map((wish, index) => ({ wish, at: 0.9 + index * 1.12 }));
let scene: BouquetScene | undefined;
let sequenceStartedAt = 0;
let sequenceComplete = false;
let timelineFrame = 0;
let currentState: SceneState = 'bouquet_idle';
let nextWish = 0;
let soundEnabled = false;
let resumeSoundOnVisible = false;
let userChangedSound = false;
const audio = new BackgroundMusic();
let statusTimer: ReturnType<typeof setTimeout>;
let sharing = false;

function announce(message: string): void {
  const status = el<HTMLElement>('status');
  clearTimeout(statusTimer);
  status.textContent = message;
  status.classList.add('is-visible');
  statusTimer = setTimeout(() => status.classList.remove('is-visible'), 5000);
}

function revealLetter(): void {
  if (experience.classList.contains('is-letter-open')) return;
  experience.classList.add('is-letter-open');
  trigger.setAttribute('aria-expanded', 'true');
  fallingWish.classList.remove('is-visible');
  letter.focus({ preventScroll: true });
  requestAnimationFrame(() =>
    letter.scrollIntoView({
      behavior: reducedMotion.matches ? 'instant' : 'smooth',
      block: 'center',
    }),
  );
}

function finishSequence(): void {
  if (sequenceComplete) return;
  cancelAnimationFrame(timelineFrame);
  timelineFrame = 0;
  sequenceComplete = true;
  experience.classList.add('is-started', 'is-unwrapped', 'is-envelope', 'is-seal');
  currentState = 'wishes_reveal';
  experience.dataset.sceneState = currentState;
  revealLetter();
  experience.classList.add('is-complete');
  el<HTMLElement>('flower-hotspots').hidden = false;
  replayButton.hidden = false;
  scene?.finish();
}

function setSceneState(state: SceneState): void {
  if (currentState === state) return;
  currentState = state;
  experience.dataset.sceneState = state;
  if (state === 'letter_emerge') experience.classList.add('is-unwrapped', 'is-envelope');
  if (state === 'letter_open') {
    experience.classList.add('is-seal');
    revealLetter();
  }
}

function updateTimeline(now: number): void {
  timelineFrame = 0;
  if (!sequenceStartedAt || sequenceComplete || document.hidden) return;
  const elapsed = (now - sequenceStartedAt) / 1000;
  const factor = sequenceFactor();
  const state = [...timeline].reverse().find((step) => {
    const at =
      desktopViewport.matches && 'desktopAt' in step && typeof step.desktopAt === 'number'
        ? step.desktopAt
        : step.at;
    return elapsed >= at * factor;
  })?.state;
  if (state) setSceneState(state);
  if (elapsed >= 7 * factor) experience.classList.add('is-seal');

  while (nextWish < wishMoments.length && elapsed >= wishMoments[nextWish].at * factor) {
    fallingWish.classList.remove('is-visible');
    fallingWish.textContent = wishMoments[nextWish].wish.name;
    void fallingWish.offsetWidth;
    fallingWish.classList.add('is-visible');
    nextWish += 1;
  }
  if (elapsed >= 6 * factor) fallingWish.classList.remove('is-visible');
  if (elapsed >= SEQUENCE_DURATION * factor) {
    finishSequence();
    return;
  }
  timelineFrame = requestAnimationFrame(updateTimeline);
}

function startSequence(): void {
  if (sequenceStartedAt || sequenceComplete) return;
  if (!soundEnabled && !userChangedSound) enableMusic();
  trigger.setAttribute('aria-disabled', 'true');
  trigger.tabIndex = -1;
  sequenceStartedAt = performance.now();
  experience.classList.add('is-started');
  setSceneState('ribbon_release');
  scene?.play(reducedMotion.matches);
  timelineFrame = requestAnimationFrame(updateTimeline);
}

function replaySequence(): void {
  if (!sequenceComplete) return;
  sequenceStartedAt = performance.now();
  sequenceComplete = false;
  currentState = 'bouquet_idle';
  nextWish = 0;
  experience.classList.remove(
    'is-started',
    'is-unwrapped',
    'is-envelope',
    'is-seal',
    'is-letter-open',
    'is-complete',
  );
  experience.dataset.sceneState = currentState;
  trigger.setAttribute('aria-expanded', 'false');
  experience.classList.add('is-started');
  trigger.setAttribute('aria-disabled', 'true');
  trigger.tabIndex = -1;
  el<HTMLElement>('flower-hotspots').hidden = true;
  replayButton.hidden = true;
  fallingWish.classList.remove('is-visible');
  fallingWish.textContent = '';
  setSceneState('ribbon_release');
  scene?.play(reducedMotion.matches);
  trigger.focus({ preventScroll: true });
  requestAnimationFrame(() => {
    experience.scrollIntoView({
      behavior: reducedMotion.matches ? 'instant' : 'smooth',
      block: 'start',
    });
  });
  timelineFrame = requestAnimationFrame(updateTimeline);
}
trigger.addEventListener('click', startSequence);
trigger.addEventListener('keydown', (event: KeyboardEvent) => {
  if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
    event.preventDefault();
    startSequence();
  }
});
replayButton.addEventListener('click', replaySequence);
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) finishPageLoad();
  scene?.setMotion(!reducedMotion.matches);
  if (reducedMotion.matches && sequenceStartedAt && !sequenceComplete) finishSequence();
});

const revealSections = document.querySelectorAll<HTMLElement>('.scroll-reveal');
if (reducedMotion.matches) {
  revealSections.forEach((section) => section.classList.add('is-revealed'));
} else if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -36px 0px' },
  );
  revealSections.forEach((section) => revealObserver.observe(section));
} else {
  revealSections.forEach((section) => section.classList.add('is-revealed'));
}

function selectFlower(index: number): void {
  const wish = flowerWishes[index];
  if (!wish || !sequenceComplete) return;
  const selected = el<HTMLElement>('selected-wish');
  selected.textContent = `${wish.name} — ${wish.text}`;
  selected.classList.remove('is-changing');
  if (!reducedMotion.matches) {
    void selected.offsetWidth;
    selected.classList.add('is-changing');
  }
  document.querySelectorAll<HTMLButtonElement>('[data-flower]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.flower) === index));
  });
  if (document.activeElement?.classList.contains('flower-hotspot')) {
    selected.scrollIntoView({
      behavior: reducedMotion.matches ? 'instant' : 'smooth',
      block: 'nearest',
    });
  }
}
document.querySelectorAll<HTMLButtonElement>('[data-flower]').forEach((button) => {
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => selectFlower(Number(button.dataset.flower)));
});

const thankYouForm = el<HTMLFormElement>('thank-you-form');
const thankYouName = el<HTMLInputElement>('thank-you-name');
const thankYouMessage = el<HTMLTextAreaElement>('thank-you-message');
const thankYouCount = el<HTMLElement>('thank-you-count');
const thankYouSubmit = el<HTMLButtonElement>('thank-you-submit');
const thankYouStatus = el<HTMLElement>('thank-you-status');
const thankYouDetails = el<HTMLDetailsElement>('thank-you-details');
const thankYouTurnstile = el<HTMLElement>('thank-you-turnstile');
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
let turnstileToken = '';
let turnstileWidgetId: string | undefined;
let turnstileLoadPromise: Promise<void> | undefined;
let lastThankYouSentAt = 0;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (turnstileLoadPromise) return turnstileLoadPromise;

  turnstileLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.onload = () =>
      window.turnstile ? resolve() : reject(new Error('Turnstile unavailable'));
    script.onerror = () => reject(new Error('Turnstile failed to load'));
    document.head.append(script);
  });
  return turnstileLoadPromise;
}

async function prepareTurnstile(): Promise<void> {
  if (!turnstileSiteKey) {
    setThankYouStatus('Phần gửi email đang chờ cấu hình chống spam và hộp thư.');
    return;
  }
  if (turnstileWidgetId) return;

  setThankYouStatus('Đang tải bước xác minh an toàn…');
  try {
    await loadTurnstile();
    if (!thankYouDetails.open || turnstileWidgetId || !window.turnstile) return;
    turnstileWidgetId = window.turnstile.render(thankYouTurnstile, {
      sitekey: turnstileSiteKey,
      theme: 'dark',
      callback: (token) => {
        turnstileToken = token;
        setThankYouStatus('Đã xác minh. Bạn có thể gửi lời nhắn.');
      },
      'error-callback': () => {
        turnstileToken = '';
        setThankYouStatus('Không tải được bước xác minh. Hãy thử tải lại trang.');
      },
      'expired-callback': () => {
        turnstileToken = '';
        setThankYouStatus('Bước xác minh đã hết hạn. Hãy xác minh lại nhé.');
      },
    });
    setThankYouStatus('Hoàn tất bước xác minh để gửi lời nhắn.');
  } catch {
    setThankYouStatus('Không kết nối được bước xác minh. Hãy thử lại sau.');
  }
}

thankYouDetails.addEventListener('toggle', () => {
  if (thankYouDetails.open) void prepareTurnstile();
});

function setThankYouStatus(message: string): void {
  thankYouStatus.textContent = message;
  thankYouStatus.classList.remove('is-visible');
  void thankYouStatus.offsetWidth;
  if (message) thankYouStatus.classList.add('is-visible');
}

thankYouMessage.addEventListener('input', () => {
  thankYouCount.textContent = `${thankYouMessage.value.length}/600`;
});

thankYouForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const message = thankYouMessage.value.trim();
  if (message.length < 4) {
    setThankYouStatus('Bạn viết thêm vài chữ nhé, Hiếu muốn đọc trọn lời nhắn của bạn.');
    thankYouMessage.focus();
    return;
  }

  const honeypot = el<HTMLInputElement>('thank-you-website');
  if (honeypot.value) {
    thankYouForm.reset();
    thankYouCount.textContent = '0/600';
    setThankYouStatus('Cảm ơn bạn đã ghé thăm tấm thiệp.');
    return;
  }

  if (!turnstileSiteKey || !turnstileToken) {
    setThankYouStatus(
      turnstileSiteKey
        ? 'Hãy hoàn tất bước xác minh trước khi gửi lời nhắn.'
        : 'Phần gửi email đang chờ cấu hình trước khi nhận lời nhắn.',
    );
    return;
  }

  const now = Date.now();
  if (now - lastThankYouSentAt < 30_000) {
    setThankYouStatus('Bạn chờ một chút rồi gửi lời nhắn tiếp theo nhé.');
    return;
  }

  thankYouSubmit.disabled = true;
  setThankYouStatus('Đang gửi lời nhắn…');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch('/api/thank-you', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: thankYouName.value.trim(),
        message,
        website: honeypot.value,
        turnstileToken,
      }),
      credentials: 'same-origin',
      signal: controller.signal,
    });
    turnstileToken = '';
    if (turnstileWidgetId) window.turnstile?.reset(turnstileWidgetId);
    if (response.status === 429) {
      setThankYouStatus('Có quá nhiều lời nhắn trong thời gian ngắn. Bạn quay lại sau nhé.');
      return;
    }
    if (response.status === 503) {
      setThankYouStatus('Hộp thư chưa được cấu hình hoàn tất. Lời nhắn này chưa được gửi.');
      return;
    }
    if (response.status === 400) {
      setThankYouStatus('Bước xác minh chưa hợp lệ. Hãy xác minh lại rồi thử gửi nhé.');
      return;
    }
    if (!response.ok) throw new Error(`Thank-you endpoint returned ${response.status}`);

    lastThankYouSentAt = Date.now();
    thankYouForm.reset();
    thankYouCount.textContent = '0/600';
    setThankYouStatus('Cảm ơn bạn. Lời nhắn đã được gửi riêng qua email đến Hiếu.');
  } catch {
    setThankYouStatus('Chưa gửi được lời nhắn. Bạn thử lại sau ít phút nhé.');
  } finally {
    window.clearTimeout(timeout);
    if (turnstileToken) {
      turnstileToken = '';
      if (turnstileWidgetId) window.turnstile?.reset(turnstileWidgetId);
    }
    thankYouSubmit.disabled = false;
  }
});

function updateSound(): void {
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  const label = soundEnabled ? 'Tắt nhạc' : 'Bật nhạc';
  soundButton.setAttribute('aria-label', label);
  document
    .getElementById('sound-icon')
    ?.setAttribute('href', soundEnabled ? '#i-sound' : '#i-sound-off');
  el('sound-label').textContent = label;
}

function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  updateSound();
}

function startMusic(): Promise<void> {
  return audio.start();
}

function enableMusic(): void {
  void startMusic()
    .then(() => {
      if (!document.hidden) setSoundEnabled(true);
    })
    .catch(() => setSoundEnabled(false));
}

function stopMusic(): void {
  setSoundEnabled(false);
  void audio.stop(document.hidden).catch(() => undefined);
}

soundButton.addEventListener('click', async () => {
  userChangedSound = true;
  if (soundEnabled) {
    stopMusic();
    return;
  }
  try {
    await startMusic();
    setSoundEnabled(!document.hidden);
    if (document.hidden) await audio.stop(true);
  } catch {
    setSoundEnabled(false);
    announce('Trình duyệt đang chặn âm thanh. Hãy chạm vào trang rồi thử bật nhạc lại.');
  }
});

document.addEventListener(
  'pointerdown',
  (event: PointerEvent) => {
    if (soundEnabled || userChangedSound) return;
    if (event.target instanceof Element && event.target.closest('#sound-toggle')) return;
    enableMusic();
  },
  { once: true },
);

// Browsers that block sound on page load get another start attempt on first bouquet tap.
void startMusic()
  .then(() => {
    if (!userChangedSound && !document.hidden) setSoundEnabled(true);
    else if (document.hidden) void audio.stop(true);
  })
  .catch(() => setSoundEnabled(false));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    resumeSoundOnVisible = soundEnabled;
    if (soundEnabled) stopMusic();
    return;
  }
  if (!resumeSoundOnVisible) return;
  resumeSoundOnVisible = false;
  enableMusic();
});

function showManualCopy(): void {
  el('manual-copy').hidden = false;
  const input = el<HTMLInputElement>('share-url');
  input.value = getShareUrl();
  input.focus();
  input.select();
  announce('Trình duyệt chưa cho phép sao chép tự động. Hãy sao chép liên kết đang được chọn.');
}
for (const id of ['share-card', 'copy-link'] as const) {
  const button = el<HTMLButtonElement>(id);
  button.addEventListener('click', async () => {
    if (sharing) return;
    sharing = true;
    button.disabled = true;
    try {
      const result =
        id === 'share-card' ? await shareCard() : (await copyLink()) ? 'copied' : 'manual';
      if (result === 'shared') announce('Đã mở chia sẻ lời chúc. Cảm ơn bạn!');
      if (result === 'copied')
        announce('Đã sao chép liên kết. Gửi một chút dịu dàng đến người bạn quý mến nhé!');
      if (result === 'manual') showManualCopy();
    } catch {
      showManualCopy();
    } finally {
      sharing = false;
      button.disabled = false;
    }
  });
}

// The 3D chunk is optional. It can join a sequence already in progress without restarting it.
void (async () => {
  try {
    const { createBouquetScene } = await import('./scene');
    scene = createBouquetScene(el('scene-root'));
    if (sequenceComplete) scene.finish();
    else if (sequenceStartedAt)
      scene.play(reducedMotion.matches, (performance.now() - sequenceStartedAt) / 1000);
  } catch {
    /* The CSS bouquet and the complete HTML letter remain usable. */
  } finally {
    finishPageLoad();
  }
})();
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    scene?.dispose();
    void audio.dispose().catch(() => undefined);
  }
});
