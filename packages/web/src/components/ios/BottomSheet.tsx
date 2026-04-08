import { useCallback, useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../utils/haptics';
import { ImpactStyle } from '@capacitor/haptics';

export type Detent = 'collapsed' | 'half' | 'full';

interface BottomSheetProps {
  isOpen: boolean;
  initialDetent?: Detent;
  onClose?: () => void;
  children: React.ReactNode;
}

const DETENT_FRACTIONS: Record<Detent, number> = {
  collapsed: 0.25,
  half: 0.5,
  full: 0.95,
};

const DETENT_ORDER: Detent[] = ['collapsed', 'half', 'full'];

const SPRING_EASING = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SPRING_DURATION_MS = 500;

/** Velocity threshold (px/ms) to trigger a flick to the next detent. */
const VELOCITY_THRESHOLD = 0.5;

/** Fraction below collapsed at which the sheet dismisses. */
const DISMISS_THRESHOLD = 0.15;

function getDetentY(detent: Detent, viewportHeight: number): number {
  return viewportHeight * (1 - DETENT_FRACTIONS[detent]);
}

function closestDetent(y: number, viewportHeight: number): Detent {
  let best: Detent = 'collapsed';
  let bestDist = Infinity;

  for (const d of DETENT_ORDER) {
    const detentY = getDetentY(d, viewportHeight);
    const dist = Math.abs(y - detentY);
    if (dist < bestDist) {
      bestDist = dist;
      best = d;
    }
  }

  return best;
}

function nextDetentInDirection(
  current: Detent,
  direction: 'up' | 'down',
): Detent | null {
  const idx = DETENT_ORDER.indexOf(current);

  if (direction === 'up' && idx < DETENT_ORDER.length - 1) {
    return DETENT_ORDER[idx + 1];
  }
  if (direction === 'down' && idx > 0) {
    return DETENT_ORDER[idx - 1];
  }

  return null;
}

export function BottomSheet({
  isOpen,
  initialDetent = 'half',
  onClose,
  children,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Gesture state in refs to avoid re-renders during drag
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const sheetStartY = useRef(0);
  const lastTouchY = useRef(0);
  const lastTouchTime = useRef(0);
  const velocityY = useRef(0);
  const lastHapticDetent = useRef<Detent | null>(null);

  const [currentDetent, setCurrentDetent] = useState<Detent>(initialDetent);
  const [visible, setVisible] = useState(false);
  const [sheetY, setSheetY] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);

  const viewportHeight =
    typeof window !== 'undefined' ? window.innerHeight : 800;

  const animateTo = useCallback(
    (targetY: number, onDone?: () => void) => {
      setAnimating(true);
      setSheetY(targetY);

      const timer = setTimeout(() => {
        setAnimating(false);
        onDone?.();
      }, SPRING_DURATION_MS);

      return () => clearTimeout(timer);
    },
    [],
  );

  const snapToDetent = useCallback(
    (detent: Detent) => {
      const targetY = getDetentY(detent, viewportHeight);
      setCurrentDetent(detent);
      animateTo(targetY);
      triggerHaptic.impact(ImpactStyle.Light);
    },
    [viewportHeight, animateTo],
  );

  const dismiss = useCallback(() => {
    animateTo(viewportHeight, () => {
      setVisible(false);
      onClose?.();
    });
  }, [viewportHeight, animateTo, onClose]);

  // Open / close lifecycle
  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      setCurrentDetent(initialDetent);
      setSheetY(viewportHeight);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          snapToDetent(initialDetent);
        });
      });
    } else if (visible) {
      dismiss();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Backdrop opacity proportional to sheet position
  const backdropOpacity = (() => {
    if (sheetY === null) return 0;
    const fullY = getDetentY('full', viewportHeight);
    const clamped = Math.max(fullY, Math.min(sheetY, viewportHeight));
    const range = viewportHeight - fullY;
    if (range === 0) return 0;
    return 1 - (clamped - fullY) / range;
  })();

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (animating) return;
      const touch = e.touches[0];
      isDragging.current = true;
      dragStartY.current = touch.clientY;
      sheetStartY.current = sheetY ?? getDetentY(currentDetent, viewportHeight);
      lastTouchY.current = touch.clientY;
      lastTouchTime.current = Date.now();
      velocityY.current = 0;
      lastHapticDetent.current = currentDetent;

      triggerHaptic.selectionStart();
    },
    [animating, sheetY, currentDetent, viewportHeight],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current) return;

      const touch = e.touches[0];
      const now = Date.now();
      const dt = now - lastTouchTime.current;

      if (dt > 0) {
        velocityY.current = (touch.clientY - lastTouchY.current) / dt;
      }

      lastTouchY.current = touch.clientY;
      lastTouchTime.current = now;

      const delta = touch.clientY - dragStartY.current;
      const fullY = getDetentY('full', viewportHeight);
      const newY = Math.max(fullY, sheetStartY.current + delta);

      setSheetY(newY);

      // Haptic feedback when crossing snap thresholds
      const hoveredDetent = closestDetent(newY, viewportHeight);
      if (hoveredDetent !== lastHapticDetent.current) {
        lastHapticDetent.current = hoveredDetent;
        triggerHaptic.selectionChanged();
      }
    },
    [viewportHeight],
  );

  const handleTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    triggerHaptic.selectionEnd();

    const currentY = sheetY ?? getDetentY(currentDetent, viewportHeight);
    const vel = velocityY.current;

    // Dismiss if dragged below dismiss threshold
    const dismissY = viewportHeight * (1 - DISMISS_THRESHOLD);
    if (currentY > dismissY) {
      dismiss();
      return;
    }

    // Velocity-based snap
    const nearest = closestDetent(currentY, viewportHeight);
    const isFastFlick = Math.abs(vel) > VELOCITY_THRESHOLD;

    if (isFastFlick) {
      const direction: 'up' | 'down' = vel < 0 ? 'up' : 'down';
      const next = nextDetentInDirection(nearest, direction);

      if (next) {
        snapToDetent(next);
        return;
      }

      if (direction === 'down' && nearest === 'collapsed') {
        dismiss();
        return;
      }
    }

    snapToDetent(nearest);
  }, [sheetY, currentDetent, viewportHeight, dismiss, snapToDetent]);

  const handleBackdropTap = useCallback(() => {
    dismiss();
  }, [dismiss]);

  if (!visible) return null;

  const translateY = sheetY ?? viewportHeight;

  return (
    <div className="fixed inset-0 z-50" style={{ touchAction: 'none' }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        style={{
          opacity: backdropOpacity,
          transition: animating
            ? `opacity ${SPRING_DURATION_MS}ms ${SPRING_EASING}`
            : 'none',
        }}
        onClick={handleBackdropTap}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute inset-x-0 bg-white rounded-t-[20px] shadow-[0_-10px_60px_rgba(0,0,0,0.12)]"
        style={{
          top: 0,
          height: viewportHeight,
          transform: `translateY(${translateY}px)`,
          transition: animating
            ? `transform ${SPRING_DURATION_MS}ms ${SPRING_EASING}`
            : 'none',
          willChange: 'transform',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-3">
          <div className="w-9 h-[5px] bg-gray-300 rounded-full" />
        </div>

        {/* Content */}
        <div className="overflow-y-auto h-full">{children}</div>
      </div>
    </div>
  );
}
