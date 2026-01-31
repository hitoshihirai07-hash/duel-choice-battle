// WebAudio（外部ファイル不要）で BGM / SE を鳴らす小さめユーティリティ
// - 音声ファイルを同梱しないので容量が増えない
// - 自動再生制限があるので、最初のユーザー操作で ensureAudio() を呼ぶ

export type SoundSettings = {
  /** 0〜1（ON/OFFなら 0/1 でOK） */
  sfx: number;
  /** 0〜1（ON/OFFなら 0/1 でOK） */
  bgm: number;
};

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bgmGain: GainNode | null = null;
let sfxGain: GainNode | null = null;

let bgmOscA: OscillatorNode | null = null;
let bgmOscB: OscillatorNode | null = null;
let bgmFilter: BiquadFilterNode | null = null;
let bgmInterval: number | null = null;

let settings: SoundSettings = { sfx: 1, bgm: 1 };

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;

  const AnyWin = window as any;
  const AC: typeof AudioContext | undefined = AnyWin.AudioContext || AnyWin.webkitAudioContext;
  if (!AC) return null;

  ctx = new AC();

  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  bgmGain = ctx.createGain();
  bgmGain.gain.value = 0;
  bgmGain.connect(master);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0;
  sfxGain.connect(master);

  applySettings(settings);
  return ctx;
}

export async function ensureAudio(): Promise<boolean> {
  const c = getAudioContext();
  if (!c) return false;
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      // ignore
    }
  }
  return c.state === "running";
}

export function applySettings(next: SoundSettings) {
  settings = {
    sfx: clamp01(next.sfx),
    bgm: clamp01(next.bgm),
  };

  const c = getAudioContext();
  if (!c || !bgmGain || !sfxGain) return;

  // ざっくり「心地よい」音量にスケール（ON/OFFなら 0/1 を入れるだけでOK）
  const targetBgm = settings.bgm * 0.16;
  const targetSfx = settings.sfx * 0.75;

  const t = c.currentTime;
  bgmGain.gain.cancelScheduledValues(t);
  bgmGain.gain.setTargetAtTime(targetBgm, t, 0.02);

  sfxGain.gain.cancelScheduledValues(t);
  sfxGain.gain.setTargetAtTime(targetSfx, t, 0.01);

  if (settings.bgm <= 0.001) {
    // 音量 0 にしたら BGM 自体も止める（CPU節約）
    stopBgm();
  }
}

export function startBgm() {
  const c = getAudioContext();
  if (!c || !bgmGain) return;
  if (settings.bgm <= 0.001) return;
  if (bgmOscA || bgmOscB) return; // already

  // 軽いアンビエントっぽいループ（2osc + lowpass）
  bgmFilter = c.createBiquadFilter();
  bgmFilter.type = "lowpass";
  bgmFilter.frequency.value = 900;
  bgmFilter.Q.value = 0.6;

  const bus = c.createGain();
  bus.gain.value = 0.35;

  bus.connect(bgmFilter);
  bgmFilter.connect(bgmGain);

  bgmOscA = c.createOscillator();
  bgmOscA.type = "triangle";
  bgmOscA.frequency.value = 196; // G3

  bgmOscB = c.createOscillator();
  bgmOscB.type = "sine";
  bgmOscB.frequency.value = 247; // B3

  bgmOscA.connect(bus);
  bgmOscB.connect(bus);

  const t0 = c.currentTime;
  bgmOscA.start(t0);
  bgmOscB.start(t0);

  // コード進行（ゆっくり）
  const chords: Array<[number, number]> = [
    [196, 247], // G
    [220, 262], // A
    [174, 220], // F
    [196, 247], // G
  ];
  let step = 0;
  bgmInterval = window.setInterval(() => {
    if (!ctx || !bgmOscA || !bgmOscB) return;
    if (settings.bgm <= 0.001) return;
    const [a, b] = chords[step % chords.length];
    const t = ctx.currentTime;
    bgmOscA.frequency.setTargetAtTime(a, t, 0.08);
    bgmOscB.frequency.setTargetAtTime(b, t, 0.08);
    step++;
  }, 2400);
}

export function stopBgm() {
  const c = getAudioContext();
  if (bgmInterval != null) {
    window.clearInterval(bgmInterval);
    bgmInterval = null;
  }
  if (bgmOscA) {
    try {
      bgmOscA.stop();
    } catch {
      // ignore
    }
    bgmOscA.disconnect();
    bgmOscA = null;
  }
  if (bgmOscB) {
    try {
      bgmOscB.stop();
    } catch {
      // ignore
    }
    bgmOscB.disconnect();
    bgmOscB = null;
  }
  if (bgmFilter) {
    try {
      bgmFilter.disconnect();
    } catch {
      // ignore
    }
    bgmFilter = null;
  }

  // フェードアウト
  if (c && bgmGain) {
    const t = c.currentTime;
    bgmGain.gain.setTargetAtTime(0, t, 0.03);
  }
}

export type SfxKind =
  | "click"
  | "select"
  | "confirm"
  | "hit"
  | "heal"
  | "buff"
  | "debuff"
  | "swap"
  | "win"
  | "lose";

export function playSfx(kind: SfxKind) {
  const c = getAudioContext();
  if (!c || !sfxGain) return;
  if (settings.sfx <= 0.001) return;

  // クリック/効果音は短いオシレーター＋エンベロープで。
  const osc = c.createOscillator();
  const g = c.createGain();
  const f = c.createBiquadFilter();

  f.type = "lowpass";
  f.frequency.value = 1600;
  f.Q.value = 0.7;

  osc.connect(g);
  g.connect(f);
  f.connect(sfxGain);

  const t = c.currentTime;
  const dur = 0.08;

  let base = 440;
  let type: OscillatorType = "sine";
  let sweep = 0;

  switch (kind) {
    case "click":
      base = 520;
      type = "square";
      sweep = -220;
      break;
    case "select":
      base = 660;
      type = "triangle";
      sweep = -120;
      break;
    case "confirm":
      base = 780;
      type = "triangle";
      sweep = 90;
      break;
    case "hit":
      base = 180;
      type = "square";
      sweep = -80;
      f.frequency.value = 900;
      break;
    case "heal":
      base = 520;
      type = "sine";
      sweep = 220;
      f.frequency.value = 2200;
      break;
    case "buff":
      base = 420;
      type = "triangle";
      sweep = 160;
      break;
    case "debuff":
      base = 360;
      type = "triangle";
      sweep = -160;
      break;
    case "swap":
      base = 480;
      type = "square";
      sweep = 120;
      break;
    case "win":
      base = 660;
      type = "sine";
      sweep = 330;
      break;
    case "lose":
      base = 240;
      type = "sine";
      sweep = -120;
      break;
  }

  osc.type = type;
  osc.frequency.setValueAtTime(base, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(40, base + sweep), t + dur);

  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.8, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  osc.start(t);
  osc.stop(t + dur + 0.02);

  // 後始末
  osc.onended = () => {
    try {
      osc.disconnect();
      g.disconnect();
      f.disconnect();
    } catch {
      // ignore
    }
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
