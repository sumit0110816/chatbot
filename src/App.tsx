import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPages } from './pages/AuthPages';
import { ChatDashboard } from './pages/ChatDashboard';
import { LandingPage } from './pages/LandingPage';
import type { AppRoute } from './types';

function AppRouter() {
  const { user, isLoading, loginDemo } = useAuth();
  const [route, setRoute] = useState<AppRoute>('landing');
  const [resetToken, setResetToken] = useState('');

  // Sync initial URL path cleanly (SPA navigation, no full-page reloads)
  useEffect(() => {
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token') || '';
    if (tokenParam) setResetToken(tokenParam);

    if (path === '/login') setRoute('login');
    else if (path === '/register') setRoute('register');
    else if (path === '/forgot-password') setRoute('forgot-password');
    else if (path === '/reset-password') setRoute('reset-password');
    else if (path === '/chat') setRoute('chat');
  }, []);

  const navigate = (nextRoute: AppRoute, token?: string) => {
    if (token !== undefined) setResetToken(token);
    setRoute(nextRoute);
    const targetPath = nextRoute === 'landing' ? '/' : `/${nextRoute}`;
    window.history.pushState({}, '', targetPath);
  };

  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      if (path === '/login') setRoute('login');
      else if (path === '/register') setRoute('register');
      else if (path === '/forgot-password') setRoute('forgot-password');
      else if (path === '/reset-password') setRoute('reset-password');
      else if (path === '/chat') setRoute('chat');
      else setRoute('landing');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Automatically route authenticated users into chat dashboard when visiting auth/chat routes
  useEffect(() => {
    if (!isLoading && user && (route === 'login' || route === 'register')) {
      navigate('chat');
    }
  }, [isLoading, user, route]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FAF9FE]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm font-medium text-slate-600">Loading NOVA AI...</p>
        </div>
      </div>
    );
  }

  // Protected route check for /chat
  if (route === 'chat') {
    if (!user) {
      return <AuthPages mode="login" onNavigate={navigate} />;
    }
    return <ChatDashboard />;
  }

  if (
    route === 'login' ||
    route === 'register' ||
    route === 'forgot-password' ||
    route === 'reset-password'
  ) {
    return (
      <AuthPages
        mode={route}
        initialResetToken={resetToken}
        onNavigate={navigate}
      />
    );
  }

  return (
    <LandingPage
      onNavigate={navigate}
      onTryDemo={async () => {
        await loginDemo();
        navigate('chat');
      }}
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
