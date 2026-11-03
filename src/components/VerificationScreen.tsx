import React, { useState, useEffect } from 'react';
import { Smartphone, KeyRound, ArrowRight, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { requestOtpApi, verifyOtpApi, verifyFirebaseSessionApi } from '../lib/api.ts';
import { MemberSession } from '../lib/types.ts';
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth';
import { auth } from '../lib/firebase.ts';

interface VerificationScreenProps {
  initialMobile?: string;
  onVerified: (session: MemberSession, token: string) => void;
  onBack: () => void;
}

export const VerificationScreen: React.FC<VerificationScreenProps> = ({
  initialMobile = '',
  onVerified,
  onBack,
}) => {
  const [mobile, setMobile] = useState(initialMobile);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [testOtpNotice, setTestOtpNotice] = useState<string | null>(null);
  const [registeredCoupleId, setRegisteredCoupleId] = useState<string | null>(null);
  const [registeredName, setRegisteredName] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [smsSentViaFirebase, setSmsSentViaFirebase] = useState<boolean>(false);

  useEffect(() => {
    if (initialMobile) {
      setMobile(initialMobile);
    }
  }, [initialMobile]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'otp' && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setTestOtpNotice(null);

    const clean = mobile.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit registered Indian mobile number.');
      return;
    }

    setLoading(true);
    try {
      // 1. Verify that mobile is registered with JSG Royals
      const res = await requestOtpApi(clean);
      setRegisteredCoupleId(res.coupleId);
      setRegisteredName(res.registeredName);
      const testCode = res.testOtp || (res as any).developmentTestOtp || '123456';
      setTestOtpNotice(testCode);

      // 2. Try sending real SMS via Firebase Phone Authentication
      let firebaseSmsSuccess = false;
      try {
        if (typeof window !== 'undefined' && auth) {
          if (!(window as any).recaptchaVerifier) {
            (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
              size: 'invisible',
              callback: () => {}
            });
          }
          const confirmation = await signInWithPhoneNumber(auth, `+91${clean}`, (window as any).recaptchaVerifier);
          setConfirmationResult(confirmation);
          firebaseSmsSuccess = true;
          setSmsSentViaFirebase(true);
          setSuccessMsg(`Official SMS dispatched to +91 ${clean} via Firebase Phone Auth!`);
        }
      } catch (fbErr: any) {
        console.warn('Firebase SMS provider note (using sandbox test code):', fbErr?.message || fbErr);
        setSmsSentViaFirebase(false);
        setSuccessMsg(res.message);
      }

      setStep('otp');
      setCountdown(60);
      setOtp('');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length < 4) {
      setError('Please enter the verification OTP code.');
      return;
    }

    setLoading(true);
    try {
      // If Firebase sent real SMS and user is not entering the fallback test OTP
      if (smsSentViaFirebase && confirmationResult && cleanOtp !== testOtpNotice) {
        try {
          await confirmationResult.confirm(cleanOtp);
          const res = await verifyFirebaseSessionApi(mobile);
          localStorage.setItem('jsg_member_token', res.token);
          onVerified(res.member, res.token);
          return;
        } catch (fbErr: any) {
          console.warn('Firebase confirmation error, attempting backend verification:', fbErr);
        }
      }

      // Default / Sandbox backend verification
      const res = await verifyOtpApi(mobile, cleanOtp);
      localStorage.setItem('jsg_member_token', res.token);
      onVerified(res.member, res.token);
    } catch (err: any) {
      setError(err.message || 'Invalid OTP code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-60px)] flex flex-col justify-center items-center py-8 px-4 sm:px-6">
      <div className="max-w-md w-full bg-[#FFFFFF] border border-[#E7DDCE] rounded-3xl p-6 sm:p-8 shadow-md">
        
        {/* Back Link */}
        <button
          onClick={step === 'otp' ? () => setStep('mobile') : onBack}
          className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#1C1917] mb-6 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{step === 'otp' ? 'Change mobile number' : 'Back to Home'}</span>
        </button>

        {step === 'mobile' ? (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F5EFE6] text-[#8C6D2B] flex items-center justify-center border border-[#E2D5BE]">
                <Smartphone className="w-6 h-6 text-[#8C6D2B]" />
              </div>
              <div>
                <h2 className="font-serif-royal text-xl font-bold text-[#1C1917]">
                  Verify Identity
                </h2>
                <p className="text-xs text-[#78716C]">
                  Enter your registered mobile number
                </p>
              </div>
            </div>

            <p className="text-xs text-[#57534E] mb-6 bg-[#FAF7F2] p-3 rounded-xl border border-[#EDE3D3] leading-relaxed">
              Either <strong>Husband’s</strong> or <strong>Wife’s</strong> registered mobile number will securely authenticate your Couple ID.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-2">
                  Registered Mobile Number
                </label>
                <div className="relative flex rounded-xl border border-[#D9CDB8] overflow-hidden focus-within:ring-2 focus-within:ring-[#C5A869] focus-within:border-[#C5A869]">
                  <span className="inline-flex items-center px-3.5 bg-[#FAF7F2] text-[#78716C] text-sm font-medium border-r border-[#D9CDB8]">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="e.g. 9826012345"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 px-4 py-3 text-base text-[#1C1917] outline-hidden placeholder:text-[#A8A29E]"
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || mobile.length < 10}
                className="w-full py-3.5 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] disabled:opacity-50 text-[#FAF7F2] font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                    <span>Sending Verification Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#F5EFE6] text-[#8C6D2B] flex items-center justify-center border border-[#E2D5BE]">
                <KeyRound className="w-6 h-6 text-[#8C6D2B]" />
              </div>
              <div>
                <h2 className="font-serif-royal text-xl font-bold text-[#1C1917]">
                  Enter OTP
                </h2>
                <p className="text-xs text-[#78716C]">
                  Sent to +91 {mobile}
                </p>
              </div>
            </div>

            {registeredCoupleId && (
              <div className="mb-4 bg-[#F8F5EE] border border-[#DFCFAE] rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[#78716C] uppercase font-semibold">
                    Identified Couple
                  </span>
                  <p className="font-serif font-bold text-sm text-[#1C1917]">
                    {registeredCoupleId} • {registeredName}
                  </p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EFE4C9] text-[#8C6D2B]">
                  Verified Registered
                </span>
              </div>
            )}

            {/* Live Verification Notice */}
            <div className="mb-4 p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE] text-xs text-[#57534E]">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-[#8C6D2B]" />
                <span className="font-semibold text-[#1C1917]">Verification Code Dispatched</span>
              </div>
              <p className="text-[12px] text-[#78716C] leading-relaxed">
                Please enter the 6-digit OTP code sent to your registered mobile number <strong className="text-[#1C1917]">+91 {mobile}</strong>.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-2">
                  6-Digit OTP Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="• • • • • •"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="w-full text-center tracking-[0.5em] text-2xl font-mono px-4 py-3 rounded-xl border border-[#D9CDB8] text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#C5A869] focus:border-[#C5A869]"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || otp.length < 4}
                className="w-full py-3.5 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] disabled:opacity-50 text-[#FAF7F2] font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                    <span>Verifying Session...</span>
                  </>
                ) : (
                  <>
                    <span>Verify & Continue</span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </>
                )}
              </button>

              <div className="text-center pt-2">
                {countdown > 0 ? (
                  <span className="text-xs text-[#78716C]">
                    Resend code in {countdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRequestOtp()}
                    className="text-xs font-semibold text-[#8C6D2B] hover:underline"
                  >
                    Resend OTP Code
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* Invisible Firebase reCAPTCHA anchor */}
        <div id="recaptcha-container" className="hidden"></div>
      </div>
    </div>
  );
};
