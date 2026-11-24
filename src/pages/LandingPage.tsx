import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  FileText,
  History,
  Layers,
  Menu,
  MessageSquare,
  Sliders,
  X,
  Zap,
} from 'lucide-react';
import { LegalModal, type LegalTopic } from '../components/LegalModal';
import { NovaLogo } from '../components/NovaLogo';
import type { AppRoute } from '../types';

interface LandingPageProps {
  onNavigate: (route: AppRoute) => void;
  onTryDemo: () => Promise<void>;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, onTryDemo }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [legalTopic, setLegalTopic] = useState<LegalTopic>(null);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [aboutImgFailed, setAboutImgFailed] = useState(false);

  const handleDemoClick = async () => {
    setDemoLoading(true);
    setDemoError(null);
    try {
      await onTryDemo();
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : 'Unable to start demo workspace.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9FE] text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <a href="#home" className="whitespace-nowrap shrink-0">
            <NovaLogo />
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#home"
              className="hover:text-slate-950 hover:underline underline-offset-4 decoration-indigo-400 transition-colors whitespace-nowrap shrink-0"
            >
              Home
            </a>
            <a
              href="#features"
              className="hover:text-slate-950 hover:underline underline-offset-4 decoration-indigo-400 transition-colors whitespace-nowrap shrink-0"
            >
              Features
            </a>
            <a
              href="#about"
              className="hover:text-slate-950 hover:underline underline-offset-4 decoration-indigo-400 transition-colors whitespace-nowrap shrink-0"
            >
              About
            </a>
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="hover:text-slate-950 hover:underline underline-offset-4 decoration-indigo-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Login
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('register')}
              className="hidden sm:inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-xs hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Get Started
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="md:hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-6 py-4 space-y-3">
            <a
              href="#home"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-700"
            >
              Home
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-700"
            >
              Features
            </a>
            <a
              href="#about"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-slate-700"
            >
              About
            </a>
            <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('login');
                }}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('register');
                }}
                className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section id="home" className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-indigo-50/80 via-violet-50/45 to-[#FAF9FE]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/4 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-12 right-1/5 h-80 w-80 rounded-full bg-sky-200/45 blur-3xl"
          />
          <div className="relative mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-6 flex flex-col justify-center space-y-6"
              >
                <p className="text-sm font-semibold tracking-wide text-indigo-600">
                  Conversational AI Workspace
                </p>
                <h1 className="font-display text-[clamp(2.25rem,4vw,3.6rem)] font-bold leading-[1.1] tracking-tight text-slate-950 text-balance">
                  Your Ideas. Our Intelligence.{' '}
                  <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-600 bg-clip-text text-transparent">
                    Infinite Possibilities.
                  </span>
                </h1>
                <p className="max-w-xl text-base sm:text-lg leading-relaxed text-slate-600">
                  NOVA AI pairs real-time Google Gemini reasoning with an uncluttered workspace.
                  Draft technical code, analyze uploaded documents, and keep every multi-turn
                  conversation organized in one private place.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('register')}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/25 hover:brightness-105 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <span>Get Started Free</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDemoClick}
                    disabled={demoLoading}
                    className="inline-flex items-center justify-center rounded-xl border border-indigo-200 bg-white/90 px-6 py-3 text-sm font-semibold text-indigo-950 hover:bg-indigo-50/70 hover:border-indigo-300 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {demoLoading ? 'Opening Demo...' : 'Try Demo'}
                  </button>
                </div>

                {demoError && (
                  <p className="text-sm font-medium text-rose-600">{demoError}</p>
                )}

                <div className="pt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500 border-t border-indigo-200/60">
                  <span>Real-time Gemini streaming</span>
                  <span aria-hidden="true" className="text-indigo-400">·</span>
                  <span>Persistent SQLite history</span>
                  <span aria-hidden="true" className="text-indigo-400">·</span>
                  <span>Document & image analysis</span>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="lg:col-span-6 flex"
              >
                <div className="relative w-full overflow-hidden rounded-3xl border border-indigo-200/80 bg-white p-1.5 shadow-xl shadow-indigo-500/10 min-h-[320px]">
                  <div className="h-full w-full overflow-hidden rounded-[20px]">
                    {!heroImgFailed ? (
                      <img
                        src="/src/assets/images/hero_nova_conversation_1795534870366.jpg"
                        alt="Layered translucent dialogue planes representing NOVA AI conversational intelligence"
                        referrerPolicy="no-referrer"
                        onError={() => setHeroImgFailed(true)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[340px] flex-col items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-10 text-center">
                        <NovaLogo />
                        <p className="mt-3 text-sm text-slate-500">
                          Structured intelligence for every conversation.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Features Section (Asymmetric Bento Grid) */}
        <section id="features" className="py-20 bg-white border-y border-indigo-100/80">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-violet-600">Capabilities</p>
              <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-950 text-balance">
                Built for thoughtful writing, coding, and research.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-slate-600">
                Every workflow is backed by persistent storage, clean Markdown formatting, and fast
                response streaming.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 - Wide span */}
              <div className="md:col-span-2 rounded-2xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/85 via-white to-violet-50/75 p-7 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-500/8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-indigo-700">01. Multi-Turn Context</p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-slate-950">
                      Intelligent AI Conversations
                    </h3>
                  </div>
                  <div className="rounded-xl bg-indigo-600 p-2.5 text-white shadow-xs">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Maintain full conversational context across follow-up questions, code revisions,
                  and brainstorming threads. Edit earlier prompts and branch cleanly, or regenerate
                  answers with one click.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/85 via-white to-fuchsia-50/55 p-7 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-violet-500/8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-violet-700">02. Low Latency</p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-slate-950">
                      Instant Responses
                    </h3>
                  </div>
                  <div className="rounded-xl bg-violet-600 p-2.5 text-white shadow-xs">
                    <Zap className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  Watch answers arrive token-by-token over Server-Sent Events using Google Gemini,
                  with instant stop controls whenever you want to redirect.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="rounded-2xl border border-sky-200/70 bg-gradient-to-br from-sky-50/85 via-white to-indigo-50/55 p-7 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-sky-500/8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-sky-700">03. Relational Archive</p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-slate-950">
                      Conversation History
                    </h3>
                  </div>
                  <div className="rounded-xl bg-sky-600 p-2.5 text-white shadow-xs">
                    <History className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  Every thread is automatically saved and organized by date. Search past prompts and
                  answers or export any transcript to TXT or PDF.
                </p>
              </div>

              {/* Feature 4 - Wide span */}
              <div className="md:col-span-2 rounded-2xl border border-blue-200/70 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/70 p-7 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-blue-500/8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-blue-700">04. Parallel Workflows</p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-slate-950">
                      Multiple Chat Sessions
                    </h3>
                  </div>
                  <div className="rounded-xl bg-blue-600 p-2.5 text-white shadow-xs">
                    <Layers className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Keep separate threads for software debugging, writing drafts, and study notes.
                  Rename sessions inline, switch instantly, and isolate each topic cleanly.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="rounded-2xl border border-teal-200/70 bg-gradient-to-br from-teal-50/75 via-white to-sky-50/60 p-7 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-teal-500/8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-teal-700">05. Multimodal Input</p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-slate-950">
                      Document Understanding
                    </h3>
                  </div>
                  <div className="rounded-xl bg-teal-600 p-2.5 text-white shadow-xs">
                    <FileText className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-600">
                  Attach code files, Markdown notes, CSVs, PDFs, or screenshots directly inside the
                  chat composer for immediate summarization and analysis.
                </p>
              </div>

              {/* Feature 6 - Wide span */}
              <div className="md:col-span-2 rounded-2xl border border-purple-200/70 bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/70 p-7 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-purple-500/8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-purple-700">06. Tailored Output</p>
                    <h3 className="mt-2 font-display text-xl font-semibold text-slate-950">
                      Personalized Experience
                    </h3>
                  </div>
                  <div className="rounded-xl bg-purple-600 p-2.5 text-white shadow-xs">
                    <Sliders className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Customize your response style, preferred language, profile avatar, and light or
                  dark workspace theme — saved persistently to your account settings.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 bg-gradient-to-b from-[#F5F3FF] via-[#FAF9FE] to-white">
          <div className="mx-auto max-w-7xl px-6">
            <div className="max-w-xl">
              <p className="text-sm font-semibold text-indigo-600">How it works</p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 text-balance">
                From sign-up to clear answers in three steps.
              </h2>
            </div>

            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-indigo-200/70 pt-10">
              <div className="space-y-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 font-mono text-sm font-semibold text-white shadow-xs">
                  01
                </span>
                <h3 className="font-display text-xl font-semibold text-slate-900">
                  Create your account
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Register with your email in seconds or launch the instant demo workspace. Your
                  conversations stay private to your account.
                </p>
              </div>

              <div className="space-y-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-blue-600 font-mono text-sm font-semibold text-white shadow-xs">
                  02
                </span>
                <h3 className="font-display text-xl font-semibold text-slate-900">
                  Start a conversation
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Pick a suggested prompt, speak using voice input, or attach a document or image
                  to provide immediate context.
                </p>
              </div>

              <div className="space-y-3">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 font-mono text-sm font-semibold text-white shadow-xs">
                  03
                </span>
                <h3 className="font-display text-xl font-semibold text-slate-900">
                  Get intelligent answers
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Receive streamed Markdown and syntax-highlighted code, refine follow-up turns,
                  and export finished transcripts anytime.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why Choose NOVA AI Section */}
        <section id="about" className="py-20 bg-white border-t border-indigo-100/80">
          <div className="mx-auto max-w-7xl px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
              <div className="lg:col-span-5 flex">
                <div className="w-full overflow-hidden rounded-3xl border border-indigo-200/70 bg-gradient-to-br from-indigo-50/40 to-violet-50/40 p-1.5 shadow-lg shadow-indigo-500/8 min-h-[280px]">
                  <div className="h-full w-full overflow-hidden rounded-[20px]">
                    {!aboutImgFailed ? (
                      <img
                        src="/src/assets/images/nova_workspace_preview_1795534869513.jpg"
                        alt="Calm daylight studio desk representing NOVA AI's distraction-free workspace"
                        referrerPolicy="no-referrer"
                        onError={() => setAboutImgFailed(true)}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full min-h-[280px] items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-50 p-8">
                        <NovaLogo />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
                <div>
                  <p className="text-sm font-semibold text-violet-600">Why choose NOVA AI</p>
                  <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-slate-950 text-balance">
                    Designed for clarity, security, and architectural extensibility.
                  </h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-1.5">
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      Private Account Isolation
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600">
                      Every conversation and preference record is tied to verified user ownership,
                      with bcrypt password hashing and revocable JWT sessions.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 space-y-1.5">
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      Modular AI Provider Layer
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600">
                      Powered by Google Gemini out of the box with a clean provider interface ready
                      to integrate OpenAI or local Ollama models.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-sky-100 bg-sky-50/40 p-4 space-y-1.5">
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      Calm Light-First Interface
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600">
                      Engineered around readable white and soft lavender surfaces for daytime
                      focus, with optional dark mode inside your workspace.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-4 space-y-1.5">
                    <h3 className="font-display text-base font-semibold text-slate-900">
                      Portable Conversation Exports
                    </h3>
                    <p className="text-sm leading-relaxed text-slate-600">
                      Download any discussion cleanly as a formatted TXT file or structured PDF
                      document without losing context.
                    </p>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigate('register')}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-violet-600 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-500/20 hover:brightness-105 transition-all cursor-pointer"
                  >
                    <span>Create Your Free Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-[#FAF9FE] py-10">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <NovaLogo />
            <p className="text-xs text-slate-500">
              © {new Date().getFullYear()} NOVA AI. All rights reserved.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
            <a href="#about" className="hover:text-slate-950 transition-colors">
              About
            </a>
            <button
              type="button"
              onClick={() => setLegalTopic('contact')}
              className="hover:text-slate-950 transition-colors cursor-pointer"
            >
              Contact
            </button>
            <button
              type="button"
              onClick={() => setLegalTopic('privacy')}
              className="hover:text-slate-950 transition-colors cursor-pointer"
            >
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => setLegalTopic('terms')}
              className="hover:text-slate-950 transition-colors cursor-pointer"
            >
              Terms and Conditions
            </button>
          </div>
        </div>
      </footer>

      <LegalModal topic={legalTopic} onClose={() => setLegalTopic(null)} />
    </div>
  );
};
