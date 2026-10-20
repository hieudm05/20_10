import { test, expect, type Page } from '@playwright/test';

async function installAudioMock(page: Page, allowAutoplay: boolean): Promise<void> {
  await page.addInitScript((autoplayAllowed) => {
    const parameter = () => ({
      value: 0,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
    });
    class MockNode {
      gain = parameter();
      frequency = parameter();
      type = 'sine';
      onended: (() => void) | null = null;
      connect() {}
      disconnect() {}
      start() {}
      stop() {
        this.onended?.();
      }
    }
    class MockAudioContext {
      state: AudioContextState = 'suspended';
      currentTime = 0;
      destination = {};
      createGain() {
        return new MockNode();
      }
      createOscillator() {
        return new MockNode();
      }
      async resume() {
        if (!autoplayAllowed) throw new Error('Autoplay blocked');
        this.state = 'running';
      }
      async suspend() {
        this.state = 'suspended';
      }
      async close() {
        this.state = 'closed';
      }
    }
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: MockAudioContext,
    });
  }, allowAutoplay);
}

async function openWithReducedMotion(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: /Chạm vào bó hoa/ }).click();
  await expect(page.locator('#experience')).toHaveAttribute('data-scene-state', 'letter_open', {
    timeout: 7000,
  });
  await expect(page.locator('#experience')).toHaveClass(/is-complete/, { timeout: 3500 });
}

test('laptop still shows a gentle entrance and stepped sequence with reduced motion', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#scene-root canvas')).toBeVisible();
  await expect(page.locator('#page-loader')).toBeVisible();
  await expect(page.locator('html')).toHaveClass(/page-entering/, { timeout: 5000 });
  const introDuration = await page
    .locator('.hero-heading h1')
    .evaluate((heading) => getComputedStyle(heading).animationDuration);
  expect(introDuration).toBe('0.55s');

  await page.getByRole('button', { name: /Chạm vào bó hoa/ }).click();
  await expect(page.locator('#experience')).toHaveAttribute(
    'data-scene-state',
    'flowers_separate',
    {
      timeout: 1500,
    },
  );
  await page.waitForTimeout(500);
  await page.screenshot({
    path: testInfo.outputPath('laptop-reduced-motion-separating.png'),
    fullPage: false,
  });
  await expect(page.locator('#experience')).toHaveAttribute('data-scene-state', 'letter_open', {
    timeout: 11000,
  });
  await expect(page.locator('#scene-root')).toHaveAttribute(
    'data-alstonia-reduced-falling-clusters',
    '18',
  );
  await expect(page.locator('#scene-root')).toHaveAttribute('data-alstonia-envelope-slide', '1.00');
  await expect(page.locator('#scene-root')).toHaveAttribute('data-alstonia-letter-unfold', '1.00');
  const letterTransition = await page
    .locator('#letter-card')
    .evaluate((letter) => getComputedStyle(letter).transitionProperty);
  expect(letterTransition).toContain('transform');
  const paragraphAnimation = await page
    .locator('.letter-body p')
    .first()
    .evaluate((paragraph) => getComputedStyle(paragraph).animationName);
  expect(paragraphAnimation).toBe('reduced-letter-copy-reveal');
  await page.waitForTimeout(180);
  await page.screenshot({
    path: testInfo.outputPath('laptop-letter-opening-reduced-motion.png'),
    fullPage: false,
  });
  await page.waitForTimeout(2000);
  await page.screenshot({
    path: testInfo.outputPath('laptop-reduced-motion-letter-and-falling-flowers.png'),
    fullPage: true,
  });
  await expect(page.locator('#experience')).toHaveClass(/is-complete/, { timeout: 3500 });
});

test('one tap runs every step in order and finishes without another action', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await expect(page.locator('#scene-root canvas')).toBeVisible();
  await expect(page.locator('#experience')).toHaveAttribute('data-scene-state', 'bouquet_idle');
  await expect(page.locator('#letter-card')).toHaveCSS('visibility', 'hidden');
  await page.getByRole('button', { name: /Chạm vào bó hoa/ }).click();
  await expect(page.locator('#falling-wish')).toContainText('Bình an', { timeout: 2500 });
  await expect(page.locator('#falling-wish')).toContainText('Tự tin', { timeout: 2500 });
  await expect(page.locator('#falling-wish')).toContainText('Được yêu thương', { timeout: 2500 });
  await expect(page.locator('#experience')).toHaveClass(/is-unwrapped/, { timeout: 5000 });
  await expect(page.locator('#experience')).toHaveClass(/is-envelope/, { timeout: 2000 });
  await expect(page.locator('#experience')).toHaveClass(/is-seal/, { timeout: 2000 });
  await page.screenshot({ path: test.info().outputPath('seal.png'), fullPage: true });
  await expect(page.locator('#experience')).toHaveClass(/is-letter-open/, { timeout: 4000 });
  await expect(page.locator('#experience')).toHaveClass(/is-complete/, { timeout: 6000 });
  await expect(page.locator('.letter-body p')).toHaveCount(3);
  await expect(page.locator('.signature')).toContainText('Thân mến, Hiếu');
  await expect(page.getByRole('button', { name: 'Chia sẻ thiệp' })).toBeVisible();
  const replay = page.getByRole('button', { name: 'Xem lại khoảnh khắc' });
  await expect(replay).toBeVisible();
  await replay.click();
  await expect(page.locator('#experience')).toHaveAttribute('data-scene-state', 'bouquet_idle');
  await expect(page.locator('#experience')).not.toHaveClass(/is-letter-open/);
  await page.getByRole('button', { name: /Chạm vào bó hoa/ }).click();
  await expect(page.locator('#experience')).toHaveClass(/is-complete/, { timeout: 10000 });
  expect(errors).toEqual([]);
});

test('responsive layout and snapshots on portrait and landscape screens', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.locator('#scene-root canvas')).toBeVisible();
  await expect(page.locator('#experience')).toHaveAttribute('data-scene-state', 'bouquet_idle');
  await expect(page.locator('#letter-card')).toHaveCSS('visibility', 'hidden');
  await expect(page.locator('#scene-root')).toHaveAttribute('data-alstonia-sprigs', '11');
  await expect(page.locator('#scene-root')).toHaveAttribute('data-alstonia-clusters', '33');
  await expect(page.locator('#scene-root')).toHaveAttribute('data-alstonia-florets', '594');
  await expect(page.locator('#scene-root')).toHaveAttribute('data-alstonia-leaves', '66');
  await page.screenshot({
    path: testInfo.outputPath('desktop-milkflower-idle.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: /Chạm vào bó hoa/ }).click();
  await page.waitForTimeout(2300);
  await page.screenshot({
    path: testInfo.outputPath('desktop-milkflower-separation.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('#scene-root canvas')).toBeVisible();
  await expect(page.locator('#scene-root')).toHaveAttribute('data-alstonia-sprigs', '11');
  await expect(page.locator('#scene-root')).toHaveAttribute('data-alstonia-clusters', '33');
  await expect(page.locator('#scene-root')).toHaveAttribute('data-alstonia-florets', '462');
  await expect(page.locator('#scene-root')).toHaveAttribute('data-alstonia-leaves', '55');
  await page.screenshot({
    path: testInfo.outputPath('mobile-milkflower-idle.png'),
    fullPage: true,
  });
  await page.getByRole('button', { name: /Chạm vào bó hoa/ }).click();
  await page.waitForTimeout(2300);
  await page.screenshot({
    path: testInfo.outputPath('mobile-milkflower-separation.png'),
    fullPage: true,
  });
  await openWithReducedMotion(page);
  await expect(page.locator('#scene-root')).toHaveAttribute(
    'data-alstonia-reduced-falling-clusters',
    '12',
  );
  await page.waitForTimeout(700);
  await page.screenshot({
    path: testInfo.outputPath('mobile-reduced-motion-letter-and-falling-flowers.png'),
    fullPage: true,
  });
  for (const [width, height] of [
    [320, 568],
    [360, 800],
    [390, 844],
    [768, 1024],
    [1024, 1366],
    [1440, 1000],
    [568, 320],
    [800, 360],
    [844, 390],
    [1024, 768],
    [1366, 1024],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      `overflow at ${width}×${height}`,
    ).toBe(false);
    const bounds = await page.locator('button:visible').evaluateAll((buttons) =>
      buttons.map((button) => {
        const r = button.getBoundingClientRect();
        return {
          name: button.getAttribute('aria-label') || button.textContent?.trim(),
          width: r.width,
          height: r.height,
        };
      }),
    );
    for (const b of bounds) {
      expect(b.width, `${b.name} width`).toBeGreaterThanOrEqual(44);
      expect(b.height, `${b.name} height`).toBeGreaterThanOrEqual(44);
    }
    if (width === 390 && height === 844) {
      await page.evaluate(() => scrollTo(0, 0));
      await page.screenshot({ path: testInfo.outputPath('mobile-open.png'), fullPage: true });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('desktop-open.png'), fullPage: true });
});

test('flowers work by keyboard, screen hotspot and touch', async ({ page, browser }) => {
  await openWithReducedMotion(page);
  const labels = ['Bình an', 'Tự tin', 'Được yêu thương', 'Tỏa sáng', 'Được là mình'];
  for (const label of labels) {
    const button = page.getByRole('button', { name: `Bông hoa ${label}`, exact: true });
    await button.focus();
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#selected-wish')).toContainText(label);
  }
  await page.getByRole('button', { name: 'Chạm bông hoa Bình an' }).click();
  await expect(page.locator('#selected-wish')).toContainText('Bình an');
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    reducedMotion: 'reduce',
  });
  const mobile = await context.newPage();
  await mobile.goto('http://127.0.0.1:4173/');
  await mobile.getByRole('button', { name: /Chạm vào bó hoa/ }).tap();
  await mobile.getByRole('button', { name: 'Bông hoa Tự tin', exact: true }).tap();
  await expect(mobile.locator('#selected-wish')).toContainText('Tự tin');
  await context.close();
});

test('WebGL loss and unavailable WebGL keep the whole letter usable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#scene-root canvas')).toBeVisible();
  await page.locator('#scene-root canvas').evaluate((canvas) => {
    (canvas as HTMLCanvasElement)
      .getContext('webgl2')
      ?.getExtension('WEBGL_lose_context')
      ?.loseContext();
  });
  await expect(page.locator('#scene-fallback')).not.toHaveClass(/is-replaced/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: /Chạm vào bó hoa/ }).click();
  await expect(page.locator('#letter-card')).toContainText(/Nhân Ngày Phụ nữ Việt Nam 20\/10/);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type.includes('webgl')) return null;
      return original.apply(this, [type, ...args] as never);
    } as typeof original;
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#scene-root canvas')).toHaveCount(0);
  await expect(page.locator('#scene-fallback')).toBeVisible();
  await page.getByRole('button', { name: /Chạm vào bó hoa/ }).click();
  await expect(page.locator('#letter-card')).toBeVisible();
});

test('metadata and music stay visible with a truthful autoplay and control state', async ({
  page,
}) => {
  await installAudioMock(page, true);
  await page.goto('/');
  await expect(page).toHaveTitle(/20\/10/);
  await expect(page.locator('meta[name=description]')).toHaveAttribute(
    'content',
    /Phụ nữ Việt Nam 20\/10/,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /20\/10/);
  const music = page.locator('#sound-toggle');
  await expect(music).toBeVisible();
  await expect(music).toHaveAttribute('aria-label', 'Tắt nhạc');
  await expect(music).toHaveAttribute('aria-pressed', 'true');
  await music.click();
  await expect(music).toHaveAttribute('aria-label', 'Bật nhạc');
  await music.click();
  await expect(music).toHaveAttribute('aria-label', 'Tắt nhạc');
  await expect(music).toHaveAttribute('aria-pressed', 'true');
  await music.click();
  await expect(music).toHaveAttribute('aria-label', 'Bật nhạc');
  await expect(music).toHaveAttribute('aria-pressed', 'false');
});

test('blocked autoplay leaves music off and explains the browser limitation after a tap', async ({
  page,
}) => {
  await installAudioMock(page, false);
  await page.goto('/');
  const music = page.locator('#sound-toggle');
  await expect(music).toHaveAttribute('aria-label', 'Bật nhạc');
  await expect(music).toHaveAttribute('aria-pressed', 'false');
  await music.click();
  await expect(music).toHaveAttribute('aria-label', 'Bật nhạc');
  await expect(page.locator('#status')).toContainText('Trình duyệt chưa phát được nhạc.');
});

test('share, copy and denied clipboard after letter opens', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        (window as unknown as { shared: ShareData }).shared = data;
      },
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as unknown as { copied: string }).copied = value;
        },
      },
    });
  });
  await openWithReducedMotion(page);
  await page.getByRole('button', { name: 'Chia sẻ thiệp' }).click();
  expect(
    await page.evaluate(() => (window as unknown as { shared: ShareData }).shared.title),
  ).toContain('20/10');
  await page.getByRole('button', { name: 'Sao chép liên kết' }).click();
  expect(await page.evaluate(() => (window as unknown as { copied: string }).copied)).toBe(
    'http://127.0.0.1:4173/',
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('denied');
        },
      },
    });
    document.execCommand = () => false;
  });
  await page.getByRole('button', { name: 'Sao chép liên kết' }).click();
  await expect(page.locator('#share-url')).toBeVisible();
  await expect(page.locator('#share-url')).toBeFocused();
});

test('missing 3D chunk, offline after load and no JavaScript retain the letter', async ({
  page,
  context,
  browser,
}) => {
  await page.route('**/assets/scene-*.js', (route) => route.abort());
  await openWithReducedMotion(page);
  await expect(page.locator('#scene-fallback')).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Bông hoa Tỏa sáng', exact: true }).click();
  await expect(page.locator('#selected-wish')).toContainText('Tỏa sáng');
  await context.setOffline(false);
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  const staticPage = await noJs.newPage();
  await staticPage.goto('http://127.0.0.1:4173/');
  await expect(staticPage.locator('#letter-card')).toBeVisible();
  await expect(staticPage.locator('.signature')).toContainText('Thân mến, Hiếu');
  await noJs.close();
});
