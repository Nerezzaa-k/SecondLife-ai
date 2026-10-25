import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const NetworkStatusBar: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [justReconnected, setJustReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setJustReconnected(true);
      const timer = setTimeout(() => {
        setJustReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !justReconnected) {
    return null;
  }

  if (justReconnected) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="bg-emerald-600 text-white text-xs py-1.5 px-4 text-center font-semibold flex items-center justify-center gap-2 shadow-sm transition-all animate-fade-in z-50 sticky top-0"
      >
        <Wifi className="w-3.5 h-3.5" />
        <span>Back online! Connection restored.</span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="bg-amber-600 text-white text-xs py-1.5 px-4 text-center font-semibold flex items-center justify-center gap-2 shadow-sm transition-all animate-fade-in z-50 sticky top-0"
    >
      <WifiOff className="w-3.5 h-3.5" />
      <span>You are currently offline. Local actions and cached items remain accessible.</span>
    </div>
  );
};
