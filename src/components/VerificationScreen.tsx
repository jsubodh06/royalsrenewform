import React, { useState, useEffect } from 'react';
import { Smartphone, KeyRound, ArrowRight, ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { requestOtpApi, verifyOtpApi } from '../lib/api.ts';
import { MemberSession } from '../lib/types.ts';

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
  const [registeredCoupleId, setRegisteredCoupleId] = useState<string | null>(null);
  const [registeredName, setRegisteredName] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    if (initialMobile) {
      setMobile(initialMobile.replace(/\D/g, '').slice(-10));
    }
  }, [initialMobile]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (step === 'otp' && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Request 6-digit OTP dispatched to mobile
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const clean = mobile.replace(/\D/g, '').slice(-10);
    if (clean.length !== 10) {
      setError('Please enter a valid 10-digit registered Indian mobile number.');
      return;
    }

    setLoading(true);
    try {
      const res = await requestOtpApi(clean);
      setRegisteredCoupleId(res.coupleId);
      setRegisteredName(res.registeredName);

      if (res.smsDispatched === false) {
        setError(res.message || 'Fast2SMS could not deliver the OTP SMS.');
        return;
      }

      setSuccessMsg(res.message || `Official SMS verification code dispatched to +91 ${clean}.`);
      setStep('otp');
      setCountdown(30);
      setOtp('');
    } catch (err: any) {
      console.error('Phone verification request error:', err);
      let friendlyError = err?.message || 'Failed to dispatch OTP to your phone.';

      if (err.message && err.message.includes('not registered')) {
        friendlyError = 'Sorry, this mobile number is not registered in the JSG Royals Year-1 directory. Please check the registered mobile number for either husband or wife.';
      }

      setError(friendlyError);
    } finally {
      setLoading(false);
    }
  };

  // Verify 6-digit OTP code
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length < 6) {
      setError('Please enter the 6-digit OTP code received on your mobile.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyOtpApi(mobile, cleanOtp);
      localStorage.setItem('jsg_member_token', res.token);
      onVerified(res.member, res.token);
    } catch (err: any) {
      let msg = err?.message || 'Invalid OTP code. Please check the SMS and try again.';
      setError(msg);
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
          className="inline-flex items-center gap-1.5 text-xs text-[#78716C] hover:text-[#1C1917] mb-6 font-medium transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{step === 'otp' ? 'Change mobile number' : 'Back to Home'}</span>
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-[#F5EFE6] text-[#8C6D2B] flex items-center justify-center border border-[#E2D5BE] shrink-0">
            {step === 'mobile' ? (
              <Smartphone className="w-6 h-6 text-[#8C6D2B]" />
            ) : (
              <KeyRound className="w-6 h-6 text-[#8C6D2B]" />
            )}
          </div>
          <div>
            <h2 className="font-serif-royal text-xl font-bold text-[#1C1917]">
              {step === 'mobile' ? 'Member Verification' : 'Enter OTP Code'}
            </h2>
            <p className="text-xs text-[#78716C]">
              {step === 'mobile'
                ? 'Enter your registered mobile to receive OTP'
                : `Dispatched to +91 ${mobile}`}
            </p>
          </div>
        </div>

        {/* Success Alert */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
            <div className="flex-1 leading-relaxed">
              <span className="font-semibold block mb-0.5">SMS Notification:</span>
              <span>{error}</span>
              {(error.toLowerCase().includes('website verification') || error.toLowerCase().includes('kyc') || error.toLowerCase().includes('otp message')) && (
                <div className="mt-2.5 pt-2 border-t border-amber-200 text-[11px] text-amber-800 space-y-1">
                  <p className="font-semibold">How to complete Fast2SMS 1-time verification:</p>
                  <ol className="list-decimal list-inside space-y-0.5 pl-1">
                    <li>Log in to <a href="https://www.fast2sms.com" target="_blank" rel="noreferrer" className="underline font-bold">fast2sms.com</a></li>
                    <li>Go to <strong>Dev API &gt; OTP Message &gt; Website Verification</strong> (or KYC)</li>
                    <li>Enter domain: <code className="bg-amber-100 px-1 rounded font-mono font-bold">royalsrenewform.vercel.app</code></li>
                    <li>Ensure wallet has ₹100+ minimum balance</li>
                  </ol>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 1: MOBILE NUMBER INPUT */}
        {step === 'mobile' && (
          <div>
            <p className="text-xs text-[#57534E] mb-5 bg-[#FAF7F2] p-3.5 rounded-xl border border-[#EDE3D3] leading-relaxed">
              Either <strong>Husband’s</strong> or <strong>Wife’s</strong> registered mobile number will securely identify your Couple ID.
            </p>

            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-2">
                  Registered Indian Mobile Number
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
                className="w-full py-3.5 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] disabled:opacity-50 text-[#FAF7F2] font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                    <span>Dispatching OTP Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification OTP</span>
                    <ArrowRight className="w-4 h-4 text-[#D4AF37]" />
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === 'otp' && (
          <div>
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

            <div className="mb-4 p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E7DDCE] text-xs text-[#57534E]">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-[#8C6D2B]" />
                <span className="font-semibold text-[#1C1917]">OTP Verification Code</span>
              </div>
              <p className="text-[12px] text-[#78716C] leading-relaxed">
                Enter the 6-digit code received on your registered phone <strong className="text-[#1C1917]">+91 {mobile}</strong> to access your Chapter-2 renewal form.
              </p>
            </div>

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
                disabled={loading || otp.length < 6}
                className="w-full py-3.5 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] disabled:opacity-50 text-[#FAF7F2] font-semibold text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                    <span>Verifying Code...</span>
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
                    className="text-xs font-semibold text-[#8C6D2B] hover:underline cursor-pointer"
                  >
                    Resend OTP Code
                  </button>
                )}
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
