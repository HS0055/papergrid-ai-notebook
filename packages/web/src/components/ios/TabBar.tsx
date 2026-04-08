import { BookOpen, Search, Sparkles, Droplet, User } from 'lucide-react';
import { triggerHaptic } from '../../utils/haptics';
import { ImpactStyle } from '@capacitor/haptics';
import { isNativeApp } from '../../utils/platform';

export type TabId = 'notebooks' | 'search' | 'create' | 'ink' | 'profile';

interface TabDefinition {
  id: TabId;
  label: string;
  icon: typeof BookOpen;
}

interface TabBarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  /** When true, slide the tab bar off screen (e.g. while iOS keyboard is up). */
  hidden?: boolean;
}

const tabs: TabDefinition[] = [
  { id: 'notebooks', label: 'Notebooks', icon: BookOpen },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'create', label: 'Create', icon: Sparkles },
  { id: 'ink', label: 'Ink', icon: Droplet },
  { id: 'profile', label: 'Profile', icon: User },
];

export function TabBar({ activeTab, onTabChange, hidden = false }: TabBarProps) {
  if (!isNativeApp()) {
    return null;
  }

  function handleTabPress(tabId: TabId): void {
    if (tabId === activeTab) return;

    const style = tabId === 'create' ? ImpactStyle.Medium : ImpactStyle.Light;
    triggerHaptic.impact(style);
    onTabChange(tabId);
  }

  return (
    <nav
      className="liquid-glass fixed bottom-0 left-0 right-0 z-50 pb-[env(safe-area-inset-bottom)]"
      role="tablist"
      aria-label="Main navigation"
      aria-hidden={hidden}
      style={{
        transform: hidden ? 'translateY(100%)' : 'translateY(0)',
        transition: 'transform 250ms cubic-bezier(0.32, 0.72, 0, 1)',
        pointerEvents: hidden ? 'none' : 'auto',
      }}
    >
      <div className="flex items-end justify-around px-2 pt-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const isCreate = tab.id === 'create';
          const Icon = tab.icon;

          if (isCreate) {
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                aria-label={tab.label}
                onClick={() => handleTabPress(tab.id)}
                className="flex flex-col items-center justify-center -mt-5 relative"
              >
                <div
                  className={[
                    'flex items-center justify-center w-14 h-14 rounded-full shadow-lg shadow-indigo-500/30',
                    isActive ? 'bg-indigo-700' : 'bg-indigo-600',
                  ].join(' ')}
                >
                  <Icon className="w-6 h-6 text-white" strokeWidth={2} />
                </div>
                <span
                  className={[
                    'text-[10px] mt-1 font-medium',
                    isActive ? 'text-indigo-600' : 'text-gray-400',
                  ].join(' ')}
                >
                  {tab.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-label={tab.label}
              onClick={() => handleTabPress(tab.id)}
              className="flex flex-col items-center justify-center py-1 min-w-[56px] relative"
            >
              {/* Active pill indicator */}
              <div
                className={[
                  'w-5 h-[3px] rounded-full mb-1 transition-colors duration-200',
                  isActive ? 'bg-indigo-600' : 'bg-transparent',
                ].join(' ')}
              />
              <Icon
                className={[
                  'w-5 h-5 transition-colors duration-200',
                  isActive ? 'text-indigo-600' : 'text-gray-400',
                ].join(' ')}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              <span
                className={[
                  'text-[10px] mt-0.5 font-medium transition-colors duration-200',
                  isActive ? 'text-indigo-600' : 'text-gray-400',
                ].join(' ')}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
