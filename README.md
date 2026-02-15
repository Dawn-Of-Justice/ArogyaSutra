# ArogyaSutra

**AI-Powered Personal Health Record Ecosystem for India**

ArogyaSutra is a Zero-Knowledge encrypted digital health platform that transforms India's paper-heavy medical landscape into an intelligent, secure, and patient-controlled health record system.

## The Core Concept

Unlike traditional health apps that act as simple cloud folders, ArogyaSutra bridges the gap between physical reliability and digital intelligence. Every patient receives a physical **ArogyaSutra Card** with a unique ID, turning their medical history into a portable "passport" that they—and only they—control.

## Why It's a Game Changer

### 🔐 Zero-Knowledge Sovereignty
Client-side encryption using Web Crypto API ensures the platform operator cannot read your data. The "keys" to the vault (Card ID + OTP) stay with the patient.

### 🤖 From Paper to Insights
AI-powered OCR reads unstructured photos of prescriptions and lab reports, extracting vital trends (blood sugar, BP, medications) so doctors don't have to flip through piles of paper.

### 🚨 The "Break-Glass" Safety Net
In life-threatening emergencies, verified medical personnel can access a restricted "Critical-Only" view (Allergies, Blood Group) through a geolocated and logged bypass.

## The Problem-Solution Fit

By replacing the "messy blue folder" of papers with a secure, AI-organized PWA (Progressive Web App), we eliminate medical errors caused by lost records and ensure that even the most tech-averse users can navigate the healthcare system with dignity and data privacy.

## How It's Different

### Active Intelligence vs. Passive Storage
Existing apps act as "folders" where you manually upload PDFs. ArogyaSutra uses AI to "read" and extract data from photos of handwritten prescriptions and reports, automatically building a structured timeline.

### Zero-Knowledge Privacy
In government or private lockers (like ABHA, DigiLocker), the platform operator or government can theoretically access your data. In ArogyaSutra, data is encrypted on your device; the operator has zero access.

### Human-Centric Entry
Instead of complex usernames and passwords that the elderly might forget, we use a physical card + DOB + OTP system, making it as easy to use as a bank ATM.

## Key Features

### 🏥 AI-Powered Digitization (Med-Vision)
Automatically extracts clinical data from photos of handwritten prescriptions and lab reports using OCR and NLP, eliminating manual data entry.

### 📅 Unified Health Timeline
Consolidates scattered medical documents into a structured, chronological digital record for long-term health tracking.

### 🔒 Zero-Knowledge Privacy
Implements client-side encryption where data is decrypted only on the user's device; the platform operator never sees the plaintext medical records.

### 🔑 Triple-Layer Authentication
Secure access gate requiring:
- Physical Card ID
- Patient's Date of Birth
- Real-time OTP

### 🚑 "Break-Glass" Emergency Protocol
Provides verified medical personnel instant access to critical data (allergies, blood group) during emergencies, with mandatory geolocation logging and patient notification.

### 💬 AI Clinical Assistant (RAG)
Enables doctors to perform natural language queries (e.g., "Show me the last three sugar levels") with direct citations to the source documents.

### 👨‍⚕️ Doctor Append-Only Mode
Allows medical professionals to contribute new entries without the ability to modify or delete the patient's existing history by default.

### 📱 Progressive Web App (PWA) Architecture
Ensures high performance in low-bandwidth areas and provides offline access to medical records without requiring a store download.

## Unique Selling Proposition

> **"The Patient is the Literal and Metaphorical Key."**

The fusion of **Physical Security** and **Zero-Knowledge Encryption**. By requiring the Physical Card ID to derive the decryption keys, we ensure that digital health data is as private as a physical conversation. We provide the intelligence of a modern Electronic Health Record with the absolute privacy of a locked paper drawer, where only the patient holds the key.

## How It Solves the Problem

### Eliminating the "Paper Trail"
AI-powered OCR converts crumpled, handwritten papers into a unified digital history, ensuring no record is ever "lost" in a blue folder.

### Context for Doctors
Busy doctors get an AI-generated summary of a patient's multi-year history in seconds, rather than flipping through 50 loose sheets during a 3-minute consultation.

### Bridging the "Golden Hour"
In emergencies, the "Break-Glass" protocol allows verified medics to see life-saving data (like allergies or blood group) instantly, preventing fatal medical errors when a patient is unconscious.

## Technology Stack

- **Frontend**: Progressive Web App (PWA)
- **Encryption**: Web Crypto API (Client-side)
- **AI/ML**: OCR + NLP for document digitization
- **Architecture**: Zero-Knowledge, Privacy-First Design

---

**ArogyaSutra** - Empowering patients with sovereign control over their health data.
