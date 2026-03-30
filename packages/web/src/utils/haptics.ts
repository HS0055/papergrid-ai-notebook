import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

/**
 * Trigger haptic feedback if running in a native context.
 * Silently fails on web to maintain compatibility.
 */
export const triggerHaptic = {
  impact: async (style: ImpactStyle = ImpactStyle.Light) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style });
      } catch (e) {
        console.warn('Haptics.impact failed:', e);
      }
    }
  },
  notification: async (type: NotificationType = NotificationType.Success) => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.notification({ type });
      } catch (e) {
        console.warn('Haptics.notification failed:', e);
      }
    }
  },
  selectionStart: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.selectionStart();
      } catch (e) {
        console.warn('Haptics.selectionStart failed:', e);
      }
    }
  },
  selectionChanged: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.selectionChanged();
      } catch (e) {
        console.warn('Haptics.selectionChanged failed:', e);
      }
    }
  },
  selectionEnd: async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.selectionEnd();
      } catch (e) {
        console.warn('Haptics.selectionEnd failed:', e);
      }
    }
  }
};
