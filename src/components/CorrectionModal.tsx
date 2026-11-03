import React, { useState } from 'react';
import { X, Send, AlertTriangle, CheckCircle } from 'lucide-react';
import { requestCorrectionApi } from '../lib/api.ts';

interface CorrectionModalProps {
  coupleId: string;
  token: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const CorrectionModal: React.FC<CorrectionModalProps> = ({
  coupleId,
  token,
  onClose,
  onSuccess,
}) => {
  const [category, setCategory] = useState('Spelling of Name');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const categories = [
    'Spelling of Name',
    'Marriage Anniversary Date',
    'Date of Birth',
    'Registered Mobile Number',
    'Children Details',
    'City / Address',
    'Other Year-1 Information'
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Please tell us what information is incorrect.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await requestCorrectionApi(token, category, message.trim());
      setSubmitted(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2500);
    } catch (err: any) {
      setError(err.message || 'Failed to submit correction request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FFFFFF] border border-[#E7DDCE] rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-[#78716C] hover:text-[#1C1917] p-1.5 rounded-full hover:bg-[#F5EFE6] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {submitted ? (
          <div className="text-center py-8 space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle className="w-7 h-7" />
            </div>
            <h3 className="font-serif-royal text-xl font-bold text-[#1C1917]">
              Correction Request Sent
            </h3>
            <p className="text-xs text-[#57534E] max-w-xs mx-auto leading-relaxed">
              Thanks — we&apos;ve received your correction request. Our JSG Royals team will review it.
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-2.5 text-[#8C6D2B] mb-2">
              <AlertTriangle className="w-5 h-5 text-[#C5A869]" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Year-1 Record Correction • {coupleId}
              </span>
            </div>

            <h3 className="font-serif-royal text-xl font-bold text-[#1C1917] mb-1">
              What needs to be corrected?
            </h3>
            <p className="text-xs text-[#78716C] mb-4 leading-relaxed">
              Protected identity fields cannot be modified directly. Please let us know what needs correction, and our committee will review it.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 text-red-700 text-xs border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D9CDB8] bg-[#FAF7F2] text-sm text-[#1C1917] outline-hidden focus:ring-2 focus:ring-[#C5A869]"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#44403C] mb-1.5">
                  Details
                </label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please tell us what information is incorrect."
                  className="w-full p-3.5 rounded-xl border border-[#D9CDB8] text-sm text-[#1C1917] outline-hidden placeholder:text-[#A8A29E] focus:ring-2 focus:ring-[#C5A869]"
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 px-4 rounded-xl border border-[#D9CDB8] text-xs font-semibold text-[#57534E] hover:bg-[#FAF7F2] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#1C1917] hover:bg-[#2A2623] disabled:opacity-50 text-xs font-semibold text-[#FAF7F2] transition-colors flex items-center justify-center gap-2 border border-[#C5A869]/30"
                >
                  {loading ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <span>Send Correction Request</span>
                      <Send className="w-3.5 h-3.5 text-[#D4AF37]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
