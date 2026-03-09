# ArogyaSutra

**AI-Powered, Zero-Knowledge Encrypted Personal Health Record for India**

ArogyaSutra transforms India's paper-heavy medical landscape — crumpled handwritten prescriptions, scattered lab reports, discharge summaries from different hospitals — into a structured, searchable, encrypted digital health timeline. Every patient receives a physical **ArogyaSutra Card** (`AS-XXXX-XXXX-XXXX`) that serves as the cryptographic key to unlock their health vault.

The platform combines physical card security with **client-side AES-256 encryption** via Web Crypto API, ensuring complete patient data sovereignty. Even the ArogyaSutra team and cloud infrastructure operators **cannot access plaintext patient data**.

---

## Key Features

- **Zero-Knowledge Encryption** — All data is encrypted/decrypted client-side using Web Crypto API (AES-256-GCM). The master key is derived from Card ID + OTP via PBKDF2 and is **never stored anywhere**.
- **Triple-Layer Authentication** — Card ID → Date of Birth → OTP, with optional biometric unlock for returning users.
- **AI-Powered Document Digitization (Med-Vision)** — Photograph paper prescriptions and lab reports; AI extracts structured clinical data with confidence scoring using Amazon Textract and Comprehend Medical.
- **Unified Health Timeline** — All medical records organized chronologically with document type tags (`[RX]`, `[Lab]`, `[H]`), source institution labels, and status flags (`VERIFIED`, `AI-READ`, `CRITICAL`).
- **Break-Glass Emergency Protocol** — Verified emergency personnel can access critical-only data (blood group, allergies, medications, conditions) in a timed, geo-logged session with auto-expiry.
- **RAG Clinical Assistant** — Natural language queries against patient history powered by Amazon Bedrock, with source citations and proactive health insights.
- **Doctor Append-Only Mode** — Verified doctors (MCI-registered) can view patient history with consent and add entries, but cannot modify or delete existing records.
- **Progressive Web App** — Installable without app stores, fully functional offline via service workers and IndexedDB, optimized for rural/low-bandwidth India.
- **FHIR Compliance** — All structured health data stored in FHIR format via AWS HealthLake for interoperability.
- **Multi-Language Support** — English, Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, and Kannada.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   Client — Next.js PWA                          │
│  ┌──────────┐  ┌──────────────────┐  ┌────────────────────┐     │
│  │    UI    │  │ Web Crypto Engine│  │ Service Worker +   │     │
│  │ (React)  │  │  (AES-256-GCM)   │  │ IndexedDB Cache    │     │
│  └──────────┘  └──────────────────┘  └────────────────────┘     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Encrypted data only
┌──────────────────────────▼──────────────────────────────────────┐
│                   AWS Backend                                   │
│  Cognito (Auth) · API Gateway · Lambda (Serverless Logic)       │
│  S3 (Encrypted Blobs) · HealthLake (FHIR) · DynamoDB (Logs)     │
│  Textract (OCR) · Comprehend Medical (NLP) · Bedrock (RAG)      │
│  KMS (Root Keys) · SNS + Twilio (OTP)                           │
└─────────────────────────────────────────────────────────────────┘
```

The system follows a **client-heavy model**: all encryption/decryption happens in the browser. The AWS backend stores only encrypted blobs and has no access to decryption keys.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 16 / React 19 | PWA framework with App Router |
| 3D Visualization | Three.js / React Three Fiber | Interactive body model |
| Hosting | AWS Amplify | CI/CD pipeline, custom domain, SSL |
| Encryption | Web Crypto API (AES-256-GCM) | Zero-knowledge client-side encryption |
| Key Derivation | PBKDF2 (100K iterations) | Master key from Card ID + OTP |
| Local Storage | IndexedDB (via `idb`) | Offline cache for decrypted records |
| OCR (Cloud) | Amazon Textract | Handwriting recognition from medical docs |
| Medical NLP | Amazon Comprehend Medical | Extract medications, dosages, conditions |
| AI / RAG | Amazon Bedrock (Claude / Llama) | Clinical assistant with source citations |
| Health Data | AWS HealthLake (FHIR) | Structured, interoperable medical records |
| File Storage | Amazon S3 | Encrypted image blobs |
| Key Management | AWS KMS | Root key management |
| Authentication | Amazon Cognito | Patient & doctor identity pools |
| OTP Delivery | Amazon SNS + Twilio | SMS OTP for Indian mobile numbers |
| Backend Logic | AWS Lambda | Serverless processing |
| Metadata / Logs | Amazon DynamoDB | Audit logs, access grants, sessions |
| Infrastructure | AWS CDK | Infrastructure as code |

---

## Project Structure

```
ArogyaSutra/
├── public/                     # PWA manifest, 3D body models
├── src/
│   ├── app/                    # Next.js App Router pages & API routes
│   │   ├── layout.tsx          # Root layout (PWA meta, fonts)
│   │   ├── page.tsx            # Welcome / splash screen
│   │   ├── admin/              # Admin dashboard
│   │   └── api/                # API routes (auth, timeline, assistant, etc.)
│   ├── components/             # React components
│   │   ├── auth/               # Login screen (Card ID → DOB → OTP)
│   │   ├── dashboard/          # Patient & doctor dashboards
│   │   ├── timeline/           # Health timeline with filters & detail modals
│   │   ├── scan/               # Document capture & AI extraction preview
│   │   ├── assistant/          # RAG clinical assistant chat
│   │   ├── emergency/          # Break-glass emergency access
│   │   ├── body3d/             # Interactive 3D body model
│   │   ├── onboarding/         # New patient onboarding modal
│   │   ├── profile/            # Patient profile screen
│   │   ├── notifications/      # Notification center
│   │   ├── settings/           # Settings (language, emergency data)
│   │   ├── access/             # Access log viewer
│   │   ├── help/               # Help screen
│   │   └── layout/             # App shell & navigation
│   ├── hooks/                  # Custom React hooks (auth, timeline, i18n)
│   ├── lib/
│   │   ├── crypto/             # Cryptography engine (PBKDF2, AES-GCM, RSA-OAEP)
│   │   ├── aws/                # AWS SDK wrappers (Cognito, S3, Textract, etc.)
│   │   ├── fhir/               # FHIR resource conversion & validation
│   │   ├── services/           # Business logic services
│   │   ├── rag/                # RAG pipeline utilities
│   │   ├── i18n/               # Internationalization (8 languages)
│   │   ├── llm/                # LLM integration helpers
│   │   ├── types/              # TypeScript type definitions
│   │   └── utils/              # Validators, formatters, Card ID utilities
│   └── styles/                 # Design system, animations
├── infra/                      # AWS CDK infrastructure
│   ├── bin/app.ts              # CDK app entry point
│   ├── lib/arogyasutra-stack.ts
│   └── lambda/                 # Lambda functions (auth challenge/verify)
├── amplify.yml                 # AWS Amplify build configuration
├── requirements.md             # Detailed requirements (16 user stories)
├── design.md                   # System design & architecture
└── agent.md                    # Implementation guide (phased plan)
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and **npm**
- An **AWS account** with the following services enabled: Cognito, S3, Textract, Comprehend Medical, Bedrock, HealthLake, DynamoDB, SNS, KMS, Lambda
- AWS CLI configured with appropriate credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/ArogyaSutra.git
cd ArogyaSutra

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your AWS resource IDs and credentials
```

### Environment Variables

Create a `.env.local` file with:

```env
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_COGNITO_PATIENT_POOL_ID=
NEXT_PUBLIC_COGNITO_DOCTOR_POOL_ID=
NEXT_PUBLIC_COGNITO_CLIENT_ID=
NEXT_PUBLIC_S3_BUCKET=
NEXT_PUBLIC_HEALTHLAKE_DATASTORE_ID=
APP_AWS_ACCESS_KEY_ID=
APP_AWS_SECRET_ACCESS_KEY=
SNS_TOPIC_ARN=
KMS_KEY_ID=
DYNAMODB_AUDIT_TABLE=
DYNAMODB_ACCESS_TABLE=
BEDROCK_MODEL_ID=us.amazon.nova-pro-v1:0
KIMI_BEDROCK_MODEL=moonshotai.kimi-k2.5
```

### Development

```bash
# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build & Lint

```bash
npm run build    # Production build
npm run lint     # ESLint check
```

### Infrastructure (AWS CDK)

```bash
cd infra
npm install
npx cdk deploy
```

---

## Security Model

ArogyaSutra implements a **Zero-Knowledge architecture**:

1. **Key Derivation** — `Master_Key = PBKDF2(Card_ID || OTP, salt=Card_ID, iterations=100000)` — derived ephemerally in the browser, never stored.
2. **Data Encryption** — `AES-GCM-256(plaintext, key=Master_Key, iv=random())` — every health record encrypted client-side before upload.
3. **Emergency Access** — `Emergency_Key = HKDF(Master_Key, info="emergency")` — separate key for break-glass critical-only data.
4. **Doctor Access** — `RSA-OAEP(Master_Key, publicKey=Doctor_PublicKey)` — patient re-encrypts access key for authorized doctors.
5. **Server-Side** — AWS stores **only ciphertext**. S3 blobs, HealthLake records, and DynamoDB entries are all encrypted. No plaintext ever reaches the server.

---

## Encryption Flow

```
Patient Login:
  Card ID + OTP → PBKDF2 (100K iterations) → Master_Key (in-memory only)
                                                    │
  ┌─────────────────────────────────────────────────┤
  │                                                 │
  ▼                                                 ▼
Upload: plaintext → AES-GCM encrypt → S3     Retrieve: S3 → AES-GCM decrypt → plaintext
                (client-side)                              (client-side)
```

---

## Documentation

- [requirements.md](requirements.md) — 16 detailed user stories with acceptance criteria
- [design.md](design.md) — System architecture, component interfaces, data models, and correctness properties
- [agent.md](agent.md) — Phased implementation guide with validation criteria

---

## License

This project is MIT Licence.
