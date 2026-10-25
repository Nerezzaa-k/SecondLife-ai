import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { Footer } from './components/Footer';
import { WelcomeModal } from './components/WelcomeModal';
import { ToastContainer } from './components/ToastContainer';
import { CloudinaryDrawer } from './components/CloudinaryDrawer';
import { CloudinarySettingsModal } from './components/CloudinarySettingsModal';
import { AuthModal } from './components/AuthModal';
import { ProfileModal } from './components/ProfileModal';
import { PublicProfileModal } from './components/PublicProfileModal';
import { LegalModal } from './components/LegalModal';
import { NetworkStatusBar } from './components/NetworkStatusBar';

import { HomeScreen } from './screens/HomeScreen';
import { AnalyzeScreen } from './screens/AnalyzeScreen';
import { CommunityScreen } from './screens/CommunityScreen';
import { MatchResultsScreen } from './screens/MatchResultsScreen';
import { ImpactScreen } from './screens/ImpactScreen';
import { MyListingsScreen } from './screens/MyListingsScreen';
import { InboxScreen } from './screens/InboxScreen';

import { ErrorBoundary } from './components/ErrorBoundary';

const MainContent: React.FC = () => {
  const {
    currentScreen,
    user,
    userProfile,
    isAuthModalOpen,
    setIsAuthModalOpen,
    isProfileModalOpen,
    setIsProfileModalOpen,
    authMode,
    updateUserProfile,
    signOut,
    publicProfileUserId,
    closePublicProfile,
    isLegalModalOpen,
    legalModalTab,
    closeLegalModal,
  } = useApp();

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex flex-col font-sans selection:bg-[#2E9E6B]/20 selection:text-[#1C241F]">
      {/* Network Connection Status Bar (Offline Notice) */}
      <NetworkStatusBar />

      {/* Sticky Header */}
      <Navbar />

      {/* Main Container constrained to mobile-first baseline or clean responsive viewport */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 pt-4">
        {/* Per-route Error Boundary keeps application alive if a single screen crashes */}
        <ErrorBoundary inline fallbackTitle="Screen encountered an issue">
          {currentScreen === 'home' && <HomeScreen />}
          {currentScreen === 'analyze' && <AnalyzeScreen />}
          {currentScreen === 'community' && <CommunityScreen />}
          {currentScreen === 'match' && <MatchResultsScreen />}
          {currentScreen === 'impact' && <ImpactScreen />}
          {currentScreen === 'my-listings' && <MyListingsScreen />}
          {currentScreen === 'inbox' && <InboxScreen />}
        </ErrorBoundary>

        {/* Powered by Cloudinary & Circular Economy Footer */}
        <Footer />
      </main>

      {/* Fixed Bottom Navigation */}
      <BottomNav />

      {/* Modals & Overlays wrapped in ErrorBoundary */}
      <ErrorBoundary fallbackTitle="Dialog temporarily unavailable">
        <WelcomeModal />
        <ToastContainer />
        <CloudinaryDrawer />
        <CloudinarySettingsModal />

        {/* Supabase Auth & Profile Modals */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode={authMode}
        />
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          profile={userProfile}
          userEmail={user?.email}
          onProfileUpdated={updateUserProfile}
          onSignOut={signOut}
        />
        <PublicProfileModal
          userId={publicProfileUserId}
          onClose={closePublicProfile}
        />
        <LegalModal
          isOpen={isLegalModalOpen}
          onClose={closeLegalModal}
          initialTab={legalModalTab}
        />
      </ErrorBoundary>
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary fallbackTitle="Application Error">
      <AppProvider>
        <MainContent />
      </AppProvider>
    </ErrorBoundary>
  );
}
