import React, { useRef, useState } from 'react';
import { Camera, Check, Eye, EyeOff, Moon, Shield, Sun, Trash2, User as UserIcon, Sliders, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { chatApi, userApi } from '../services/api';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHistoryCleared: () => void;
}

type TabKey = 'profile' | 'preferences' | 'security';

const RESPONSE_PRESETS = [
  'Balanced, clear, and well-structured',
  'Concise and direct with bullet points',
  'Detailed explanations with practical examples',
  'Technical and code-first for software engineering',
];

const LANGUAGES = ['English', 'Spanish', 'French', 'German', 'Hindi', 'Japanese', 'Portuguese'];

async function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale;
        const h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Unable to read image file.'));
    reader.readAsDataURL(file);
  });
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onHistoryCleared,
}) => {
  const { user, settings, setUser, setSettings } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>('profile');

  // Profile state
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [profileImage, setProfileImage] = useState<string | null>(user?.profile_image ?? null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preferences state
  const [theme, setTheme] = useState<'light' | 'dark'>(settings?.theme ?? 'light');
  const [language, setLanguage] = useState(settings?.language ?? 'English');
  const [responsePrefs, setResponsePrefs] = useState(
    settings?.response_preferences ?? RESPONSE_PRESETS[0]
  );
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsStatus, setPrefsStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Security & Data state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [securityStatus, setSecurityStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  if (!isOpen || !user) return null;

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setProfileImage(dataUrl);
      setProfileStatus(null);
    } catch (err) {
      setProfileStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to process image.',
      });
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileStatus(null);
    try {
      const res = await userApi.updateProfile({
        full_name: fullName.trim(),
        profile_image: profileImage ?? '',
      });
      setUser(res.user);
      setProfileStatus({ type: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setProfileStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save profile.',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    setPrefsSaving(true);
    setPrefsStatus(null);
    try {
      const res = await userApi.updateSettings({
        theme,
        language,
        response_preferences: responsePrefs,
      });
      setSettings(res.settings);
      setPrefsStatus({ type: 'ok', text: 'Preferences saved.' });
    } catch (err) {
      setPrefsStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update preferences.',
      });
    } finally {
      setPrefsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSaving(true);
    setSecurityStatus(null);
    try {
      const res = await userApi.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSecurityStatus({ type: 'ok', text: res.message });
    } catch (err) {
      setSecurityStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to update password.',
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleClearHistory = async () => {
    setClearing(true);
    setSecurityStatus(null);
    try {
      await chatApi.clearAllConversations();
      setConfirmClear(false);
      onHistoryCleared();
      setSecurityStatus({ type: 'ok', text: 'All conversation history cleared.' });
    } catch (err) {
      setSecurityStatus({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to clear history.',
      });
    } finally {
      setClearing(false);
    }
  };

  const initials = user.full_name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
            Account & Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[190px_1fr]">
          {/* Sidebar tabs */}
          <nav className="flex md:flex-col gap-1 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-3">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'profile'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <UserIcon className="h-4 w-4" />
              <span>Profile</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preferences')}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'preferences'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <Sliders className="h-4 w-4" />
              <span>Preferences</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'security'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <Shield className="h-4 w-4" />
              <span>Security & Data</span>
            </button>
          </nav>

          {/* Tab content */}
          <div className="p-6 max-h-[75vh] overflow-y-auto">
            {activeTab === 'profile' && (
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center">
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt={user.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="font-display text-lg font-semibold text-indigo-600 dark:text-indigo-300">
                        {initials}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        <span>Upload photo</span>
                      </button>
                      {profileImage && (
                        <button
                          type="button"
                          onClick={() => setProfileImage(null)}
                          className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      PNG, JPG, or WEBP up to 1.5MB.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                    Full name
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3.5 py-2.5 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
                  />
                </div>

                {profileStatus && (
                  <p
                    className={`text-sm font-medium ${
                      profileStatus.type === 'ok'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {profileStatus.text}
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {profileSaving ? 'Saving...' : 'Save profile'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'preferences' && (
              <form onSubmit={handleSavePreferences} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2">
                    Appearance
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                        theme === 'light'
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Sun className="h-4 w-4" />
                      <span>Light (Default)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
                        theme === 'dark'
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Moon className="h-4 w-4" />
                      <span>Dark Mode</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                    Response language
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                  >
                    {LANGUAGES.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                    Assistant response style
                  </label>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {RESPONSE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setResponsePrefs(preset)}
                        className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${
                          responsePrefs === preset
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={3}
                    value={responsePrefs}
                    onChange={(e) => setResponsePrefs(e.target.value)}
                    placeholder="Describe how you'd like NOVA AI to format and tailor replies..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                {prefsStatus && (
                  <p
                    className={`flex items-center gap-1.5 text-sm font-medium ${
                      prefsStatus.type === 'ok'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {prefsStatus.type === 'ok' && <Check className="h-4 w-4" />}
                    <span>{prefsStatus.text}</span>
                  </p>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={prefsSaving}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                  >
                    {prefsSaving ? 'Saving...' : 'Save preferences'}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                      Change Password
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowPasswords((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      <span>{showPasswords ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Current password
                    </label>
                    <input
                      type={showPasswords ? 'text' : 'password'}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        New password
                      </label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Confirm new password
                      </label>
                      <input
                        type={showPasswords ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                    >
                      {passwordSaving ? 'Updating...' : 'Update password'}
                    </button>
                  </div>
                </form>

                <div className="border-t border-slate-100 dark:border-slate-800 pt-5 space-y-3">
                  <h3 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    Conversation Data
                  </h3>
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    Permanently remove all saved conversations and messages from your account. This
                    action cannot be undone.
                  </p>
                  {!confirmClear ? (
                    <button
                      type="button"
                      onClick={() => setConfirmClear(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 px-4 py-2 text-sm font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Clear conversation history</span>
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-3">
                      <span className="text-xs font-medium text-rose-800 dark:text-rose-200 mr-auto">
                        Delete all conversations permanently?
                      </span>
                      <button
                        type="button"
                        onClick={() => setConfirmClear(false)}
                        className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleClearHistory}
                        disabled={clearing}
                        className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 disabled:opacity-60"
                      >
                        {clearing ? 'Deleting...' : 'Confirm delete all'}
                      </button>
                    </div>
                  )}
                </div>

                {securityStatus && (
                  <p
                    className={`text-sm font-medium ${
                      securityStatus.type === 'ok'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {securityStatus.text}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
