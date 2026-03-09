// ============================================================
// Main App — Client-side Router with AppShell
// Supports both Patient and Doctor roles
// ============================================================

"use client";

import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { useLanguage, broadcastLangChange } from "../hooks/useLanguage";
import type { SupportedLang } from "../lib/i18n/translations";
import LoginScreen from "../components/auth/LoginScreen";
import AppShell from "../components/layout/AppShell";
import Dashboard from "../components/dashboard/Dashboard";
import DoctorDashboard from "../components/dashboard/DoctorDashboard";
import type { DoctorPatientContext, PatientData } from "../components/dashboard/DoctorDashboard";
import TimelineScreen from "../components/timeline/TimelineScreen";
import AssistantScreen from "../components/assistant/AssistantScreen";
import BreakGlassScreen from "../components/emergency/BreakGlassScreen";
import ProfileScreen from "../components/profile/ProfileScreen";
import SettingsScreen from "../components/settings/SettingsScreen";
import HelpScreen from "../components/help/HelpScreen";
import NotificationsScreen from "../components/notifications/NotificationsScreen";
import AccessLogScreen from "../components/access/AccessLogScreen";
import OnboardingModal from "../components/onboarding/OnboardingModal";

// PAGE_TITLES are now derived from translations inside AppRouter

function AppRouter() {
  const { state, patient, doctor, userRole, hydrated } = useAuth();
  const { t } = useLanguage();
  const [screen, setScreen] = useState("dashboard");

  // Restore the last active screen on page refresh
  useEffect(() => {
    const saved = sessionStorage.getItem("app_screen");
    if (saved) setScreen(saved);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist screen changes so refresh brings you back here
  useEffect(() => {
    sessionStorage.setItem("app_screen", screen);
  }, [screen]);

  // Show the onboarding modal for accounts that haven't set their gender yet
  const [showOnboarding, setShowOnboarding] = useState(false);
  useEffect(() => {
    if (state !== "AUTHENTICATED" || userRole !== "patient" || !patient?.patientId) return;
    if (!patient.gender) setShowOnboarding(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, patient?.patientId, patient?.gender]);
  // Active patient session for doctor — used to gate Records nav + AI context
  const [doctorActivePatient, setDoctorActivePatient] = useState<DoctorPatientContext | null>(null);
  // Full patient data — lifted here so it survives DoctorDashboard unmount/remount on navigation
  const [doctorPatientData, setDoctorPatientData] = useState<PatientData | null>(null);
  // When a record is selected from global search, store its entryId to pass to TimelineScreen
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  // AssistantScreen is lazily mounted on first visit and kept alive to preserve chat state across tab switches
  const [assistantMounted, setAssistantMounted] = useState(false);
  useEffect(() => {
    if (screen === "assistant" && !assistantMounted) setAssistantMounted(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Sync language from Cognito patient data on login (for new devices)
  useEffect(() => {
    if (patient?.language) {
      broadcastLangChange(patient.language as SupportedLang);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.language]);
  const [showBreakGlass, setShowBreakGlass] = useState(false);

  // Wait for client-side session restoration to avoid hydration mismatch
  if (!hydrated) return null;

  // Unauthenticated → show login (no shell), or break-glass overlay
  if (state !== "AUTHENTICATED") {
    if (showBreakGlass) {
      return <BreakGlassScreen onClose={() => setShowBreakGlass(false)} />;
    }
    return <LoginScreen onEmergencyAccess={() => setShowBreakGlass(true)} />;
  }

  const isDoctor = userRole === "doctor";

  // If doctor just logged in and screen is still "dashboard", redirect to doctor dashboard
  const activeScreen = screen === "dashboard" && isDoctor ? "doctor-dashboard" : screen;

  const renderScreen = () => {
    switch (activeScreen) {
      case "dashboard":
        return <Dashboard onNavigate={handleNavigate} />;
      case "doctor-dashboard":
        return (
          <DoctorDashboard
            onNavigate={handleNavigate}
            doctorName={doctor?.fullName}
            onPatientVerified={setDoctorActivePatient}
            initialPatient={doctorPatientData}
            onPatientDataChange={setDoctorPatientData}
          />
        );
      case "profile":
        return <ProfileScreen onNavigate={handleNavigate} />;
      case "timeline":
        return <TimelineScreen onNavigate={handleNavigate} patientId={doctorActivePatient?.cardId} initialEntryId={pendingEntryId} onEntryOpened={() => setPendingEntryId(null)} />;
      case "assistant":
        return null; // rendered persistently below
      case "settings":
        return <SettingsScreen onNavigate={handleNavigate} />;
      case "help":
        return <HelpScreen onNavigate={handleNavigate} />;
      case "access":
        return <AccessLogScreen />;
      case "notifications":
        return <NotificationsScreen onNavigate={handleNavigate} userId={isDoctor ? doctor?.doctorId : patient?.patientId} />;
      default:
        return isDoctor
          ? <DoctorDashboard onNavigate={handleNavigate} doctorName={doctor?.fullName} onPatientVerified={setDoctorActivePatient} initialPatient={doctorPatientData} onPatientDataChange={setDoctorPatientData} />
          : <Dashboard onNavigate={handleNavigate} />;
    }
  };

  const userName = isDoctor
    ? doctor?.fullName || t("role_doctor")
    : patient?.fullName || "User";

  const PAGE_TITLES: Record<string, string> = {
    dashboard: t("page_dashboard"),
    "doctor-dashboard": t("page_doctor_dashboard"),
    timeline: t("page_timeline"),
    assistant: t("page_assistant"),
    access: t("page_access"),
    settings: t("page_settings"),
    help: t("page_help"),
    notifications: t("page_notifications"),
    profile: t("page_profile"),
  };

  const handleRecordSelect = (entryId: string) => {
    setPendingEntryId(entryId);
  };

  // Intercept navigation: "entry/{id}" from citation clicks → timeline + auto-open
  const handleNavigate = (target: string) => {
    if (target.startsWith("entry/")) {
      const entryId = target.slice("entry/".length);
      if (entryId) setPendingEntryId(entryId);
      setScreen("timeline");
    } else {
      setScreen(target);
    }
  };

  return (
    <AppShell
      activeScreen={activeScreen}
      onNavigate={handleNavigate}
      pageTitle={PAGE_TITLES[activeScreen] || "ArogyaSutra"}
      userName={userName}
      userRole={isDoctor ? "Doctor" : "Patient"}
      userId={isDoctor ? doctor?.doctorId : patient?.patientId}
      activePatientId={doctorActivePatient?.cardId}
      onRecordSelect={handleRecordSelect}
    >
      {/* AssistantScreen stays mounted once visited — chat history survives tab switches */}
      {assistantMounted && (
        <div style={activeScreen !== "assistant" ? { display: "none" } : {}}>
          <AssistantScreen onNavigate={handleNavigate} doctorPatientContext={doctorActivePatient ?? undefined} />
        </div>
      )}
      {activeScreen !== "assistant" && renderScreen()}
      {/* First-login onboarding modal — patients only, shown once */}
      {showOnboarding && <OnboardingModal onComplete={() => setShowOnboarding(false)} />}
    </AppShell>
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
