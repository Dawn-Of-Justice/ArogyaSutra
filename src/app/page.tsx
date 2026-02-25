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

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  "doctor-dashboard": "Doctor Dashboard",
  timeline: "Timeline",
  upload: "Scan Document",
  assistant: "AI Assistant",
  access: "Doctor Access",
  emergency: "Emergency",
  settings: "Settings",
  profile: "Profile",
};

function AppRouter() {
  const { state, patient, doctor, userRole } = useAuth();
  const [screen, setScreen] = useState("dashboard");

  // Unauthenticated → show login (no shell)
  if (state !== "AUTHENTICATED") {
    return <LoginScreen />;
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
      case "timeline":
        return <TimelineScreen onNavigate={setScreen} />;
      case "assistant":
        return <AssistantScreen onNavigate={setScreen} />;
      case "emergency":
        return <BreakGlassScreen />;
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
