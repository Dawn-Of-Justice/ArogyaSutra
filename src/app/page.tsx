// ============================================================
// Main App — Client-side Router with AppShell
// Supports both Patient and Doctor roles
// ============================================================

"use client";

import React, { useState } from "react";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import LoginScreen from "../components/auth/LoginScreen";
import AppShell from "../components/layout/AppShell";
import Dashboard from "../components/dashboard/Dashboard";
import DoctorDashboard from "../components/dashboard/DoctorDashboard";
import TimelineScreen from "../components/timeline/TimelineScreen";
import AssistantScreen from "../components/assistant/AssistantScreen";
import BreakGlassScreen from "../components/emergency/BreakGlassScreen";
import ProfileScreen from "../components/profile/ProfileScreen";
import SettingsScreen from "../components/settings/SettingsScreen";
import HelpScreen from "../components/help/HelpScreen";
import NotificationsScreen from "../components/notifications/NotificationsScreen";

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  "doctor-dashboard": "Doctor Dashboard",
  timeline: "Timeline",
  upload: "Scan Document",
  assistant: "AI Assistant",
  access: "Doctor Access",
  emergency: "Emergency",
  settings: "Settings",
  help: "Help & Support",
  notifications: "Notifications",
  profile: "Profile",
};

function AppRouter() {
  const { state, patient, doctor, userRole, hydrated } = useAuth();
  const [screen, setScreen] = useState("dashboard");
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
        return <Dashboard onNavigate={setScreen} />;
      case "doctor-dashboard":
        return (
          <DoctorDashboard
            onNavigate={setScreen}
            doctorName={doctor?.fullName}
          />
        );
      case "profile":
        return <ProfileScreen onNavigate={setScreen} />;
      case "timeline":
        return <TimelineScreen onNavigate={setScreen} />;
      case "assistant":
        return <AssistantScreen onNavigate={setScreen} />;
      case "settings":
        return <SettingsScreen onNavigate={setScreen} />;
      case "help":
        return <HelpScreen onNavigate={setScreen} />;
      case "notifications":
        return <NotificationsScreen onNavigate={setScreen} userId={isDoctor ? doctor?.doctorId : patient?.patientId} />;
      default:
        return isDoctor
          ? <DoctorDashboard onNavigate={setScreen} doctorName={doctor?.fullName} />
          : <Dashboard onNavigate={setScreen} />;
    }
  };

  const userName = isDoctor
    ? doctor?.fullName || "Doctor"
    : patient?.fullName || "User";

  return (
    <AppShell
      activeScreen={activeScreen}
      onNavigate={setScreen}
      pageTitle={PAGE_TITLES[activeScreen] || "ArogyaSutra"}
      userName={userName}
      userRole={isDoctor ? "Doctor" : "Patient"}
      userId={isDoctor ? doctor?.doctorId : patient?.patientId}
    >
      {renderScreen()}
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
