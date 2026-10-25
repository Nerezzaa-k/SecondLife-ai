import React from 'react';
import { useApp } from '../context/AppContext';
import { SlidersHorizontal, User, RefreshCw, LogIn, Inbox } from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    user,
    userProfile,
    userName,
    pendingIncomingCount,
    setCurrentScreen,
    setIsCloudinarySettingsOpen,
    openAuthModal,
    openProfileModal,
  } = useApp();

  const displayName = userProfile?.full_name || userName || (user?.email ? user.email.split('@')[0] : '');
  const avatarUrl = userProfile?.avatar_url;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E8E6DF] px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Brand */}
        <button
          onClick={() => setCurrentScreen('home')}
          className="flex items-center gap-2.5 text-left group"
        >
          <div className="w-9 h-9 rounded-xl bg-[#2E9E6B] flex items-center justify-center text-white shadow-sm shadow-[#2E9E6B]/20 group-hover:scale-105 transition-transform">
            <RefreshCw className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[#1C241F] tracking-tight text-base">
                SecondLife
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#2E9E6B] bg-[#EAF7F0] px-1.5 py-0.5 rounded">
                AI
              </span>
            </div>
            <p className="text-[11px] text-[#5A685F] font-medium leading-none">
              Smart Choices. Longer Lives.
            </p>
          </div>
        </button>

        {/* Right Badges & Controls */}
        <div className="flex items-center gap-2">
          {/* Exchange Inbox trigger with pending badge */}
          <button
            onClick={() => setCurrentScreen('inbox')}
            title="Exchange Inbox"
            className="p-1.5 text-slate-600 hover:text-[#2E9E6B] hover:bg-slate-100 rounded-lg transition-colors relative"
          >
            <Inbox className="w-4 h-4" />
            {pendingIncomingCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center shadow-xs animate-pulse">
                {pendingIncomingCount}
              </span>
            )}
          </button>

          {/* Settings & Configuration trigger */}
          <button
            onClick={() => setIsCloudinarySettingsOpen(true)}
            title="Settings & Media Configuration"
            className="p-1.5 text-slate-600 hover:text-[#2E9E6B] hover:bg-slate-100 rounded-lg transition-colors relative"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>

          {/* User Profile or Sign In */}
          {user ? (
            <button
              onClick={openProfileModal}
              title={`Logged in as ${displayName || 'Eco Member'}. Click to manage profile.`}
              className="flex items-center gap-1.5 py-1 px-1.5 rounded-full hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-[#EAF7F0] text-[#2E9E6B] font-bold text-xs flex items-center justify-center border border-[#2E9E6B]/40 shadow-xs">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName || 'Avatar'}
                    className="w-full h-full object-cover"
                  />
                ) : displayName ? (
                  displayName.charAt(0).toUpperCase()
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
            </button>
          ) : (
            <button
              onClick={() => openAuthModal('signin')}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-full bg-[#EAF7F0] text-[#2E9E6B] hover:bg-[#2E9E6B] hover:text-white transition-all text-xs font-semibold shadow-xs"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
