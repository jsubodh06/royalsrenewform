import React, { useState, useEffect } from 'react';
import { RoyalHeader } from './components/RoyalHeader.tsx';
import { LandingScreen } from './components/LandingScreen.tsx';
import { VerificationScreen } from './components/VerificationScreen.tsx';
import { Year1ProfileCard } from './components/Year1ProfileCard.tsx';
import { Year2Form } from './components/Year2Form.tsx';
import { SuccessScreen } from './components/SuccessScreen.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import {
  MemberSession,
  AdminSession,
  MemberYear1,
  Year2ProfileData,
  Year2PreferenceData,
  SubmissionData,
  CorrectionRequest,
} from './lib/types.ts';
import { getMemberMeApi, adminLoginApi } from './lib/api.ts';
import { Loader2 } from 'lucide-react';

export default function App() {
  // Session State
  const [memberToken, setMemberToken] = useState<string | null>(
    localStorage.getItem('jsg_member_token')
  );
  const [memberSession, setMemberSession] = useState<MemberSession | null>(null);

  const [adminToken, setAdminToken] = useState<string | null>(
    localStorage.getItem('jsg_admin_token')
  );
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);

  // Active View: 'landing' | 'verify' | 'profile' | 'form' | 'success' | 'admin'
  const [activeView, setActiveView] = useState<string>('landing');

  // Loaded Member Profile Data
  const [memberYear1, setMemberYear1] = useState<MemberYear1 | null>(null);
  const [year2Profile, setYear2Profile] = useState<Year2ProfileData | null>(null);
  const [year2Preferences, setYear2Preferences] = useState<Year2PreferenceData | null>(null);
  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [currentPhoto, setCurrentPhoto] = useState<any>(null);

  // Loading & Test helpers
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);
  const [prefilledMobile, setPrefilledMobile] = useState<string>('');

  // 1. Fetch current member profile if token exists
  const fetchCurrentMember = async (token: string, targetView?: string) => {
    try {
      const data = await getMemberMeApi(token);
      setMemberSession(data.session);
      setMemberYear1(data.year1);
      setYear2Profile(data.year2Profile);
      setYear2Preferences(data.year2Preferences);
      setSubmission(data.submission);
      setIsSubmitted(data.isSubmitted);
      setHasDraft(data.hasDraft || false);
      setCorrections(data.corrections || []);
      setCurrentPhoto(data.photo || null);

      if (targetView) {
        setActiveView(targetView);
      } else if (data.isSubmitted) {
        setActiveView('success');
      } else if (data.hasDraft) {
        // Resume directly to form if an incomplete draft already exists
        setActiveView('form');
      } else {
        setActiveView('profile');
      }
    } catch (err) {
      console.warn('Session expired or invalid, logging out', err);
      handleMemberLogout();
    } finally {
      setLoadingInitial(false);
    }
  };

  useEffect(() => {
    if (memberToken) {
      fetchCurrentMember(memberToken);
    } else {
      setLoadingInitial(false);
    }
  }, [memberToken]);

  // 2. Member Login Callback
  const handleMemberVerified = (session: MemberSession, token: string) => {
    setMemberToken(token);
    setMemberSession(session);
    localStorage.setItem('jsg_member_token', token);
    fetchCurrentMember(token);
  };

  // 3. Member Logout
  const handleMemberLogout = () => {
    setMemberToken(null);
    setMemberSession(null);
    setMemberYear1(null);
    setYear2Profile(null);
    setYear2Preferences(null);
    setSubmission(null);
    setIsSubmitted(false);
    setCurrentPhoto(null);
    localStorage.removeItem('jsg_member_token');
    setActiveView('landing');
  };

  // 4. Admin Auth Callbacks
  const handleAdminLoginSuccess = (token: string, admin: AdminSession) => {
    setAdminToken(token);
    setAdminSession(admin);
    localStorage.setItem('jsg_admin_token', token);
    setActiveView('admin');
  };

  const handleAdminLogout = () => {
    setAdminToken(null);
    setAdminSession(null);
    localStorage.removeItem('jsg_admin_token');
  };

  // Quick Admin fill from test toolbar
  const handleQuickAdmin = async () => {
    try {
      const res = await adminLoginApi('subodhjain2007777@gmail.com', 'royals2027');
      handleAdminLoginSuccess(res.token, res.admin);
    } catch (e) {
      setActiveView('admin');
    }
  };

  // Quick Mobile fill from test toolbar
  const handleSelectTestMobile = (mobile: string) => {
    setPrefilledMobile(mobile);
    if (activeView !== 'verify') {
      setActiveView('verify');
    }
  };

  if (loadingInitial) {
    return (
      <div className="min-h-screen bg-[#F8F5EE] flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#8C6D2B] mx-auto" />
          <p className="font-serif-royal text-sm font-semibold text-[#1C1917] tracking-wider">
            JSG ROYALS • 2027
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F5EE] text-[#1C1917] flex flex-col font-sans selection:bg-[#EFE4C9] selection:text-[#8C6D2B]">
      
      {/* Royal Club Header */}
      <RoyalHeader
        memberSession={memberSession}
        isAdmin={!!adminToken}
        onLogout={handleMemberLogout}
        onOpenAdmin={() => setActiveView('admin')}
        onBackToPortal={() => {
          if (memberSession) {
            setActiveView(isSubmitted ? 'success' : 'profile');
          } else {
            setActiveView('landing');
          }
        }}
        activeView={activeView}
      />

      {/* Primary View Routing */}
      <main className="flex-1">
        {activeView === 'landing' && (
          <LandingScreen
            onBegin={() => setActiveView('verify')}
            onOpenAdmin={() => setActiveView('admin')}
          />
        )}

        {activeView === 'verify' && (
          <VerificationScreen
            initialMobile={prefilledMobile}
            onVerified={handleMemberVerified}
            onBack={() => setActiveView('landing')}
          />
        )}

        {activeView === 'profile' && memberYear1 && memberSession && memberToken && (
          <Year1ProfileCard
            member={memberYear1}
            session={memberSession}
            token={memberToken}
            corrections={corrections}
            hasDraft={hasDraft}
            onConfirmYear1={() => {
              fetchCurrentMember(memberToken, 'form');
            }}
            onGoToYear2={() => {
              setActiveView('form');
            }}
            onRefresh={() => fetchCurrentMember(memberToken)}
          />
        )}

        {activeView === 'form' && memberYear1 && memberToken && (
          <Year2Form
            token={memberToken}
            member={memberYear1}
            initialProfile={year2Profile}
            initialPreferences={year2Preferences}
            initialPhoto={currentPhoto}
            hasDraft={hasDraft}
            isSubmitted={isSubmitted}
            submissionDate={submission?.submitted_at}
            onSuccessSubmit={() => {
              setIsSubmitted(true);
              fetchCurrentMember(memberToken, 'success');
            }}
            onBackToProfile={() => setActiveView('profile')}
          />
        )}

        {activeView === 'success' && memberYear1 && memberToken && (
          <SuccessScreen
            member={memberYear1}
            profile={year2Profile}
            preferences={year2Preferences}
            submission={submission}
            token={memberToken}
          />
        )}

        {activeView === 'admin' && (
          <AdminDashboard
            adminToken={adminToken}
            adminSession={adminSession}
            onAdminLoginSuccess={handleAdminLoginSuccess}
            onAdminLogout={handleAdminLogout}
          />
        )}
      </main>
    </div>
  );
}
