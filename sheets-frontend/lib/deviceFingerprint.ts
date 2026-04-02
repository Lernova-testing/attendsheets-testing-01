export interface DeviceInfo {
  id: string;
  name: string;
  browser: string;
  os: string;
  device: string;
  screen: string;
  timezone: string;
}

// ---------------------------------------------------------------------------
// Hashing — FNV-1a 32-bit
// ---------------------------------------------------------------------------

function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Build a 32-char composite ID from multiple hardware signal hashes */
function buildId(...parts: string[]): string {
  return parts.map(fnv1a).join('').slice(0, 32);
}

// ---------------------------------------------------------------------------
// Hardware signal collectors
// ---------------------------------------------------------------------------

/** Canvas 2D pixel hash — reflects GPU renderer + installed fonts */
function canvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 280;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(0, 0, 280, 60);
    ctx.fillStyle = '#069';
    ctx.fillText('Lernova fingerprint test', 2, 2);
    ctx.font = '11px Georgia';
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('abcdefghijklmnopqrstuvwxyz0123456789', 2, 30);

    return fnv1a(canvas.toDataURL());
  } catch {
    return 'canvas-blocked';
  }
}

/** WebGL GPU renderer string — very stable hardware signal */
function webglFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (!gl) return 'no-webgl';

    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) {
      // Fallback: use basic GL parameters
      const vendor = gl.getParameter(gl.VENDOR) as string;
      const renderer = gl.getParameter(gl.RENDERER) as string;
      return fnv1a(`${vendor}::${renderer}`);
    }

    const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string;
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
    return fnv1a(`${vendor}::${renderer}`);
  } catch {
    return 'webgl-blocked';
  }
}

/** AudioContext fingerprint — audio hardware/driver signal */
async function audioFingerprint(): Promise<string> {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return 'no-audio';

    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const analyser = ctx.createAnalyser();
    const gain = ctx.createGain();

    gain.gain.value = 0; // silent — we only want the signal shape
    oscillator.type = 'triangle';
    oscillator.frequency.value = 10000;

    oscillator.connect(analyser);
    analyser.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(0);

    await new Promise<void>((resolve) => setTimeout(resolve, 100));

    const buffer = new Float32Array(analyser.frequencyBinCount);
    analyser.getFloatFrequencyData(buffer);
    oscillator.stop();
    await ctx.close();

    const sample = Array.from(buffer.slice(0, 30))
      .map((n) => n.toFixed(4))
      .join(',');
    return fnv1a(sample);
  } catch {
    return 'audio-blocked';
  }
}

/** Screen geometry + hardware metrics */
function screenFingerprint(): string {
  const s = window.screen;
  return fnv1a(
    [
      s.width,
      s.height,
      s.colorDepth,
      s.pixelDepth,
      window.devicePixelRatio ?? 1,
      navigator.hardwareConcurrency ?? 0,
    ].join('|')
  );
}

/** Sample installed fonts using Canvas measureText width differences */
function fontFingerprint(): string {
  try {
    const testFonts = [
      'Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New',
      'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Tahoma', 'Palatino',
      'Garamond', 'Bookman', 'Arial Black', 'Helvetica', 'Calibri',
    ];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-font-ctx';

    const TEST_STRING = 'mmmmmmmmlli';
    ctx.font = '72px monospace';
    const baseWidth = ctx.measureText(TEST_STRING).width;

    const available = testFonts.filter((font) => {
      ctx.font = `72px '${font}', monospace`;
      return ctx.measureText(TEST_STRING).width !== baseWidth;
    });

    return fnv1a(available.join(','));
  } catch {
    return 'font-blocked';
  }
}

/** Timezone + locale — locale-based, never network-based */
function timezoneFingerprint(): string {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const locale = navigator.language || 'unknown';
  return fnv1a(`${tz}::${locale}`);
}

/** UA platform string — stable for the same browser install */
function platformFingerprint(): string {
  return fnv1a(
    [navigator.platform, navigator.userAgent, navigator.vendor ?? ''].join('|')
  );
}

// ---------------------------------------------------------------------------
// Persistence — cache the computed ID in localStorage so:
//   1. The ID is identical on every page load (avoids recomputation drift)
//   2. Switching WiFi / mobile data / VPN does NOT change the ID
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'lernova_device_fp';

function loadCachedId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveCachedId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private browsing may block writes — that's fine, we'll just recompute
  }
}

// ---------------------------------------------------------------------------
// Browser / OS / device type helpers (unchanged from your original)
// ---------------------------------------------------------------------------

function getBrowserInfo(): { name: string; version: string } {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox/'))
    return { name: 'Firefox', version: ua.split('Firefox/')[1]?.split(' ')[0] || '' };
  if (ua.includes('Edg/'))
    return { name: 'Edge', version: ua.split('Edg/')[1]?.split(' ')[0] || '' };
  if (ua.includes('Chrome/') && !ua.includes('Edg/'))
    return { name: 'Chrome', version: ua.split('Chrome/')[1]?.split(' ')[0] || '' };
  if (ua.includes('Safari/') && !ua.includes('Chrome/'))
    return { name: 'Safari', version: ua.split('Version/')[1]?.split(' ')[0] || '' };
  return { name: 'Unknown Browser', version: '' };
}

function getOSInfo(): { name: string; version: string } {
  const ua = navigator.userAgent;
  if (ua.includes('Windows NT 10.0')) return { name: 'Windows', version: '10/11' };
  if (ua.includes('Windows NT 6.3')) return { name: 'Windows', version: '8.1' };
  if (ua.includes('Windows NT 6.2')) return { name: 'Windows', version: '8' };
  if (ua.includes('Windows NT 6.1')) return { name: 'Windows', version: '7' };
  if (ua.includes('Mac OS X')) {
    const v = ua.split('Mac OS X ')[1]?.split(')')[0]?.replace(/_/g, '.') || '';
    return { name: 'macOS', version: v };
  }
  if (ua.includes('Android')) {
    return { name: 'Android', version: ua.split('Android ')[1]?.split(';')[0] || '' };
  }
  if (ua.includes('iPhone') || ua.includes('iPad')) {
    return {
      name: 'iOS',
      version: ua.split('OS ')[1]?.split(' ')[0]?.replace(/_/g, '.') || '',
    };
  }
  if (ua.includes('Linux')) return { name: 'Linux', version: '' };
  return { name: 'Unknown OS', version: '' };
}

function getDeviceType(): string {
  const ua = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) return 'Tablet';
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle/.test(ua)) return 'Mobile';
  return 'Desktop';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const getDeviceFingerprint = async (): Promise<DeviceInfo> => {
  try {
    console.log('🔍 Computing hardware-only device fingerprint...');

    const browser = getBrowserInfo();
    const os = getOSInfo();

    // Return cached ID immediately — guarantees byte-for-byte stability
    // across page loads, network switches, VPN on/off, etc.
    const cached = loadCachedId();
    if (cached) {
      console.log('✅ Using cached fingerprint:', cached);
      return {
        id: cached,
        name: `${browser.name} on ${os.name}`,
        browser: `${browser.name} ${browser.version}`.trim(),
        os: `${os.name} ${os.version}`.trim(),
        device: getDeviceType(),
        screen: `${window.screen.width}x${window.screen.height}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
    }

    // First-time computation: collect all hardware signals
    const [audioHash] = await Promise.all([audioFingerprint()]);

    const canvasHash   = canvasFingerprint();
    const webglHash    = webglFingerprint();
    const screenHash   = screenFingerprint();
    const fontHash     = fontFingerprint();
    const tzHash       = timezoneFingerprint();
    const platformHash = platformFingerprint();

    const id = buildId(
      canvasHash,
      webglHash,
      audioHash,
      screenHash,
      fontHash,
      tzHash,
      platformHash
    );

    // Persist so future calls return the same ID regardless of network
    saveCachedId(id);
    console.log('✅ Hardware fingerprint computed and cached:', id);

    return {
      id,
      name: `${browser.name} on ${os.name}`,
      browser: `${browser.name} ${browser.version}`.trim(),
      os: `${os.name} ${os.version}`.trim(),
      device: getDeviceType(),
      screen: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  } catch (error) {
    console.error('❌ Fingerprint error:', error);
    return {
      id: 'unknown',
      name: 'Unknown Device',
      browser: 'Unknown',
      os: 'Unknown',
      device: 'Unknown',
      screen: 'Unknown',
      timezone: 'Unknown',
    };
  }
};

export const isFingerprintingSupported = (): boolean =>
  typeof window !== 'undefined' && typeof window.screen !== 'undefined';

/**
 * Call on explicit logout or profile clear to force fresh computation next time.
 * Do NOT call this on normal login — it would invalidate the cached ID.
 */
export const clearCachedFingerprint = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};
