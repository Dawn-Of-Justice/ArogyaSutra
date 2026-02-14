# Requirements Document: ArogyaSutra

## Introduction

ArogyaSutra is an AI-powered Personal Health Record (PHR) ecosystem designed specifically for India's paper-heavy medical landscape. The system enables patients to transform scattered physical medical documents (prescriptions, lab reports, discharge summaries) into a structured, searchable, Zero-Knowledge encrypted digital timeline. The platform combines physical security through a unique patient card with client-side encryption, ensuring patients maintain complete sovereignty over their medical data while enabling intelligent AI-powered insights and emergency access protocols.

## Glossary

- **ArogyaSutra_System**: The complete Personal Health Record platform including web application, encryption services, AI processing, and authentication mechanisms
- **Patient**: An individual who owns and controls their personal health records within the system
- **Doctor**: A verified medical professional who can view patient records (with permission) and append new medical entries
- **Emergency_Personnel**: Verified medical staff who can access critical patient information during emergencies through the Break-Glass protocol
- **ArogyaSutra_Card**: A physical card issued to each patient containing a unique Patient_ID and serving as the first authentication factor
- **Patient_ID**: A unique identifier printed on the ArogyaSutra_Card used for patient identification
- **Med_Vision**: The AI-powered OCR and NLP subsystem that extracts structured clinical data from photos of medical documents
- **Health_Timeline**: The chronological, structured digital record of all patient medical events and documents
- **Zero_Knowledge_Encryption**: Client-side encryption using Web Crypto API where data is encrypted on the user's device and the platform operator cannot access plaintext
- **Break_Glass_Protocol**: Emergency access mechanism allowing verified Emergency_Personnel to access critical patient data with mandatory logging
- **RAG_Assistant**: Retrieval-Augmented Generation AI system that answers natural language queries about patient history with source citations
- **Append_Only_Mode**: Doctor access mode where medical professionals can add new entries but cannot modify or delete existing patient history
- **Master_Key**: The cryptographic key derived from patient credentials used to encrypt and decrypt health records
- **Emergency_Data**: Critical medical information (allergies, blood group, chronic conditions) accessible through Break_Glass_Protocol
- **OTP**: One-Time Password sent to patient's registered mobile number for authentication
- **Geolocation_Log**: Mandatory location record captured when Emergency_Personnel access patient data
- **Clinical_Data**: Structured medical information extracted from documents including diagnoses, medications, lab values, and vital signs
- **PWA**: Progressive Web App architecture enabling offline functionality and app-like experience without store downloads

## Requirements

### Requirement 1: Patient Registration and Card Issuance

**User Story:** As a new patient, I want to register for ArogyaSutra and receive a physical card with my unique ID, so that I can start building my digital health record with secure authentication.

#### Acceptance Criteria

1. WHEN a patient completes registration with personal details and mobile number, THE ArogyaSutra_System SHALL generate a unique Patient_ID
2. WHEN a Patient_ID is generated, THE ArogyaSutra_System SHALL ensure it is globally unique across all patients
3. WHEN registration is complete, THE ArogyaSutra_System SHALL initiate physical ArogyaSutra_Card production with the Patient_ID
4. WHEN a patient provides their date of birth during registration, THE ArogyaSutra_System SHALL store it securely for authentication purposes
5. WHEN a patient provides a mobile number, THE ArogyaSutra_System SHALL verify it through OTP before completing registration
6. THE ArogyaSutra_System SHALL create an initial empty Health_Timeline for each new patient

### Requirement 2: Zero-Knowledge Encryption and Data Sovereignty

**User Story:** As a patient, I want my medical data encrypted on my device before it reaches the server, so that only I can access my health information and the platform operator cannot read it.

#### Acceptance Criteria

1. WHEN a patient first logs in, THE ArogyaSutra_System SHALL derive a Master_Key from patient credentials using Web Crypto API on the client device
2. WHEN a patient uploads or creates health data, THE ArogyaSutra_System SHALL encrypt it client-side using the Master_Key before transmission
3. WHEN encrypted data is stored on servers, THE ArogyaSutra_System SHALL maintain it in encrypted form without access to decryption keys
4. WHEN a patient retrieves their health data, THE ArogyaSutra_System SHALL decrypt it client-side using the Master_Key
5. THE ArogyaSutra_System SHALL NOT store the Master_Key or any decryption keys on the server
6. WHEN a patient changes their authentication credentials, THE ArogyaSutra_System SHALL re-encrypt all health data with a new Master_Key

### Requirement 3: Triple-Layer Authentication

**User Story:** As a patient, I want multi-factor authentication using my physical card, date of birth, and OTP, so that my health records are protected from unauthorized access.

#### Acceptance Criteria

1. WHEN a patient attempts to log in, THE ArogyaSutra_System SHALL require the Patient_ID from their ArogyaSutra_Card
2. WHEN a Patient_ID is provided, THE ArogyaSutra_System SHALL require the patient's date of birth as the second factor
3. WHEN Patient_ID and date of birth are validated, THE ArogyaSutra_System SHALL send an OTP to the registered mobile number
4. WHEN an OTP is generated, THE ArogyaSutra_System SHALL expire it within 5 minutes
5. WHEN all three authentication factors are successfully verified, THE ArogyaSutra_System SHALL grant access to the patient's Health_Timeline
6. WHEN any authentication factor fails, THE ArogyaSutra_System SHALL reject the login attempt and log the failure
7. WHEN three consecutive failed login attempts occur, THE ArogyaSutra_System SHALL temporarily lock the account and notify the patient

### Requirement 4: AI-Powered Document Digitization (Med-Vision)

**User Story:** As a patient, I want to photograph my paper prescriptions and lab reports and have the system automatically extract medical information, so that I don't have to manually type clinical data.

#### Acceptance Criteria

1. WHEN a patient uploads a photo of a medical document, THE Med_Vision SHALL process it using OCR to extract text
2. WHEN text is extracted from a document, THE Med_Vision SHALL apply NLP to identify Clinical_Data including medications, diagnoses, lab values, and vital signs
3. WHEN Clinical_Data is identified, THE Med_Vision SHALL structure it into standardized fields for the Health_Timeline
4. WHEN handwritten text is present, THE Med_Vision SHALL attempt to recognize and extract it with confidence scoring
5. WHEN extraction confidence is below 70 percent, THE Med_Vision SHALL flag the data for patient review and manual correction
6. WHEN a document contains multiple data types, THE Med_Vision SHALL categorize each element appropriately
7. THE Med_Vision SHALL preserve the original document photo alongside extracted Clinical_Data
8. WHEN processing fails, THE Med_Vision SHALL return a descriptive error message and allow manual data entry

### Requirement 5: Unified Health Timeline

**User Story:** As a patient, I want all my medical records organized chronologically in a single timeline, so that I can easily track my health history and share it with doctors.

#### Acceptance Criteria

1. WHEN Clinical_Data is extracted or manually entered, THE ArogyaSutra_System SHALL add it to the patient's Health_Timeline with a timestamp
2. WHEN displaying the Health_Timeline, THE ArogyaSutra_System SHALL order all entries chronologically from newest to oldest
3. WHEN a patient views their Health_Timeline, THE ArogyaSutra_System SHALL display entry type, date, and key clinical information
4. WHEN a patient selects a timeline entry, THE ArogyaSutra_System SHALL display full details and original document photos
5. THE ArogyaSutra_System SHALL support filtering the Health_Timeline by date range, document type, and clinical category
6. THE ArogyaSutra_System SHALL support searching the Health_Timeline by medication name, diagnosis, or doctor name
7. WHEN multiple entries exist for the same date, THE ArogyaSutra_System SHALL group them together in the timeline view

### Requirement 6: Break-Glass Emergency Protocol

**User Story:** As emergency personnel, I want to access critical patient information during medical emergencies even without the patient's explicit permission, so that I can provide appropriate life-saving care.

#### Acceptance Criteria

1. WHEN Emergency_Personnel initiate Break_Glass_Protocol, THE ArogyaSutra_System SHALL require verified medical credentials
2. WHEN Break_Glass_Protocol is activated, THE ArogyaSutra_System SHALL capture and store the Emergency_Personnel's geolocation
3. WHEN Break_Glass_Protocol is activated, THE ArogyaSutra_System SHALL grant access only to Emergency_Data including allergies, blood group, and chronic conditions
4. WHEN Break_Glass_Protocol is used, THE ArogyaSutra_System SHALL create a detailed audit log including timestamp, personnel identity, and geolocation
5. WHEN Break_Glass_Protocol is activated, THE ArogyaSutra_System SHALL send an immediate notification to the patient's registered mobile number
6. THE ArogyaSutra_System SHALL NOT allow Emergency_Personnel to modify or delete patient data through Break_Glass_Protocol
7. WHEN Break_Glass_Protocol access expires after 24 hours, THE ArogyaSutra_System SHALL automatically revoke Emergency_Personnel access

### Requirement 7: Doctor Access and Append-Only Mode

**User Story:** As a doctor, I want to view my patient's complete medical history and add new entries after consultation, so that I can provide informed care and maintain continuity of records.

#### Acceptance Criteria

1. WHEN a patient grants access to a Doctor, THE ArogyaSutra_System SHALL allow the Doctor to view the complete Health_Timeline
2. WHEN a Doctor views patient records, THE ArogyaSutra_System SHALL decrypt data using patient-authorized access keys
3. WHEN a Doctor adds a new entry, THE ArogyaSutra_System SHALL append it to the Health_Timeline with the Doctor's identity and timestamp
4. WHERE Append_Only_Mode is enabled, THE ArogyaSutra_System SHALL prevent Doctors from modifying existing Health_Timeline entries
5. WHERE Append_Only_Mode is enabled, THE ArogyaSutra_System SHALL prevent Doctors from deleting existing Health_Timeline entries
6. WHEN a Doctor attempts unauthorized modification, THE ArogyaSutra_System SHALL reject the action and log the attempt
7. WHEN a patient revokes Doctor access, THE ArogyaSutra_System SHALL immediately prevent that Doctor from viewing the Health_Timeline

### Requirement 8: RAG-Powered Clinical Assistant

**User Story:** As a doctor, I want to ask natural language questions about a patient's medical history and get answers with source citations, so that I can quickly find relevant information during consultations.

#### Acceptance Criteria

1. WHEN a Doctor submits a natural language query about patient history, THE RAG_Assistant SHALL process it to identify relevant medical concepts
2. WHEN processing a query, THE RAG_Assistant SHALL search the patient's Health_Timeline for relevant Clinical_Data
3. WHEN generating a response, THE RAG_Assistant SHALL cite specific source documents and timeline entries
4. WHEN multiple relevant entries exist, THE RAG_Assistant SHALL synthesize information across documents while maintaining source attribution
5. WHEN no relevant information is found, THE RAG_Assistant SHALL clearly state that the information is not available in the patient's records
6. THE RAG_Assistant SHALL only access data that the Doctor is authorized to view
7. WHEN a query is ambiguous, THE RAG_Assistant SHALL ask clarifying questions before searching

### Requirement 9: Progressive Web App Architecture

**User Story:** As a patient in a low-bandwidth area, I want to access my medical records offline and have the app work smoothly without downloading from an app store, so that I can use ArogyaSutra regardless of connectivity.

#### Acceptance Criteria

1. WHEN a patient first visits the ArogyaSutra web application, THE PWA SHALL cache essential resources for offline use
2. WHEN a patient loses internet connectivity, THE PWA SHALL continue to function with cached data
3. WHEN offline, THE PWA SHALL allow patients to view previously loaded Health_Timeline entries
4. WHEN offline, THE PWA SHALL allow patients to capture and queue new document photos for upload when connectivity returns
5. WHEN connectivity is restored, THE PWA SHALL automatically sync queued uploads to the server
6. THE PWA SHALL display a clear indicator of online/offline status to the patient
7. WHEN bandwidth is limited, THE PWA SHALL optimize image loading and data transfer to minimize data usage
8. THE PWA SHALL be installable on mobile devices without requiring app store downloads

### Requirement 10: Patient Data Export and Portability

**User Story:** As a patient, I want to export my complete medical history in standard formats, so that I can share it with healthcare providers or migrate to other systems if needed.

#### Acceptance Criteria

1. WHEN a patient requests data export, THE ArogyaSutra_System SHALL generate a complete archive of their Health_Timeline
2. WHEN exporting data, THE ArogyaSutra_System SHALL include all Clinical_Data in structured format
3. WHEN exporting data, THE ArogyaSutra_System SHALL include all original document photos
4. THE ArogyaSutra_System SHALL support export in PDF format for human readability
5. THE ArogyaSutra_System SHALL support export in JSON format for machine readability and interoperability
6. WHEN generating exports, THE ArogyaSutra_System SHALL decrypt all data client-side before including it in the export
7. WHEN an export is complete, THE ArogyaSutra_System SHALL provide a secure download link valid for 24 hours

### Requirement 11: Emergency Data Configuration

**User Story:** As a patient, I want to designate which critical information is accessible during emergencies, so that emergency personnel can access life-saving information while protecting my privacy.

#### Acceptance Criteria

1. WHEN a patient configures Emergency_Data, THE ArogyaSutra_System SHALL allow selection of allergies, blood group, chronic conditions, and emergency contacts
2. WHEN Emergency_Data is configured, THE ArogyaSutra_System SHALL store it with special encryption allowing Break_Glass_Protocol access
3. WHEN a patient updates Emergency_Data, THE ArogyaSutra_System SHALL immediately reflect changes in Break_Glass_Protocol access
4. THE ArogyaSutra_System SHALL display a clear summary of what information is accessible through Break_Glass_Protocol
5. WHEN Emergency_Data is not configured, THE ArogyaSutra_System SHALL prompt patients to set it up during onboarding
6. THE ArogyaSutra_System SHALL allow patients to update Emergency_Data at any time

### Requirement 12: Audit Logging and Access Transparency

**User Story:** As a patient, I want to see a complete log of who accessed my medical records and when, so that I can monitor for unauthorized access and maintain trust in the system.

#### Acceptance Criteria

1. WHEN any user accesses a patient's Health_Timeline, THE ArogyaSutra_System SHALL create an audit log entry with timestamp and user identity
2. WHEN a Doctor views patient records, THE ArogyaSutra_System SHALL log the access with Doctor identity and timestamp
3. WHEN Break_Glass_Protocol is used, THE ArogyaSutra_System SHALL log Emergency_Personnel identity, timestamp, and geolocation
4. WHEN a patient views their audit log, THE ArogyaSutra_System SHALL display all access events in chronological order
5. THE ArogyaSutra_System SHALL retain audit logs for a minimum of 7 years
6. WHEN suspicious access patterns are detected, THE ArogyaSutra_System SHALL alert the patient
7. THE ArogyaSutra_System SHALL prevent modification or deletion of audit log entries

### Requirement 13: Doctor Verification and Credentialing

**User Story:** As a system administrator, I want to verify doctor credentials before granting them access to patient records, so that only legitimate medical professionals can use the platform.

#### Acceptance Criteria

1. WHEN a Doctor registers, THE ArogyaSutra_System SHALL require medical license number and registration details
2. WHEN Doctor credentials are submitted, THE ArogyaSutra_System SHALL verify them against official medical council databases
3. WHEN verification is successful, THE ArogyaSutra_System SHALL activate the Doctor account
4. WHEN verification fails, THE ArogyaSutra_System SHALL reject the registration and provide a reason
5. THE ArogyaSutra_System SHALL periodically re-verify Doctor credentials to ensure licenses remain valid
6. WHEN a Doctor's license expires or is revoked, THE ArogyaSutra_System SHALL immediately suspend their account and revoke all patient access

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

1. WHEN a patient's data changes, THE ArogyaSutra_System SHALL automatically create encrypted backups on the server
2. WHEN a patient loses access to their Master_Key, THE ArogyaSutra_System SHALL provide a recovery mechanism using verified identity and security questions
3. WHEN account recovery is initiated, THE ArogyaSutra_System SHALL require multiple verification factors including registered mobile number and government ID
4. WHEN recovery is successful, THE ArogyaSutra_System SHALL allow the patient to set new credentials and derive a new Master_Key
5. THE ArogyaSutra_System SHALL maintain encrypted backups for a minimum of 10 years
6. WHEN a patient deletes their account, THE ArogyaSutra_System SHALL securely delete all backups after a 90-day grace period

