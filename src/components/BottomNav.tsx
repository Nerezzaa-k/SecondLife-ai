import React from 'react';
import { useApp, ScreenType } from '../context/AppContext';
import { Home, Sparkles, Users, Award, Inbox } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { currentScreen, setCurrentScreen, currentAnalysis, pendingIncomingCount } = useApp();

  const navItems: {
    id: ScreenType;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: boolean;
    countBadge?: number;
  }[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'analyze', label: 'Analyze', icon: Sparkles, badge: Boolean(currentAnalysis) },
    { id: 'community', label: 'Community', icon: Users },
    { id: 'inbox', label: 'Inbox', icon: Inbox, countBadge: pendingIncomingCount },
    { id: 'impact', label: 'Impact', icon: Award },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E8E6DF] pb-safe">
      <div className="max-w-md mx-auto px-2 py-2 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentScreen === item.id ||
            (item.id === 'community' && (currentScreen === 'match' || currentScreen === 'my-listings'));

          return (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
                isActive
                  ? 'text-[#2E9E6B] font-semibold'
                  : 'text-slate-500 hover:text-slate-800 font-medium'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'}`} />
                {item.countBadge && item.countBadge > 0 ? (
                  <span className="absolute -top-1 -right-2 min-w-[15px] h-3.5 px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs">
                    {item.countBadge}
                  </span>
                ) : item.badge && !isActive ? (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#2E9E6B] ring-2 ring-white" />
                ) : null}
              </div>
              <span className="text-[11px] mt-1 leading-none tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
