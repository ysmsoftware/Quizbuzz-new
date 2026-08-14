# Messaging Templates Audit Report: Email vs. WhatsApp Channels

This document presents a comprehensive audit of all messaging templates implemented within the QuizBuzz application. It analyzes template support across the two primary communication channels—**Email** (handled via Nodemailer/SMTP with branded HTML layouts) and **WhatsApp** (handled via Aisensy API with Meta campaign templates).

---

## 1. Executive Summary & Overview

- **Total Enum Definitions (`MessageTemplate`)**: 20 template keys
- **Email Channel Support**: 19 templates implemented in [email.templates.ts](file:///Users/austinmakasare/Desktop/YSM/Quizbuzz-new/backend/src/templates/email.templates.ts)
- **WhatsApp Channel Support**: 7 templates implemented in [whatsapp.templates.ts](file:///Users/austinmakasare/Desktop/YSM/Quizbuzz-new/backend/src/templates/whatsapp.templates.ts)
- **Templates Available in BOTH Channels**: 6 templates
- **Templates Available JUST in Email**: 13 templates
- **Templates Available JUST in WhatsApp**: 1 template (`PAYMENT_CONFIRMATION_MESSAGE`)

---

## 2. High-Level Template Distribution Matrix

| Enum Key                            | Template / Campaign Name                                             | Email | WhatsApp | Scope Requirement | Target Audience         |
| :---------------------------------- | :------------------------------------------------------------------- | :---: | :------: | :---------------- | :---------------------- |
| `OTP_VERIFICATION_CODE`           | `Your OTP for YSM Info Solution` / `otp verification code`       |  ✅  |    ✅    | Contact-Only      | End User / General      |
| `BIRTHDAY_WISHES_YSM`             | `Happy Birthday from YSM Info Solution!` / `birthday_wishes_ysm` |  ✅  |    ✅    | Contact-Only      | All Contacts / End User |
| `FEEDBACK_COLLECTION_MESSAGE`     | `We Value Your Feedback` / `feedback_collection_message`         |  ✅  |    ✅    | Event-Required    | Participant             |
| `CERTIFICATE_ISSUED`              | `Certificate Issued` / `certificate_issued`                      |  ✅  |    ✅    | Event-Required    | Participant             |
| `REGISTRATION_SUCCESSFUL`         | `Registration Successful` / `registration_successful`            |  ✅  |    ✅    | Event-Required    | Participant             |
| `WORKSHOP_REMINDER_MESSAGE`       | `Reminder: Event Coming Up` / `workshop_reminder_message`        |  ✅  |    ✅    | Event-Required    | Participant             |
| `PAYMENT_CONFIRMATION_MESSAGE`    | `payment_confirmation_message`                                     |  ❌  |    ✅    | Event-Required    | End User / Participant  |
| `PAYOUT_TRANSFER_CONFIRMATION`    | `Payout transferred`                                               |  ✅  |    ❌    | Contact-Only      | Org Admin / Host        |
| `EMAIL_VERIFICATION`              | `Verify your email — QuizBuzz`                                    |  ✅  |    ❌    | Contact-Only      | End User / Admin        |
| `PASSWORD_RESET`                  | `Reset your password — QuizBuzz`                                  |  ✅  |    ❌    | Contact-Only      | End User / Admin        |
| `ORG_INVITE`                      | `You've been invited to join...`                                   |  ✅  |    ❌    | Contact-Only      | Org Member / Staff      |
| `ADMIN_EMAIL_OTP`                 | `Verification code`                                                |  ✅  |    ❌    | Contact-Only      | Admin                   |
| `DISQUALIFICATION_NOTICE`         | `Disqualification Notice`                                          |  ✅  |    ❌    | Event-Required    | Participant             |
| `RESULTS_PUBLISHED`               | `Results are out!`                                                 |  ✅  |    ❌    | Event-Required    | Participant             |
| `CONTEST_RESCHEDULED`             | `Rescheduled: Contest`                                             |  ✅  |    ❌    | Event-Required    | Participant             |
| `CONTEST_CANCELLED`               | `Cancelled: Contest`                                               |  ✅  |    ❌    | Event-Required    | Participant             |
| `AMBASSADOR_APPLICATION_RECEIVED` | `Ambassador application received`                                  |  ✅  |    ❌    | Contact-Only      | Ambassador Applicant    |
| `AMBASSADOR_APPLICATION_APPROVED` | `Approved as an ambassador`                                        |  ✅  |    ❌    | Contact-Only      | Ambassador              |
| `AMBASSADOR_APPLICATION_REJECTED` | `Update on your ambassador application`                            |  ✅  |    ❌    | Contact-Only      | Ambassador Applicant    |
| `CUSTOM`                          | Ad-hoc Broadcast                                                     |  ✅  |    ❌    | Event/Contact     | General / All           |

---

## 3. Channel Comparison & Gap Analysis

### 3.1. Templates Supported in BOTH Email & WhatsApp (6 Templates)

These represent core transactional and engagement messaging workflows where multi-channel reach is essential:

1. **`OTP_VERIFICATION_CODE`**: Instant verification code for identity validation.
2. **`BIRTHDAY_WISHES_YSM`**: Automated birthday greetings.
3. **`FEEDBACK_COLLECTION_MESSAGE`**: Post-event feedback & review solicitation.
4. **`CERTIFICATE_ISSUED`**: Certificate download notification.
5. **`REGISTRATION_SUCCESSFUL`**: Post-registration confirmation with date, time, join code, and link.
6. **`WORKSHOP_REMINDER_MESSAGE`**: Pre-event / pre-contest reminder notification.

### 3.2. Templates Supported JUST in Email (13 Templates)

Email is the exclusive channel for complex, security-sensitive, administrative, financial, and ambassador management workflows:

- **System Auth & Security**: `EMAIL_VERIFICATION`, `PASSWORD_RESET`, `ADMIN_EMAIL_OTP`.
- **Organization Management & Finance**: `ORG_INVITE`, `PAYOUT_TRANSFER_CONFIRMATION` (includes itemized financial breakdown tables).
- **Contest Lifecycle Management**: `DISQUALIFICATION_NOTICE`, `RESULTS_PUBLISHED`, `CONTEST_RESCHEDULED`, `CONTEST_CANCELLED`.
- **Ambassador Program Lifecycle**: `AMBASSADOR_APPLICATION_RECEIVED`, `AMBASSADOR_APPLICATION_APPROVED`, `AMBASSADOR_APPLICATION_REJECTED`.
- **Custom Messaging**: `CUSTOM` (Ad-hoc rich email announcements).

### 3.3. Templates Supported JUST in WhatsApp (1 Template)

- **`PAYMENT_CONFIRMATION_MESSAGE`**: Implemented in [whatsapp.templates.ts](file:///Users/austinmakasare/Desktop/YSM/Quizbuzz-new/backend/src/templates/whatsapp.templates.ts) but currently **missing** in [email.templates.ts](file:///Users/austinmakasare/Desktop/YSM/Quizbuzz-new/backend/src/templates/email.templates.ts).

### 3.4. Key Operational Differences

- **Formatting Capabilities**: Email templates utilize a modular HTML layout engine ([email-layout.ts](file:///Users/austinmakasare/Desktop/YSM/Quizbuzz-new/backend/src/templates/email-layout.ts)) supporting tables, callouts, branded buttons, and badges. WhatsApp templates consist of plain parameter arrays mapped to pre-registered Meta/Aisensy campaign names.
- **Delivery Scope**: Contact-only templates can be dispatched directly to user profiles, while Event-required templates require active contest/workshop context (`eventName`, `date`, `time`, `link`, etc.).

---

## 4. Detailed Template Inventory & Categorization

Below is the complete audit of every template defined in the system.

### Category A: Core Authentication & User Verification

#### 1. `OTP_VERIFICATION_CODE`

- **Supported Channels**: Both (Email & WhatsApp)
- **Email Subject**: `Your OTP for YSM Info Solution`
- **WhatsApp Campaign**: `otp verification code`
- **Target Audience**: End User / Participant / General
- **Scope**: Contact-Only (`CONTACT_ONLY_TEMPLATES`)
- **Purpose**: Delivers a 6-digit OTP code (valid for 10 minutes) to verify user phone number or email address.
- **Parameters**: `otp`, `name`
- **Trigger Context**: User registration, login verification, and phone/email validation.

#### 2. `EMAIL_VERIFICATION`

- **Supported Channels**: Email Only
- **Email Subject**: `Verify your email — QuizBuzz`
- **WhatsApp Campaign**: N/A
- **Target Audience**: End User / Organization Admin
- **Scope**: Contact-Only (`CONTACT_ONLY_TEMPLATES`)
- **Purpose**: Sends an email verification link (valid for 24 hours) to verify email ownership upon account creation.
- **Parameters**: `name`, `verificationLink`
- **Trigger Context**: Onboarding flow and email address modification.

#### 3. `PASSWORD_RESET`

- **Supported Channels**: Email Only
- **Email Subject**: `Reset your password — QuizBuzz`
- **WhatsApp Campaign**: N/A
- **Target Audience**: End User / Organization Admin / All Users
- **Scope**: Contact-Only (`CONTACT_ONLY_TEMPLATES`)
- **Purpose**: Provides a secure password reset link expiring in 15 minutes.
- **Parameters**: `name`, `resetLink`
- **Trigger Context**: "Forgot Password" requests from auth screens.

#### 4. `ADMIN_EMAIL_OTP`

- **Supported Channels**: Email Only
- **Email Subject**: `${params.otp} is your QuizBuzz verification code`
- **WhatsApp Campaign**: N/A
- **Target Audience**: Admin / System User
- **Scope**: Contact-Only (`CONTACT_ONLY_TEMPLATES`)
- **Purpose**: Delivers a high-security 15-minute OTP code for administrative authentication and sensitive admin actions.
- **Parameters**: `name`, `otp`
- **Trigger Context**: Admin dashboard login and privilege elevation.

---

### Category B: Event & Contest Participation Lifecycle

#### 5. `REGISTRATION_SUCCESSFUL`

- **Supported Channels**: Both (Email & WhatsApp)
- **Email Subject**: `Registration Successful - ${params.eventName}`
- **WhatsApp Campaign**: `registration_successful`
- **Target Audience**: Participant / End User
- **Scope**: Event-Required (`EVENT_REQUIRED_TEMPLATES`)
- **Purpose**: Confirms contest or workshop enrollment, delivering key schedule details (date, time, join code, and link).
- **Parameters**: `name`, `eventName`, `date`, `time`, `link`, `joinCode`
- **Trigger Context**: Immediate dispatch upon successful contest registration or payment completion.

#### 6. `WORKSHOP_REMINDER_MESSAGE`

- **Supported Channels**: Both (Email & WhatsApp)
- **Email Subject**: `Reminder: ${params.eventName} is Coming Up!`
- **WhatsApp Campaign**: `workshop_reminder_message`
- **Target Audience**: Participant / End User
- **Scope**: Event-Required (`EVENT_REQUIRED_TEMPLATES`)
- **Purpose**: Reminds registered participants about an upcoming contest or workshop session shortly before start time.
- **Parameters**: `name`, `eventName`, `date`, `time`, `link`, `joinCode` (optional in email)
- **Trigger Context**: Quiz scheduler background worker / automated reminder cron jobs.

#### 7. `PAYMENT_CONFIRMATION_MESSAGE`

- **Supported Channels**: WhatsApp Only *(Missing Email implementation)*
- **Email Subject**: N/A
- **WhatsApp Campaign**: `payment_confirmation_message`
- **Target Audience**: End User / Participant / Customer
- **Scope**: Event-Required (`EVENT_REQUIRED_TEMPLATES`)
- **Purpose**: Confirms successful payment for a paid contest/workshop registration via WhatsApp.
- **Parameters**: `name`, `amount`, `eventName`
- **Trigger Context**: Payment gateway webhook execution upon successful transaction.

#### 8. `CERTIFICATE_ISSUED`

- **Supported Channels**: Both (Email & WhatsApp)
- **Email Subject**: `Certificate Issued - ${params.eventName}`
- **WhatsApp Campaign**: `certificate_issued`
- **Target Audience**: Participant / End User
- **Scope**: Event-Required (`EVENT_REQUIRED_TEMPLATES`)
- **Purpose**: Notifies participants that their achievement or participation certificate is available for download.
- **Parameters**: `name`, `eventName`, `link`
- **Trigger Context**: Certificate generation pipeline completion.

#### 9. `FEEDBACK_COLLECTION_MESSAGE`

- **Supported Channels**: Both (Email & WhatsApp)
- **Email Subject**: `We Value Your Feedback - ${params.name}`
- **WhatsApp Campaign**: `feedback_collection_message`
- **Target Audience**: Participant / End User
- **Scope**: Event-Required (`EVENT_REQUIRED_TEMPLATES`)
- **Purpose**: Requests participant feedback and review links following event conclusion.
- **Parameters**: `name`, `eventName`
- **Trigger Context**: Post-contest evaluation and review campaign workflows.

#### 10. `RESULTS_PUBLISHED`

- **Supported Channels**: Email Only
- **Email Subject**: `Results are out! — ${params.eventName}`
- **WhatsApp Campaign**: N/A
- **Target Audience**: Participant / End User
- **Scope**: Event-Required (`EVENT_REQUIRED_TEMPLATES`)
- **Purpose**: Alerts participants that final contest rankings, scores, and leaderboards are published.
- **Parameters**: `name`, `eventName`, `link`
- **Trigger Context**: Organizer publishing contest results from the dashboard.

#### 11. `DISQUALIFICATION_NOTICE`

- **Supported Channels**: Email Only
- **Email Subject**: `Disqualification Notice — ${params.eventName}`
- **WhatsApp Campaign**: N/A
- **Target Audience**: Participant / End User
- **Scope**: Event-Required (`EVENT_REQUIRED_TEMPLATES`)
- **Purpose**: Formally notifies a participant of their disqualification from a contest along with specific reasons (e.g. proctoring violations).
- **Parameters**: `name`, `eventName`, `reason`
- **Trigger Context**: Manual disqualification by organizer or automatic proctoring flag threshold.

#### 12. `CONTEST_RESCHEDULED`

- **Supported Channels**: Email Only
- **Email Subject**: `Rescheduled: ${params.eventName} is now on ${params.date}`
- **WhatsApp Campaign**: N/A
- **Target Audience**: Participant / End User
- **Scope**: Event-Required (`EVENT_REQUIRED_TEMPLATES`)
- **Purpose**: Notifies enrolled participants of updated contest date, time, previous schedule, and reason for change.
- **Parameters**: `name`, `eventName`, `date`, `time`, `previousDate`, `reason`, `link`
- **Trigger Context**: Organizer modifying contest schedule settings.

#### 13. `CONTEST_CANCELLED`

- **Supported Channels**: Email Only
- **Email Subject**: `Cancelled: ${params.eventName}`
- **WhatsApp Campaign**: N/A
- **Target Audience**: Participant / End User
- **Scope**: Event-Required (`EVENT_REQUIRED_TEMPLATES`)
- **Purpose**: Informs registered participants about contest cancellation and reason.
- **Parameters**: `name`, `eventName`, `date`, `time`, `reason`
- **Trigger Context**: Organizer cancelling a contest.

---

### Category C: Organization, Financial & Team Management

#### 14. `ORG_INVITE`

- **Supported Channels**: Email Only
- **Email Subject**: `You've been invited to join ${params.orgName} on QuizBuzz`
- **WhatsApp Campaign**: N/A
- **Target Audience**: Organization Member / Co-admin / Staff
- **Scope**: Contact-Only (`CONTACT_ONLY_TEMPLATES`)
- **Purpose**: Invites team members to join an organization account (invite link expires in 3 days).
- **Parameters**: `name`, `orgName`, `inviteLink`
- **Trigger Context**: Organization team management dashboard invite flow.

#### 15. `PAYOUT_TRANSFER_CONFIRMATION`

- **Supported Channels**: Email Only
- **Email Subject**: `Payout transferred — ${params.transferAmount} credited to your account`
- **WhatsApp Campaign**: N/A
- **Target Audience**: Organization Admin / Organizer / Host
- **Scope**: Contact-Only (`CONTACT_ONLY_TEMPLATES`)
- **Purpose**: Provides an itemized accounting ledger breakdown of contest ticket sales revenue, platform commission, gateway fees, GST, total deductions, and net payout transferred.
- **Parameters**: `name`, `grossAmount`, `commissionPercent`, `commissionAmount`, `gatewayFeePercent`, `gatewayFeeAmount`, `gstPercent`, `gstAmount`, `totalDeducted`, `transferAmount`, `transferId`
- **Trigger Context**: Automated payout execution via payment processor / Razorpay Route.

---

### Category D: Ambassador Program Lifecycle

#### 16. `AMBASSADOR_APPLICATION_RECEIVED`

- **Supported Channels**: Email Only
- **Email Subject**: `We've received your ambassador application — ${params.orgName}`
- **WhatsApp Campaign**: N/A
- **Target Audience**: Ambassador Applicant / End User
- **Scope**: Contact-Only (`CONTACT_ONLY_TEMPLATES`)
- **Purpose**: Acknowledges receipt of a campus/brand ambassador application under review.
- **Parameters**: `name`, `orgName`
- **Trigger Context**: Ambassador application form submission.

#### 17. `AMBASSADOR_APPLICATION_APPROVED`

- **Supported Channels**: Email Only
- **Email Subject**: `You're approved as an ambassador — ${params.orgName}`
- **WhatsApp Campaign**: N/A
- **Target Audience**: Ambassador / End User
- **Scope**: Contact-Only (`CONTACT_ONLY_TEMPLATES`)
- **Purpose**: Congratulates approved applicant and provides direct dashboard access link.
- **Parameters**: `name`, `orgName`, `link`
- **Trigger Context**: Organization admin approving ambassador application.

#### 18. `AMBASSADOR_APPLICATION_REJECTED`

- **Supported Channels**: Email Only
- **Email Subject**: `Update on your ambassador application — ${params.orgName}`
- **WhatsApp Campaign**: N/A
- **Target Audience**: Ambassador Applicant / End User
- **Scope**: Contact-Only (`CONTACT_ONLY_TEMPLATES`)
- **Purpose**: Informs applicant that their ambassador application was not approved, citing specific reason.
- **Parameters**: `name`, `orgName`, `reason`
- **Trigger Context**: Organization admin rejecting ambassador application.

---

### Category E: Customer Engagement & Announcements

#### 19. `BIRTHDAY_WISHES_YSM`

- **Supported Channels**: Both (Email & WhatsApp)
- **Email Subject**: `Happy Birthday from YSM Info Solution! 🎂`
- **WhatsApp Campaign**: `birthday_wishes_ysm`
- **Target Audience**: All Contacts / End User / General
- **Scope**: Contact-Only (`CONTACT_ONLY_TEMPLATES`)
- **Purpose**: Sends birthday wishes and celebratory greetings to registered contacts.
- **Parameters**: `name`
- **Trigger Context**: Daily automated birthday cron job.

#### 20. `CUSTOM`

- **Supported Channels**: Email Only
- **Email Subject**: Dynamic (`params.subject` or `Notification from YSM Info Solution`)
- **WhatsApp Campaign**: N/A
- **Target Audience**: General / All / Selected Contacts
- **Scope**: Dynamic (Event or Contact)
- **Purpose**: Allows organizers to send custom announcements or broadcast messages with arbitrary subject and body text.
- **Parameters**: `name`, `subject`, `body`
- **Trigger Context**: Messaging tab custom broadcast tool.

---

## 5. Audit Conclusions & Recommended Actions

1. **Implement Email Template for `PAYMENT_CONFIRMATION_MESSAGE`**:

   - Currently, `PAYMENT_CONFIRMATION_MESSAGE` exists in WhatsApp templates but throws an error if sent via Email because it is missing from `EmailTemplates` in `email.templates.ts`. Adding an email builder will eliminate single-channel vulnerability for payment receipts.
2. **Expand High-Priority WhatsApp Templates**:

   - Critical participant notifications such as `RESULTS_PUBLISHED`, `CONTEST_RESCHEDULED`, and `DISQUALIFICATION_NOTICE` currently exist only on Email. Registering corresponding Meta/Aisensy WhatsApp campaign templates will significantly increase participant engagement and open rates.
3. **Template Resolver Safeguards**:

   - Maintain runtime guards in `MessageTemplateResolver` so that attempting to dispatch an Email-only template via WhatsApp provides clear error messaging rather than silent failures.
