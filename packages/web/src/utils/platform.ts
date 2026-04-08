import { Capacitor } from '@capacitor/core';

/** Returns true when running inside the native iOS/Android shell. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Returns true when running inside the iOS native shell specifically. */
export function isIOSApp(): boolean {
  return Capacitor.getPlatform() === 'ios';
}

/** Returns true when running in a regular browser (not native). */
export function isWeb(): boolean {
  return Capacitor.getPlatform() === 'web';
}
