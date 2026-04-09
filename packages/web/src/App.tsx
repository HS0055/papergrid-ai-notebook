import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LandingPage } from './components/LandingPage';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthPage } from './components/AuthPage';
import { PricingPage } from './components/PricingPage';
import { CheckoutPage } from './components/CheckoutPage';
import { BillingSuccessPage } from './components/BillingSuccessPage';
import { AdminPanel } from './components/AdminPanel';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { isNativeApp } from './utils/platform';
import { BaselineTest } from './components/__debug__/BaselineTest';
import { captureReferralFromUrl } from './utils/referralCapture';

// Lazy-load community + affiliate + referral so they don't bloat the
// main bundle for users who never visit them.
const CommunityPage = lazy(() =>
  import('./components/community/CommunityPage').then((m) => ({ default: m.CommunityPage })),
);
const AffiliatePage = lazy(() =>
  import('./components/affiliate/AffiliatePage').then((m) => ({ default: m.AffiliatePage })),
);
const ReferralPage = lazy(() =>
  import('./components/referral/ReferralPage').then((m) => ({ default: m.ReferralPage })),
);

function LazyFallback() {
  return (
    <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
      <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Auth page wrapper
function LoginRoute() {
  const { isAuthenticated, login, signup, error, isLoading } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return (
    <AuthPage
      onLogin={login}
      onSignup={signup}
      error={error}
      loading={isLoading}
    />
  );
}

export default function App() {
  // Capture ?ref=CODE as early as possible on first paint so the
  // referral code survives through signup even if the user clicks
  // around first. Runs once per mount (StrictMode double-invokes are
  // harmless — the helper is idempotent).
  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  if (typeof window !== 'undefined' && window.location.search.includes('baselinetest')) {
    return <BaselineTest />;
  }

  const native = isNativeApp();

  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* On native iOS, skip the marketing landing page — go straight to login */}
            <Route path="/" element={native ? <Navigate to="/login" replace /> : <LandingPage />} />
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/pricing" element={<PricingPage />} />
            {/* High-converting in-house checkout (Stripe Elements). All
                "Go Pro" / "Buy Ink" CTAs route here instead of redirecting
                to Stripe-hosted Checkout — keeps users on the Papera
                domain end-to-end. */}
            <Route path="/checkout" element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            } />
            {/* Stripe checkout success redirect. The server webhook has
                usually already upgraded the user's plan by the time they
                land here — this page just shows confirmation and bounces
                to /app so the dashboard re-fetches the user. */}
            <Route path="/billing/success" element={<BillingSuccessPage />} />
            <Route path="/billing/cancelled" element={<Navigate to="/pricing" replace />} />
            <Route path="/app" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            {/* Community feed — visible to everyone, writes require auth */}
            <Route path="/community" element={
              <Suspense fallback={<LazyFallback />}>
                <CommunityPage />
              </Suspense>
            } />
            {/* Affiliate dashboard — auth-gated inside the component */}
            <Route path="/affiliate" element={
              <ProtectedRoute>
                <Suspense fallback={<LazyFallback />}>
                  <AffiliatePage />
                </Suspense>
              </ProtectedRoute>
            } />
            {/* Referral dashboard — auth-gated, user→user growth loop */}
            <Route path="/referral" element={
              <ProtectedRoute>
                <Suspense fallback={<LazyFallback />}>
                  <ReferralPage />
                </Suspense>
              </ProtectedRoute>
            } />
            {/* Admin panel is hidden on native builds to avoid App Store rejection */}
            {!native && (
              <Route path="/admin" element={
                <ProtectedRoute>
                  <AdminPanel />
                </ProtectedRoute>
              } />
            )}
            <Route path="*" element={<Navigate to={native ? "/login" : "/"} replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

