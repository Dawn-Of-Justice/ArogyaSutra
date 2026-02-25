# Requirements Document: ArogyaSutra

## Introduction

ArogyaSutra is an AI-powered Personal Health Record (PHR) ecosystem designed specifically for India's paper-heavy medical landscape. The system enables patients to transform scattered physical medical documents — crumpled handwritten prescriptions, scattered lab reports from different labs, discharge summaries from different hospitals, and unencrypted WhatsApp messages — into a structured, searchable, Zero-Knowledge encrypted digital timeline.

Every patient receives a physical ArogyaSutra Card with a unique ID (formatted as `AS-XXXX-XXXX`), which serves as the cryptographic "key" to unlock their health vault. The platform combines physical security through this card with client-side AES-256 encryption via Web Crypto API, ensuring patients maintain complete sovereignty over their medical data. Even the ArogyaSutra team and cloud infrastructure operators cannot access plaintext patient data.

The entire system is delivered as a Progressive Web App (PWA) — installable without app stores, functional offline via IndexedDB caching — making it viable for rural India where connectivity is unreliable.

## Glossary

- **ArogyaSutra_System**: The complete Personal Health Record platform including Next.js PWA, encryption services, AI processing, AWS backend, and authentication mechanisms
- **Patient**: An individual who owns and controls their personal health records within the system
- **Doctor**: A verified medical professional (with Medical Council of India registration) who can view patient records (with permission) and append new medical entries
- **Emergency_Personnel**: Verified medical staff who can access critical patient information during emergencies through the Break-Glass Protocol
- **ArogyaSutra_Card**: A physical card issued to each patient containing a unique Patient_ID (format: `AS-XXXX-XXXX`) and serving as the first authentication factor
- **Patient_ID**: A unique identifier (format: `AS-XXXX-XXXX`) printed on the ArogyaSutra_Card used for patient identification and key derivation
- **Med_Vision**: The AI-powered digitization engine that extracts structured clinical data from photos of medical documents using Amazon Textract (cloud OCR) and PaddleOCR (on-device), combined with Amazon Comprehend Medical for entity extraction
- **Health_Timeline**: The chronological, structured digital record of all patient medical events and documents, with document type tags ([RX] for prescriptions, [Lab] for lab reports, [H] for hospitalization), source institution labels, and status flags (VERIFIED, AI-READ, CRITICAL)
- **Zero_Knowledge_Encryption**: Client-side encryption using Web Crypto API (AES-256-GCM) where data is encrypted on the user's device and the platform operator cannot access plaintext. The decryption key is derived from Card ID + OTP and is never stored anywhere
- **Break_Glass_Protocol**: Emergency access mechanism allowing verified Emergency_Personnel to access a Critical-Only view (Blood Group, Known Allergies, Critical Medications, Active Conditions) with mandatory geo-logging, timed session with countdown, and auto-expiry
- **RAG_Assistant**: Retrieval-Augmented Generation AI system powered by Amazon Bedrock (Claude/Llama models) that answers natural language queries about patient history with source citations. Also proactively generates health insights (e.g., "Systolic BP rising over 6 months")
- **Append_Only_Mode**: Doctor access mode where medical professionals can add new entries but cannot modify or delete existing patient history, creating a tamper-evident audit trail
- **Master_Key**: The cryptographic key derived from Card ID + OTP using PBKDF2, used to encrypt and decrypt health records. It is never stored anywhere — not on the server, not in the browser
- **Emergency_Data**: Critical medical information (blood group, allergies, critical medications, active conditions) accessible through Break_Glass_Protocol in a Critical-Only view
- **OTP**: One-Time Password delivered to the patient's registered mobile number via Amazon SNS + Twilio for authentication
- **Geolocation_Log**: Mandatory location record (coordinates, timestamp, medic ID) captured when Emergency_Personnel access patient data
- **Clinical_Data**: Structured medical information extracted from documents including doctor name, medication names, dosages, follow-up instructions, lab values, diagnoses, and vital signs
- **PWA**: Progressive Web App architecture enabling offline functionality via service workers and IndexedDB, installable on Android/iOS home screens without app store downloads
- **FHIR**: Fast Healthcare Interoperability Resources — the standard format used for storing structured health data in AWS HealthLake
- **MCI_Registration**: Medical Council of India registration number used to verify doctor credentials (e.g., `KA-28411`)
- **Amazon_Cognito**: AWS identity management service used for patient and doctor authentication, user pools, and session management
- **Amazon_Textract**: AWS OCR service used for cloud-based text extraction from medical documents, including handwriting recognition
- **PaddleOCR**: On-device OCR engine for privacy-first document processing without uploading to the cloud
- **Amazon_Comprehend_Medical**: AWS NLP service that extracts medications, dosages, conditions, and other medical entities from text
- **Amazon_Bedrock**: AWS generative AI service (Claude/Llama models) powering the RAG Clinical Assistant
- **AWS_HealthLake**: AWS FHIR-compliant data store for structured, interoperable medical records
- **AWS_KMS**: AWS Key Management Service for root key management (used with client-side encryption)

## Requirements

### Requirement 1: Patient Registration and Card Issuance

**User Story:** As a new patient, I want to register for ArogyaSutra and receive a physical card with my unique ID, so that I can start building my digital health record with secure authentication.

#### Acceptance Criteria

1. WHEN a patient completes registration with personal details and mobile number, THE ArogyaSutra_System SHALL generate a unique Patient_ID in the format `AS-XXXX-XXXX`
2. WHEN a Patient_ID is generated, THE ArogyaSutra_System SHALL ensure it is globally unique across all patients
3. WHEN registration is complete, THE ArogyaSutra_System SHALL initiate physical ArogyaSutra_Card production with the Patient_ID printed on the card
4. WHEN a patient provides their date of birth during registration, THE ArogyaSutra_System SHALL store it securely for authentication and key derivation purposes
5. WHEN a patient provides a mobile number, THE ArogyaSutra_System SHALL verify it through OTP (delivered via Amazon SNS) before completing registration
6. THE ArogyaSutra_System SHALL create an initial empty Health_Timeline for each new patient
7. THE ArogyaSutra_System SHALL create separate user pools in Amazon Cognito for patients and doctors
8. WHEN registration is complete, THE ArogyaSutra_System SHALL prompt the patient to configure their Emergency_Data during onboarding

### Requirement 2: Zero-Knowledge Encryption and Data Sovereignty

**User Story:** As a patient, I want my medical data encrypted on my device before it reaches the server, so that only I can access my health information and the platform operator cannot read it.

#### Acceptance Criteria

1. WHEN a patient first logs in, THE ArogyaSutra_System SHALL derive a Master_Key from Card ID + OTP using PBKDF2 through the Web Crypto API (AES-256-GCM) on the client device
2. WHEN a patient uploads or creates health data, THE ArogyaSutra_System SHALL encrypt it client-side using the Master_Key before transmission to Amazon S3
3. WHEN encrypted data is stored on AWS servers (S3, HealthLake), THE ArogyaSutra_System SHALL maintain it in encrypted form without access to decryption keys
4. WHEN a patient retrieves their health data, THE ArogyaSutra_System SHALL fetch encrypted blobs from S3 and decrypt them client-side using the Master_Key
5. THE ArogyaSutra_System SHALL NOT store the Master_Key or any decryption keys on the server, in the browser, or anywhere else — the key is derived ephemerally from credentials
6. WHEN a patient changes their authentication credentials, THE ArogyaSutra_System SHALL re-encrypt all health data with a new Master_Key
7. THE ArogyaSutra_System SHALL use AWS KMS for root key management while ensuring client-side encryption so that plaintext never reaches AWS
8. EVEN AWS engineers, cloud administrators, and the ArogyaSutra development team SHALL NOT be able to read patient data at any point

### Requirement 3: Triple-Layer Authentication

**User Story:** As a patient, I want multi-factor authentication using my physical card, date of birth, and OTP, so that my health records are protected from unauthorized access — as easy as using a bank ATM.

#### Acceptance Criteria

1. WHEN a patient attempts to log in, THE ArogyaSutra_System SHALL require the Patient_ID from their ArogyaSutra_Card as Layer 1
2. WHEN a Patient_ID is provided, THE ArogyaSutra_System SHALL require the patient's date of birth as Layer 2
3. WHEN Patient_ID and date of birth are validated, THE ArogyaSutra_System SHALL send an OTP to the registered mobile number via Amazon SNS + Twilio as Layer 3
4. WHEN an OTP is generated, THE ArogyaSutra_System SHALL expire it within 5 minutes
5. WHEN all three authentication layers are successfully verified, THE ArogyaSutra_System SHALL derive the decryption key locally and grant access to the patient's Health_Timeline
6. WHEN any authentication layer fails, THE ArogyaSutra_System SHALL reject the login attempt and log the failure
7. WHEN three consecutive failed login attempts occur, THE ArogyaSutra_System SHALL temporarily lock the account and notify the patient
8. THE ArogyaSutra_System SHALL use Amazon Cognito for identity management and session management
9. AFTER initial authentication, THE ArogyaSutra_System SHALL support optional biometric unlock (fingerprint/face) for returning users on their registered device

### Requirement 4: AI-Powered Document Digitization (Med-Vision)

**User Story:** As a patient, I want to photograph my paper prescriptions and lab reports and have the system automatically extract medical information with confidence scoring, so that I don't have to manually type clinical data.

#### Acceptance Criteria

1. WHEN a patient uploads a photo of a medical document, THE Med_Vision SHALL process it using Amazon Textract (cloud) for OCR or PaddleOCR (on-device) for privacy-first processing
2. WHEN text is extracted from a document, THE Med_Vision SHALL apply Amazon Comprehend Medical to identify Clinical_Data including doctor name, medication names, dosages, follow-up instructions, lab values, diagnoses, and vital signs
3. WHEN Clinical_Data is identified, THE Med_Vision SHALL structure it into FHIR-compliant fields for storage in AWS HealthLake
4. WHEN handwritten text is present, THE Med_Vision SHALL attempt to recognize and extract it with confidence scoring
5. WHEN extraction is complete, THE Med_Vision SHALL display an "AI Extraction Preview" showing extracted data with a confidence score (e.g., "95% confident")
6. THE Med_Vision SHALL allow the patient to confirm or correct the extracted data before saving
7. WHEN extraction confidence is below 70 percent, THE Med_Vision SHALL flag the data for patient review and manual correction
8. WHEN a document contains multiple data types (prescriptions + lab values), THE Med_Vision SHALL categorize each element appropriately
9. THE Med_Vision SHALL preserve the original document photo (encrypted) alongside extracted Clinical_Data in Amazon S3
10. WHEN processing fails, THE Med_Vision SHALL return a descriptive error message and allow manual data entry

### Requirement 5: Unified Health Timeline

**User Story:** As a patient, I want all my medical records organized chronologically in a single timeline with clear tags and filters, so that I can easily track my health history and share it with doctors.

#### Acceptance Criteria

1. WHEN Clinical_Data is extracted or manually entered, THE ArogyaSutra_System SHALL add it to the patient's Health_Timeline with a timestamp
2. WHEN displaying the Health_Timeline, THE ArogyaSutra_System SHALL order all entries chronologically from newest to oldest
3. WHEN a patient views their Health_Timeline, THE ArogyaSutra_System SHALL display document type tags: [RX] for prescriptions, [Lab] for lab reports, [H] for hospitalization records
4. WHEN displaying timeline entries, THE ArogyaSutra_System SHALL show source institution (e.g., "Apollo Hospitals", "Metropolis Labs") where available
5. WHEN displaying timeline entries, THE ArogyaSutra_System SHALL show status flags: VERIFIED (doctor-confirmed), AI-READ (AI-extracted), CRITICAL (flagged as urgent)
6. WHEN a patient selects a timeline entry, THE ArogyaSutra_System SHALL display full details and original document photos
7. THE ArogyaSutra_System SHALL support filtering the Health_Timeline by date range, document type, source institution, and clinical category
8. THE ArogyaSutra_System SHALL support searching the Health_Timeline by medication name, diagnosis, doctor name, or institution
9. WHEN multiple entries exist for the same date, THE ArogyaSutra_System SHALL group them together in the timeline view
10. THE ArogyaSutra_System SHALL store structured timeline data in AWS HealthLake in FHIR format for interoperability

### Requirement 6: Break-Glass Emergency Protocol

**User Story:** As emergency medical personnel, I want to access critical patient information during medical emergencies even without the patient's explicit permission, so that I can provide appropriate life-saving care within a timed session.

#### Acceptance Criteria

1. WHEN Emergency_Personnel initiate Break_Glass_Protocol, THE ArogyaSutra_System SHALL require verified medical credentials including their Medical Council ID (e.g., MCI Reg: KA-28411)
2. WHEN medical credentials are submitted, THE ArogyaSutra_System SHALL verify them against official Medical Council databases via Amazon Cognito
3. WHEN Break_Glass_Protocol is activated, THE ArogyaSutra_System SHALL capture and store the Emergency_Personnel's geolocation with timestamp, coordinates, and medic ID
4. WHEN Break_Glass_Protocol is activated, THE ArogyaSutra_System SHALL grant access only to a Critical-Only view showing: Blood Group, Known Allergies, Critical Medications, and Active Conditions
5. WHEN Break_Glass_Protocol access is granted, THE ArogyaSutra_System SHALL display a visible countdown timer (e.g., "4 minutes 32 seconds remaining")
6. WHEN the countdown timer expires, THE ArogyaSutra_System SHALL automatically terminate the emergency session and revoke access
7. WHEN Break_Glass_Protocol is used, THE ArogyaSutra_System SHALL create a detailed audit log including timestamp, personnel identity, MCI registration, geolocation, and session duration, stored in Amazon DynamoDB
8. WHEN Break_Glass_Protocol is activated, THE ArogyaSutra_System SHALL send an immediate notification to the patient's registered mobile number AND their designated emergency contact
9. THE ArogyaSutra_System SHALL NOT allow Emergency_Personnel to modify or delete patient data through Break_Glass_Protocol
10. THE ArogyaSutra_System SHALL use AWS Lambda for the break-glass bypass logic and DynamoDB for access logs

### Requirement 7: Doctor Access and Append-Only Mode

**User Story:** As a doctor, I want to view my patient's complete medical history and add new entries after consultation, so that I can provide informed care and maintain continuity of records with a tamper-evident audit trail.

#### Acceptance Criteria

1. WHEN a patient grants access to a Doctor, THE ArogyaSutra_System SHALL allow the Doctor to view the complete Health_Timeline after patient consent flow is completed
2. WHEN a Doctor views patient records, THE ArogyaSutra_System SHALL decrypt data using patient-authorized access keys
3. WHEN a Doctor adds a new entry (notes, observations, prescriptions), THE ArogyaSutra_System SHALL append it to the Health_Timeline with the Doctor's identity, MCI registration, and timestamp
4. WHERE Append_Only_Mode is enabled, THE ArogyaSutra_System SHALL prevent Doctors from modifying existing Health_Timeline entries
5. WHERE Append_Only_Mode is enabled, THE ArogyaSutra_System SHALL prevent Doctors from deleting existing Health_Timeline entries
6. ALL doctor additions SHALL be logged and attributed (e.g., "Dr. Gupta added a note") creating a tamper-evident audit trail
7. WHEN a Doctor attempts unauthorized modification, THE ArogyaSutra_System SHALL reject the action and log the attempt
8. WHEN a patient revokes Doctor access, THE ArogyaSutra_System SHALL immediately prevent that Doctor from viewing the Health_Timeline

### Requirement 8: RAG-Powered Clinical Assistant

**User Story:** As a doctor or patient, I want to ask natural language questions about health history and get answers with source citations and proactive health insights, so that I can quickly find relevant information and track health trends.

#### Acceptance Criteria

1. WHEN a user (Doctor or Patient) submits a natural language query about patient history (e.g., "Show me the last three sugar readings" or "Any drug interactions with current meds?"), THE RAG_Assistant SHALL process it using Amazon Bedrock (Claude or Llama models)
2. WHEN processing a query, THE RAG_Assistant SHALL retrieve relevant documents from the patient's Health_Timeline via AWS HealthLake
3. WHEN generating a response, THE RAG_Assistant SHALL cite specific source documents and timeline entries with direct links
4. WHEN multiple relevant entries exist, THE RAG_Assistant SHALL synthesize information across documents while maintaining source attribution
5. THE RAG_Assistant SHALL proactively generate health insights such as: "Systolic BP rising over 6 months (avg 145 mmHg)" or "HbA1c dropped 8.1% → 7.4% since Aug 2025"
6. WHEN no relevant information is found, THE RAG_Assistant SHALL clearly state that the information is not available in the patient's records
7. THE RAG_Assistant SHALL only access data that the requesting user is authorized to view
8. WHEN a query is ambiguous, THE RAG_Assistant SHALL ask clarifying questions before searching
9. THE RAG_Assistant SHALL use Amazon Comprehend Medical for medical entity extraction before querying Bedrock

### Requirement 9: Progressive Web App Architecture

**User Story:** As a patient in a low-bandwidth or rural area, I want to access my medical records offline and have the app work smoothly without downloading from an app store, so that I can use ArogyaSutra regardless of connectivity.

#### Acceptance Criteria

1. WHEN a patient first visits the ArogyaSutra web application, THE PWA SHALL cache essential resources for offline use via service workers
2. WHEN a patient loses internet connectivity, THE PWA SHALL continue to function with cached data stored in IndexedDB
3. WHEN offline, THE PWA SHALL allow patients to view previously loaded Health_Timeline entries
4. WHEN offline, THE PWA SHALL allow patients to capture and queue new document photos for upload when connectivity returns
5. WHEN connectivity is restored, THE PWA SHALL automatically sync queued uploads to the server
6. THE PWA SHALL display a clear indicator of online/offline status to the patient
7. WHEN bandwidth is limited, THE PWA SHALL optimize image loading and data transfer to minimize data usage
8. THE PWA SHALL be installable on Android and iOS home screens without requiring Play Store or App Store downloads
9. THE PWA SHALL be built using Next.js with SSR capability and hosted on AWS Amplify with CI/CD pipeline, custom domain, and SSL
10. THE PWA SHALL use IndexedDB for fast local data access and offline caching of decrypted records

### Requirement 10: Patient Data Export and Portability

**User Story:** As a patient, I want to export my complete medical history in standard formats, so that I can share it with healthcare providers or migrate to other systems if needed.

#### Acceptance Criteria

1. WHEN a patient requests data export, THE ArogyaSutra_System SHALL generate a complete archive of their Health_Timeline
2. WHEN exporting data, THE ArogyaSutra_System SHALL include all Clinical_Data in structured FHIR-compliant format
3. WHEN exporting data, THE ArogyaSutra_System SHALL include all original document photos
4. THE ArogyaSutra_System SHALL support export in PDF format for human readability
5. THE ArogyaSutra_System SHALL support export in JSON (FHIR) format for machine readability and interoperability
6. WHEN generating exports, THE ArogyaSutra_System SHALL decrypt all data client-side before including it in the export
7. WHEN an export is complete, THE ArogyaSutra_System SHALL provide a secure download link valid for 24 hours

### Requirement 11: Emergency Data Configuration

**User Story:** As a patient, I want to designate which critical information is accessible during emergencies, so that emergency personnel can access life-saving information while protecting my privacy.

#### Acceptance Criteria

1. WHEN a patient configures Emergency_Data, THE ArogyaSutra_System SHALL allow selection of blood group, allergies, critical medications, active/chronic conditions, and emergency contacts
2. WHEN Emergency_Data is configured, THE ArogyaSutra_System SHALL store it with special encryption allowing Break_Glass_Protocol access
3. WHEN a patient updates Emergency_Data, THE ArogyaSutra_System SHALL immediately reflect changes in Break_Glass_Protocol access
4. THE ArogyaSutra_System SHALL display a clear summary of what information is accessible through Break_Glass_Protocol
5. WHEN Emergency_Data is not configured, THE ArogyaSutra_System SHALL prompt patients to set it up during onboarding
6. THE ArogyaSutra_System SHALL allow patients to update Emergency_Data at any time

### Requirement 12: Audit Logging and Access Transparency

**User Story:** As a patient, I want to see a complete log of who accessed my medical records and when, so that I can monitor for unauthorized access and maintain trust in the system.

#### Acceptance Criteria

1. WHEN any user accesses a patient's Health_Timeline, THE ArogyaSutra_System SHALL create an audit log entry in Amazon DynamoDB with timestamp and user identity
2. WHEN a Doctor views patient records, THE ArogyaSutra_System SHALL log the access with Doctor identity, MCI registration, and timestamp
3. WHEN Break_Glass_Protocol is used, THE ArogyaSutra_System SHALL log Emergency_Personnel identity, Medical Council ID, timestamp, geolocation coordinates, and session duration
4. WHEN a patient views their audit log, THE ArogyaSutra_System SHALL display all access events in chronological order
5. THE ArogyaSutra_System SHALL retain audit logs for a minimum of 7 years
6. WHEN suspicious access patterns are detected, THE ArogyaSutra_System SHALL alert the patient
7. THE ArogyaSutra_System SHALL prevent modification or deletion of audit log entries

### Requirement 13: Doctor Verification and Credentialing

**User Story:** As a system administrator, I want to verify doctor credentials before granting them access to patient records, so that only legitimate medical professionals can use the platform.

#### Acceptance Criteria

1. WHEN a Doctor registers, THE ArogyaSutra_System SHALL require their Medical Council of India (MCI) registration number and registration details
2. WHEN Doctor credentials are submitted, THE ArogyaSutra_System SHALL verify them against official Medical Council databases
3. WHEN verification is successful, THE ArogyaSutra_System SHALL activate the Doctor account and register them in the Amazon Cognito doctor user pool
4. WHEN verification fails, THE ArogyaSutra_System SHALL reject the registration and provide a reason
5. THE ArogyaSutra_System SHALL periodically re-verify Doctor credentials to ensure MCI licenses remain valid
6. WHEN a Doctor's MCI license expires or is revoked, THE ArogyaSutra_System SHALL immediately suspend their account and revoke all patient access

### Requirement 14: Multi-Language Support

**User Story:** As a patient who speaks a regional Indian language, I want to use ArogyaSutra in my preferred language, so that I can understand and manage my health records without language barriers.

#### Acceptance Criteria

1. THE ArogyaSutra_System SHALL support user interface in English, Hindi, Tamil, Telugu, Bengali, Marathi, Gujarati, and Kannada
2. WHEN a patient selects a language preference, THE ArogyaSutra_System SHALL display all interface elements in that language
3. WHEN Med_Vision extracts text from documents, THE ArogyaSutra_System SHALL detect the document language
4. WHEN Clinical_Data is in a regional language, THE Med_Vision SHALL extract and preserve it in the original language
5. WHEN displaying Clinical_Data, THE ArogyaSutra_System SHALL show it in the original language with optional translation
6. THE RAG_Assistant SHALL support queries in multiple Indian languages

### Requirement 15: Data Backup and Recovery

**User Story:** As a patient, I want my medical data automatically backed up and recoverable, so that I don't lose my health history if I lose my device or forget my credentials.

#### Acceptance Criteria

1. WHEN a patient's data changes, THE ArogyaSutra_System SHALL automatically create encrypted backups on Amazon S3
2. WHEN a patient loses access to their Master_Key, THE ArogyaSutra_System SHALL provide a recovery mechanism using verified identity and security questions
3. WHEN account recovery is initiated, THE ArogyaSutra_System SHALL require multiple verification factors including registered mobile number and government ID
4. WHEN recovery is successful, THE ArogyaSutra_System SHALL allow the patient to set new credentials and derive a new Master_Key
5. THE ArogyaSutra_System SHALL maintain encrypted backups for a minimum of 10 years
6. WHEN a patient deletes their account, THE ArogyaSutra_System SHALL securely delete all backups after a 90-day grace period

### Requirement 16: Core Application Screens

**User Story:** As a user of the ArogyaSutra platform, I want a set of intuitive screens for all major workflows, so that the application experience is cohesive and easy to navigate.

#### Acceptance Criteria

1. THE ArogyaSutra_System SHALL provide a Welcome/Splash screen with a prominently visible Emergency Break-Glass button for first responders
2. THE ArogyaSutra_System SHALL provide a Triple-Layer Auth screen guiding the user through Card ID → DOB → OTP steps sequentially
3. THE ArogyaSutra_System SHALL provide a Med-Vision scan screen with camera integration and an AI Extraction Preview showing confidence scores and editable fields
4. THE ArogyaSutra_System SHALL provide a Unified Health Timeline screen with filtering, search, document type tags, and status flags
5. THE ArogyaSutra_System SHALL provide an AI Clinical Assistant chat interface for natural language queries with cited responses
6. THE ArogyaSutra_System SHALL provide a Break-Glass Emergency Access screen for verified medical personnel, displaying the Critical-Only view with a countdown timer
7. THE ArogyaSutra_System SHALL provide a Doctor Portal with append-only access, patient consent workflows, and MCI credential management
8. THE ArogyaSutra_System SHALL provide a Patient Settings screen for managing Emergency Data, language preferences, biometric unlock, and access grants

## Technology Stack Reference

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React / Next.js | PWA framework with SSR capability |
| Hosting | AWS Amplify | CI/CD pipeline, custom domain, SSL |
| On-device Encryption | Web Crypto API (AES-256) | Zero-knowledge guarantee |
| Local Storage | IndexedDB | Offline access to records |
| OCR (Cloud) | Amazon Textract | Handwriting recognition from medical docs |
| OCR (On-device) | PaddleOCR | Privacy-first, no upload needed |
| Medical NLP | Amazon Comprehend Medical | Extract medications, dosages, conditions |
| AI Chat / RAG | Amazon Bedrock (Claude/Llama) | Clinical assistant queries with citations |
| Health Data Store | AWS HealthLake (FHIR) | Structured, interoperable medical records |
| File Storage | Amazon S3 | Encrypted image blobs of prescriptions |
| Key Management | AWS KMS | Root key management (client-side encrypted) |
| Authentication | Amazon Cognito | Patient and doctor identity management |
| OTP Delivery | Amazon SNS + Twilio | Real-time SMS OTPs |
| Backend Logic | AWS Lambda | Serverless — encryption handshakes, processing |
| Database | Amazon DynamoDB | Access logs, metadata, session management |

## Cost Estimates (10,000 Users)

| Service | Usage | Cost |
|---|---|---|
| Amazon S3 | 100GB compressed images | ₹190 |
| Amazon Textract | 20,000 pages OCR | ₹2,490 |
| Amazon Bedrock | 10M tokens | ₹85 |
| Amazon SNS (OTPs) | 10,000 SMS | ₹2,075 |
| AWS HealthLake | 10,000 FHIR records | ₹1,245 |
| Lambda + DynamoDB | Compute | Free Tier |
| **Total** | | **~₹6,085 (~₹0.60/user)** |
