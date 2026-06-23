/**
 * Device Information Utility
 * Captures device fingerprint, IP address, and browser/system info
 * Note: MAC addresses are NOT accessible from browsers for security reasons
 */

interface DeviceInfo {
  deviceId: string;
  ipAddress: string | null;
  ipDetails: any;
  browser: string;
  browserVersion: string;
  os: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  language: string;
  userAgent: string;
  timestamp: string;
  online: boolean;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
  connectionType: string;
  cores: number;
  memory: number;
  gpsCoordinates: {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    altitude: number | null;
    heading: number | null;
    speed: number | null;
    timestamp: number | null;
  } | null;
  gpsError: string | null;
}

/**
 * Generate a unique device fingerprint
 * Uses browser characteristics to create a consistent ID
 */
function generateDeviceFingerprint(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  let canvasFingerprint = '';

  if (ctx) {
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('CLINT.OS', 2, 2);
    canvasFingerprint = canvas.toDataURL().slice(-50);
  }

  const components = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    !!window.sessionStorage,
    !!window.localStorage,
    canvasFingerprint,
  ];

  const fingerprint = components.join('|');

  // Generate hash-like ID
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return 'DEV-' + Math.abs(hash).toString(16).toUpperCase();
}

/**
 * Get device ID from localStorage or generate new one
 */
export function getDeviceId(): string {
  const stored = localStorage.getItem('clint_device_id');
  if (stored) return stored;

  const deviceId = generateDeviceFingerprint();
  localStorage.setItem('clint_device_id', deviceId);
  return deviceId;
}

/**
 * Parse user agent to extract browser info
 */
function parseBrowserInfo() {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let version = 'Unknown';
  let os = 'Unknown';

  // Browser detection
  if (ua.indexOf('Firefox') > -1) {
    browser = 'Firefox';
    version = ua.match(/Firefox\/([0-9.]+)/)?.[1] || 'Unknown';
  } else if (ua.indexOf('Edg') > -1) {
    browser = 'Edge';
    version = ua.match(/Edg\/([0-9.]+)/)?.[1] || 'Unknown';
  } else if (ua.indexOf('Chrome') > -1) {
    browser = 'Chrome';
    version = ua.match(/Chrome\/([0-9.]+)/)?.[1] || 'Unknown';
  } else if (ua.indexOf('Safari') > -1) {
    browser = 'Safari';
    version = ua.match(/Version\/([0-9.]+)/)?.[1] || 'Unknown';
  }

  // OS detection
  if (ua.indexOf('Win') > -1) os = 'Windows';
  else if (ua.indexOf('Mac') > -1) os = 'macOS';
  else if (ua.indexOf('Linux') > -1) os = 'Linux';
  else if (ua.indexOf('Android') > -1) os = 'Android';
  else if (ua.indexOf('iOS') > -1) os = 'iOS';

  return { browser, version, os };
}

/**
 * Fetch IP address from external API
 */
async function fetchIpAddress(): Promise<{ ip: string | null; details: any }> {
  try {
    const response = await fetch('https://api.ipify.org?format=json', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();

    // Try to get more detailed info
    try {
      const detailResponse = await fetch(`https://ipapi.co/${data.ip}/json/`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const details = await detailResponse.json();
      return { ip: data.ip, details };
    } catch {
      return { ip: data.ip, details: null };
    }
  } catch (error) {
    console.warn('Could not fetch IP address:', error);
    return { ip: null, details: null };
  }
}

/**
 * Get network connection type
 */
function getConnectionType(): string {
  const nav = navigator as any;
  if (!nav.connection) return 'Unknown';

  const conn = nav.connection;
  if (conn.effectiveType) return conn.effectiveType.toUpperCase();
  if (conn.type) return conn.type;
  return 'Unknown';
}

/**
 * Get GPS coordinates using Geolocation API
 * Returns null if permission denied or not available
 */
async function getGpsCoordinates(): Promise<{
  coordinates: {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    altitude: number | null;
    heading: number | null;
    speed: number | null;
    timestamp: number | null;
  } | null;
  error: string | null;
}> {
  if (!navigator.geolocation) {
    return {
      coordinates: null,
      error: 'Geolocation not supported by this browser'
    };
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({
        coordinates: null,
        error: 'Geolocation request timed out'
      });
    }, 10000); // 10 second timeout

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeout);
        resolve({
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp,
          },
          error: null
        });
      },
      (error) => {
        clearTimeout(timeout);
        let errorMessage = 'Unknown geolocation error';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied by user';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }

        resolve({
          coordinates: null,
          error: errorMessage
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // Cache position for 5 minutes
      }
    );
  });
}

/**
 * Get complete device information
 */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const deviceId = getDeviceId();
  const { browser, version, os } = parseBrowserInfo();
  const { ip, details } = await fetchIpAddress();
  const gpsData = await getGpsCoordinates();

  const nav = navigator as any;

  return {
    deviceId,
    ipAddress: ip,
    ipDetails: details,
    browser,
    browserVersion: version,
    os,
    platform: navigator.platform,
    screenResolution: `${screen.width}x${screen.height} (${screen.colorDepth}-bit)`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    online: navigator.onLine,
    cookiesEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack === '1',
    connectionType: getConnectionType(),
    cores: navigator.hardwareConcurrency || 0,
    memory: nav.deviceMemory || 0,
    gpsCoordinates: gpsData.coordinates,
    gpsError: gpsData.error,
  };
}

/**
 * Store device info to backend
 */
export async function registerDevice(apiClient: any): Promise<void> {
  try {
    const deviceInfo = await getDeviceInfo();
    await apiClient.setKV(`device:${deviceInfo.deviceId}`, deviceInfo);
    console.log('[Device Registration] Device info stored:', deviceInfo.deviceId);
  } catch (error) {
    console.error('[Device Registration] Failed to store device info:', error);
  }
}
