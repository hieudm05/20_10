const hoaSuaTrack = new URL('./assets/hoa-sua.mp3', import.meta.url).href;

/** Background playback for the locally supplied Hoa Sữa track. */
export class BackgroundMusic {
  private readonly player = new Audio(hoaSuaTrack);
  private frame = 0;
  private operation = 0;
  private finishFade: (() => void) | undefined;
  private readonly targetVolume = 0.34;

  constructor() {
    this.player.loop = true;
    this.player.preload = 'auto';
    this.player.volume = 0;
  }

  async start(): Promise<void> {
    const operation = ++this.operation;
    this.cancelFade();
    if (this.player.ended) this.player.currentTime = 0;
    try {
      await this.player.play();
    } catch (error) {
      if (operation !== this.operation) return;
      throw error;
    }
    if (operation !== this.operation) return;
    await this.fadeTo(this.targetVolume, 900, operation);
  }

  async stop(immediate = false): Promise<void> {
    const operation = ++this.operation;
    this.cancelFade();
    if (immediate || this.player.paused) {
      this.player.volume = 0;
      this.player.pause();
      return;
    }
    await this.fadeTo(0, 320, operation);
    if (operation !== this.operation) return;
    this.player.pause();
  }

  async dispose(): Promise<void> {
    await this.stop(true);
    this.player.removeAttribute('src');
    this.player.load();
  }

  private cancelFade(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    const finish = this.finishFade;
    this.finishFade = undefined;
    finish?.();
  }

  private fadeTo(target: number, duration: number, operation: number): Promise<void> {
    this.cancelFade();
    const startingVolume = this.player.volume;
    const startedAt = performance.now();
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        if (this.finishFade === finish) this.finishFade = undefined;
        resolve();
      };
      this.finishFade = finish;

      const step = (now: number) => {
        if (operation !== this.operation) {
          this.frame = 0;
          finish();
          return;
        }
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - (1 - progress) ** 3;
        this.player.volume = startingVolume + (target - startingVolume) * eased;
        if (progress < 1) this.frame = requestAnimationFrame(step);
        else {
          this.frame = 0;
          finish();
        }
      };
      this.frame = requestAnimationFrame(step);
    });
  }
}
