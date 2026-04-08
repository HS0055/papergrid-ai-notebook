import { Bold, Italic, Heading1, CheckSquare, Quote, Minus, Undo2, Redo2 } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { ImpactStyle } from '@capacitor/haptics';
import { isNativeApp } from '../../utils/platform';

interface ToolbarAction {
  id: string;
  icon: typeof Bold;
  label: string;
}

interface KeyboardToolbarProps {
  visible: boolean;
  keyboardHeight: number;
  onAction?: (actionId: string) => void;
  onDismiss?: () => void;
}

const actions: ToolbarAction[] = [
  { id: 'bold', icon: Bold, label: 'Bold' },
  { id: 'italic', icon: Italic, label: 'Italic' },
  { id: 'heading', icon: Heading1, label: 'Heading' },
  { id: 'checkbox', icon: CheckSquare, label: 'Checkbox' },
  { id: 'quote', icon: Quote, label: 'Quote' },
  { id: 'divider', icon: Minus, label: 'Divider' },
];

const historyActions: ToolbarAction[] = [
  { id: 'undo', icon: Undo2, label: 'Undo' },
  { id: 'redo', icon: Redo2, label: 'Redo' },
];

export function KeyboardToolbar({ visible, keyboardHeight, onAction, onDismiss }: KeyboardToolbarProps) {
  // Stay mounted so the backdrop-filter layer doesn't re-init on each show.
  // Animate via opacity + translateY instead of mount/unmount.
  if (!isNativeApp()) return null;

  const isShown = visible && keyboardHeight > 0;

  function handleAction(actionId: string) {
    triggerHaptic.impact(ImpactStyle.Light);
    onAction?.(actionId);
  }

  function handleDismiss() {
    triggerHaptic.impact(ImpactStyle.Light);
    onDismiss?.();
  }

  return (
    <div
      data-keyboard-toolbar
      aria-hidden={!isShown}
      className="fixed left-0 right-0 z-50 flex items-center px-2"
      style={{
        // Pin to top of keyboard via the global --kb-bottom CSS variable.
        // Do NOT animate `bottom` — --kb-bottom is already updated live by
        // visualViewport, so animating both creates jitter. Animate opacity
        // and translateY for show/hide instead.
        bottom: 'var(--kb-bottom, 0px)',
        height: '44px',
        opacity: isShown ? 1 : 0,
        transform: isShown ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 200ms cubic-bezier(0.32, 0.72, 0, 1), transform 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        pointerEvents: isShown ? 'auto' : 'none',
        // Inline frosted-glass — own composition layer, hairline top border
        background: 'rgba(247, 247, 250, 0.72)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        backdropFilter: 'blur(28px) saturate(180%)',
        borderTop: '0.5px solid rgba(0, 0, 0, 0.12)',
        boxShadow: '0 -0.5px 0 0 rgba(255,255,255,0.6) inset',
      }}
    >
      {/* Formatting actions - scrollable, 44pt targets */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-700 active:bg-black/[0.08] transition-colors shrink-0"
              aria-label={action.label}
              style={{ touchAction: 'manipulation' }}
              tabIndex={isShown ? 0 : -1}
            >
              <Icon size={20} strokeWidth={1.75} />
            </button>
          );
        })}

        <div className="w-px h-5 bg-black/15 mx-1 shrink-0" />

        {historyActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              onClick={() => handleAction(action.id)}
              className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-700 active:bg-black/[0.08] transition-colors shrink-0"
              aria-label={action.label}
              style={{ touchAction: 'manipulation' }}
              tabIndex={isShown ? 0 : -1}
            >
              <Icon size={20} strokeWidth={1.75} />
            </button>
          );
        })}
      </div>

      {/* Done button — iOS blue, 17pt semibold (Apple-native style) */}
      <button
        onClick={handleDismiss}
        className="ml-2 h-11 px-4 flex items-center text-[17px] font-semibold text-[#007AFF] shrink-0 active:opacity-60 transition-opacity"
        aria-label="Dismiss keyboard"
        style={{ touchAction: 'manipulation' }}
        tabIndex={isShown ? 0 : -1}
      >
        Done
      </button>
    </div>
  );
}
