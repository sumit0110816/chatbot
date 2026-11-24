import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Eye, EyeOff, KeyRound } from 'lucide-react';
import { LegalModal, type LegalTopic } from '../components/LegalModal';
import { NovaLogo } from '../components/NovaLogo';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import type { AppRoute } from '../types';

interface AuthPagesProps {
  mode: 'login' | 'register' | 'forgot-password' | 'reset-password';
  initialResetToken?: string;
  onNavigate: (route: AppRoute, resetToken?: string) => void;
}

export const AuthPages: React.FC<AuthPagesProps> = ({
  mode,
  initialResetToken = '',
  onNavigate,
}) => {
  const { login, register, loginDemo } = useAuth();

  // Shared UI states
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [legalTopic, setLegalTopic] = useState<LegalTopic>(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Register fields
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Password reset fields
  const [forgotEmail, setForgotEmail] = useState('');
  const [previewResetToken, setPreviewResetToken] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const clearFeedback = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setSubmitting(true);
    try {
      await login(loginEmail.trim(), loginPassword, rememberMe);
      onNavigate('chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to log in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!termsAccepted) {
      setError('Please accept the Terms and Conditions to continue.');
      return;
    }

    setSubmitting(true);
    try {
      await register({
        full_name: fullName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        confirm_password: regConfirmPassword,
        terms_accepted: termsAccepted,
      });
      onNavigate('chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setPreviewResetToken(null);
    setSubmitting(true);
    try {
      const res = await authApi.forgotPassword(forgotEmail.trim());
      setSuccessMsg(res.message);
      if (res.reset_token) {
        setPreviewResetToken(res.reset_token);
        setResetToken(res.reset_token);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await authApi.resetPassword({
        token: resetToken.trim(),
        new_password: newPassword,
        confirm_password: confirmNewPassword,
      });
      setSuccessMsg(res.message);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    clearFeedback();
    setSubmitting(true);
    try {
      await loginDemo();
      onNavigate('chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to launch demo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9FE] flex flex-col justify-between px-4 py-8">
      <div className="mx-auto w-full max-w-6xl flex items-center justify-between">
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </button>
        <button type="button" onClick={() => onNavigate('landing')} className="cursor-pointer">
          <NovaLogo />
        </button>
      </div>

      <motion.div
        key={mode}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto my-8 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        {mode === 'login' && (
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Sign in to access your saved conversations and workspace.
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      clearFeedback();
                      onNavigate('forgot-password');
                    }}
                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700 cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-sm text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Remember me for 30 days</span>
              </label>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 transition-all cursor-pointer"
              >
                {submitting ? 'Signing in...' : 'Log in'}
              </button>
            </form>

            <div className="mt-4">
              <button
                type="button"
                onClick={handleDemo}
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition-colors cursor-pointer"
              >
                Try Demo Workspace
              </button>
            </div>

            <p className="mt-6 text-center text-sm text-slate-600">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  clearFeedback();
                  onNavigate('register');
                }}
                className="font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                Create one free
              </button>
            </p>
          </div>
        )}

        {mode === 'register' && (
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">
              Create your account
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Start chatting with NOVA AI and keep every thread organized.
            </p>

            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Mercer"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirm password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setLegalTopic('terms')}
                    className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
                  >
                    Terms and Conditions
                  </button>{' '}
                  and{' '}
                  <button
                    type="button"
                    onClick={() => setLegalTopic('privacy')}
                    className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700"
                  >
                    Privacy Policy
                  </button>
                  .
                </span>
              </label>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700 disabled:opacity-60 transition-all cursor-pointer"
              >
                {submitting ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  clearFeedback();
                  onNavigate('login');
                }}
                className="font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                Log in
              </button>
            </p>
          </div>
        )}

        {mode === 'forgot-password' && (
          <div>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mb-3">
              <KeyRound className="h-5 w-5" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">
              Reset your password
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Enter your account email address to generate a secure password reset token.
            </p>

            <form onSubmit={handleForgotPassword} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 space-y-2.5">
                  <p>{successMsg}</p>
                  {previewResetToken && (
                    <div className="pt-1 border-t border-emerald-200/80 space-y-2">
                      <p className="text-xs text-emerald-700">
                        Local reset token ready (valid for 30 minutes):
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          clearFeedback();
                          onNavigate('reset-password', previewResetToken);
                        }}
                        className="w-full rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer"
                      >
                        Continue to Reset Password
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {submitting ? 'Generating token...' : 'Send reset link'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-600">
              Remembered your password?{' '}
              <button
                type="button"
                onClick={() => {
                  clearFeedback();
                  onNavigate('login');
                }}
                className="font-semibold text-indigo-600 hover:text-indigo-700 cursor-pointer"
              >
                Back to login
              </button>
            </p>
          </div>
        )}

        {mode === 'reset-password' && (
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950">
              Choose a new password
            </h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Enter your reset token and choose a strong new password.
            </p>

            <form onSubmit={handleResetPassword} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Reset token
                </label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste reset token"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  New password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Confirm new password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
                  {error}
                </div>
              )}

              {successMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800 space-y-2">
                  <p>{successMsg}</p>
                  <button
                    type="button"
                    onClick={() => {
                      clearFeedback();
                      onNavigate('login');
                    }}
                    className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Proceed to Login
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {submitting ? 'Updating password...' : 'Update password'}
              </button>
            </form>
          </div>
        )}
      </motion.div>

      <p className="text-center text-xs text-slate-500">
        © {new Date().getFullYear()} NOVA AI
      </p>

      <LegalModal topic={legalTopic} onClose={() => setLegalTopic(null)} />
    </div>
  );
};
