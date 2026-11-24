import React from 'react';
import { X } from 'lucide-react';

export type LegalTopic = 'privacy' | 'terms' | 'contact' | null;

interface LegalModalProps {
  topic: LegalTopic;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({ topic, onClose }) => {
  if (!topic) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {topic === 'privacy' && 'Privacy Policy'}
            {topic === 'terms' && 'Terms and Conditions'}
            {topic === 'contact' && 'Contact NOVA AI'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-600 max-h-[60vh] overflow-y-auto pr-1">
          {topic === 'privacy' && (
            <>
              <p>
                NOVA AI stores your account details, conversation threads, and workspace preferences
                solely to provide your personal AI workspace.
              </p>
              <p>
                Passwords are protected with strong cryptographic hashing and never stored in plain
                text. Conversations are scoped strictly to your authenticated user account and can
                be exported or permanently deleted at any time from your dashboard.
              </p>
              <p>
                Prompts and attachments are processed through the configured Gemini AI provider over
                encrypted server-side requests. API keys are never exposed to client browsers.
              </p>
            </>
          )}

          {topic === 'terms' && (
            <>
              <p>
                By creating a NOVA AI account, you agree to use the platform responsibly and in
                compliance with applicable laws.
              </p>
              <p>
                You retain ownership of the prompts you author and outputs you export. AI-generated
                responses should be reviewed before use in critical engineering, legal, or medical
                workflows.
              </p>
              <p>
                You may delete individual conversations, clear your entire history, or update your
                account information at any time.
              </p>
            </>
          )}

          {topic === 'contact' && (
            <>
              <p>
                Need help with your NOVA AI workspace, self-hosting setup, or account access?
              </p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
                <p className="font-medium text-slate-900">Support & Engineering</p>
                <p>Email: support@nova-ai.example</p>
                <p>Response window: Monday–Friday, 9:00 AM – 6:00 PM UTC</p>
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
