import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, RefreshCw, Mail, KeyRound, ExternalLink, Shield } from 'lucide-react';
import { getEmailConfigApi, saveEmailConfigApi } from '../lib/api.ts';

interface EmailConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: () => void;
}

export const EmailConfigModal: React.FC<EmailConfigModalProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const [provider, setProvider] = useState<'gmail' | 'resend' | 'brevo'>('gmail');
  
  // Gmail fields
  const [gmailUser, setGmailUser] = useState('');
  const [gmailPass, setGmailPass] = useState('');

  // Resend fields
  const [resendKey, setResendKey] = useState('');

  // Brevo fields
  const [brevoKey, setBrevoKey] = useState('');

  const [loading, setLoading] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    try {
      const res = await getEmailConfigApi();
      setCurrentConfig(res);
      if (res.activeProvider === 'resend') setProvider('resend');
      else if (res.activeProvider === 'brevo') setProvider('brevo');
      else if (res.activeProvider === 'gmail') {
        setProvider('gmail');
        if (res.senderEmail) setGmailUser(res.senderEmail);
      }
    } catch (e) {}
  };

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      let payload: any = { provider };
      if (provider === 'gmail') {
        if (!gmailUser.trim() || !gmailPass.trim()) {
          throw new Error('Please enter your Gmail address and 16-character App Password.');
        }
        payload.gmailUser = gmailUser.trim();
        payload.gmailPass = gmailPass.trim();
      } else if (provider === 'resend') {
        if (!resendKey.trim()) {
          throw new Error('Please enter your Resend API Key (starts with re_).');
        }
        payload.resendApiKey = resendKey.trim();
      } else if (provider === 'brevo') {
        if (!brevoKey.trim()) {
          throw new Error('Please enter your Brevo API Key.');
        }
        payload.brevoApiKey = brevoKey.trim();
      }

      const res = await saveEmailConfigApi(payload);
      setCurrentConfig(res);
      setStatusMessage('✨ Email configuration saved! Real emails will now be sent to your inbox.');
      if (onConfigSaved) onConfigSaved();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save email configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await saveEmailConfigApi({ provider: 'reset' });
      setCurrentConfig(res);
      setGmailPass('');
      setResendKey('');
      setBrevoKey('');
      setStatusMessage('Switched back to Safe Demo Mode (no SMTP credentials stored).');
      if (onConfigSaved) onConfigSaved();
    } catch (e: any) {
      setErrorMessage('Failed to reset to Demo mode.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-[#FAF6EF] border-2 border-[#D4AF37] rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1C1917] via-[#2A2623] to-[#1C1917] p-5 text-[#FAF7F2] flex items-center justify-between border-b border-[#D4AF37]/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#2E2822] border border-[#D4AF37] text-[#D4AF37] flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif-royal font-bold text-sm tracking-wide">
                Real Email Delivery Setup
              </h3>
              <p className="text-[11px] text-[#C5A869]">
                Deliver OTP codes straight to your real Gmail / inbox
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 text-[#A8A29E] hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Status Pill */}
        <div className="px-6 pt-4 pb-2">
          <div className="p-3 rounded-2xl bg-white border border-[#E7DDCE] flex items-center justify-between text-xs">
            <span className="text-[#78716C] font-medium">Delivery Mode:</span>
            {currentConfig?.isConfigured ? (
              <span className="font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Real Delivery Active ({currentConfig.activeProvider.toUpperCase()})
              </span>
            ) : (
              <span className="font-bold text-[#8C6D2B] bg-[#F5ECE0] px-2.5 py-1 rounded-lg border border-[#E2D5BE]">
                Local Demo Mode (On-screen test code)
              </span>
            )}
          </div>
        </div>

        {/* Tab Selection */}
        <div className="px-6 pt-2">
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-[#F0E8DC] border border-[#E2D5BE]">
            <button
              type="button"
              onClick={() => { setProvider('gmail'); setStatusMessage(null); setErrorMessage(null); }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                provider === 'gmail'
                  ? 'bg-white text-[#1C1917] shadow-xs border border-[#D4AF37]'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              Gmail App Password
            </button>
            <button
              type="button"
              onClick={() => { setProvider('resend'); setStatusMessage(null); setErrorMessage(null); }}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                provider === 'resend'
                  ? 'bg-white text-[#1C1917] shadow-xs border border-[#D4AF37]'
                  : 'text-[#78716C] hover:text-[#1C1917]'
              }`}
            >
              Resend (Cloud Run API)
            </button>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          
          {provider === 'gmail' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] border border-[#FDE68A] text-[#92400E] space-y-2">
                <div className="font-bold flex items-center gap-1.5 text-red-900">
                  <Shield className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Important: Regular Google Passwords are NOT accepted!</span>
                </div>
                <p className="text-[11px] text-[#78350F] leading-relaxed">
                  Google disables regular password login on SMTP. You must create a free <strong>16-character App Password</strong>:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#78350F] pl-1 font-medium">
                  <li>Make sure 2-Step Verification is turned ON for your Google account.</li>
                  <li>Visit: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="underline font-bold text-[#B45309]">myaccount.google.com/apppasswords</a></li>
                  <li>Name the app: <strong>JSG Royals</strong> and click Create.</li>
                  <li>Google generates a 16-letter password (e.g. <code>abcd efgh ijkl mnop</code>). Paste it below.</li>
                </ol>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#44403C] mb-1">
                  Your Gmail Address:
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. subodhjain2007777@gmail.com"
                  value={gmailUser}
                  onChange={(e) => setGmailUser(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9CDB8] text-xs text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#44403C] mb-1">
                  16-Character App Password (from myaccount.google.com/apppasswords):
                </label>
                <input
                  type="password"
                  required
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={gmailPass}
                  onChange={(e) => setGmailPass(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9CDB8] text-xs font-mono text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                />
              </div>
            </div>
          )}

          {provider === 'resend' && (
            <div className="space-y-3.5 text-xs">
              <div className="p-3.5 rounded-2xl bg-white border border-[#E7DDCE] text-[#57534E] space-y-1.5">
                <div className="font-bold text-[#1C1917] flex items-center justify-between">
                  <span>Resend Email API (Free 100 emails/day)</span>
                  <a
                    href="https://resend.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#8C6D2B] underline flex items-center gap-1"
                  >
                    <span>resend.com</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-[11px] text-[#78716C] leading-relaxed">
                  Resend delivers directly to inboxes over HTTPS Port 443 with zero password headaches.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#44403C] mb-1">
                  Resend API Key:
                </label>
                <input
                  type="password"
                  required
                  placeholder="re_123456789..."
                  value={resendKey}
                  onChange={(e) => setResendKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9CDB8] text-xs font-mono text-[#1C1917] bg-white outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                />
              </div>
            </div>
          )}

          {statusMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2 leading-relaxed">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="pt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleReset}
              className="text-[11px] text-[#78716C] hover:text-red-700 underline cursor-pointer disabled:opacity-50"
            >
              Reset to Safe Demo Mode
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl border border-[#D9CDB8] text-xs font-semibold text-[#57534E] hover:bg-[#F2ECE1] transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] text-[#FAF7F2] text-xs font-bold shadow-md transition-all flex items-center gap-2 border border-[#C5A869]/40 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#D4AF37]" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="w-3.5 h-3.5 text-[#D4AF37]" />
                    <span>Verify &amp; Activate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
