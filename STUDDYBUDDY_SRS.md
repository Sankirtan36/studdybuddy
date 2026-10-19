# STUDDYBUDDY — SOFTWARE REQUIREMENTS SPECIFICATION (SRS)

**Document Version:** 1.0  
**Status:** Final Requirements Baseline  
**Product Name:** StuddyBuddy  
**Initial Target Institution:** Parul University, Gujarat, India  
**Primary Region:** India  
**Frontend Framework:** Astro.js  
**Programming Language:** TypeScript  
**Styling:** Tailwind CSS  
**Database:** MongoDB Atlas  
**File Storage:** Cloudflare R2 or compatible S3 object storage  
**Deployment:** Vercel using the official Astro adapter  
**Document Purpose:** Single source of truth for AI coding agents, developers, testers, and project maintainers.

---

# 1. Project Overview

## 1.1 Introduction

StuddyBuddy is a multi-university academic resource-sharing platform where students can discover, access, download, organize, and contribute academic materials.

The platform will initially focus on Parul University and will be designed so that additional universities, colleges, faculties, programs, academic terms, and subjects can be added without restructuring the entire application.

StuddyBuddy should make academic resources easy to discover through a structured academic hierarchy and search engine-friendly public pages.

The platform must support both visitors and authenticated users. Visitors should be able to browse and download approved resources without creating an account. Authentication will be required for contributing resources, saving resources, managing a profile, and accessing account-specific features.

The product must prioritize usability, security, accurate academic metadata, SEO, performance, reliable file handling, and transparent administration.

## 1.2 Product Vision

Build a reliable academic knowledge-sharing platform that helps students find the right study material for their university, program, academic term, and subject.

StuddyBuddy should become a searchable academic resource directory rather than merely a file-upload website.

## 1.3 Primary Objectives

1. Provide public access to approved academic resources.
2. Organize resources through a configurable academic hierarchy.
3. Allow authenticated students to contribute and manage their resources.
4. Support resource moderation and catalog suggestions.
5. Provide useful PDF and image-to-PDF utilities.
6. Build a moderated academic community.
7. Give authorized administrators complete operational and content-management tools.
8. Track meaningful platform usage, returning users, resource activity, and storage.
9. Make eligible public academic pages discoverable by search engines.
10. Maintain a secure, scalable, and maintainable architecture.

## 1.4 Non-Goals for the Initial Release

The following are not mandatory for the first production release unless separately approved:

- A complete learning management system.
- Live video classes or video conferencing.
- Online examinations and proctored tests.
- A payment gateway or paid subscriptions.
- AI-generated answers or automatic assignment solving.
- A native Android or iOS application.
- Guaranteed conversion of every Word or PowerPoint file into PDF.
- Automatic verification of every uploaded document's academic authenticity.

These features must not be presented as implemented unless they are actually developed and tested.

---

# 2. Technology Stack and Architecture

## 2.1 Mandatory Technology Stack

| Layer | Technology |
|---|---|
| Web framework | Astro.js |
| Language | TypeScript with strict type checking |
| UI styling | Tailwind CSS |
| Interactive UI | Astro components with framework islands only where needed |
| Database | MongoDB Atlas |
| Database access | Official MongoDB Node.js driver or a compatible maintained ODM |
| Authentication | Secure session-based authentication compatible with Astro |
| Password hashing | Argon2id or an appropriately configured secure password-hashing library |
| Object storage | Cloudflare R2 or compatible S3 object storage |
| Server-side validation | Zod or an equivalent TypeScript validation library |
| Deployment | Vercel with the official Astro adapter |
| Testing | Appropriate unit, integration, and browser-testing tools |
| Version control | Git and GitHub |
| Monitoring | Error logging, uptime monitoring, and application metrics |

### Strict stack rules

- Use **Astro.js**, not Next.js.
- Use **MongoDB Atlas**, not Supabase PostgreSQL.
- Do not use Supabase Auth or Supabase Storage.
- Do not introduce a second database without explicit approval.
- Do not use local disk storage as permanent production file storage.
- Do not expose database credentials, storage secrets, session secrets, or other private environment variables to browser code.
- Do not introduce an unnecessary backend framework if Astro server endpoints and the chosen deployment environment can fulfill the requirement.
- Use maintained packages that are compatible with the selected Node.js runtime and Astro deployment configuration.

The old Next.js and Supabase architecture is superseded by this specification.

## 2.2 Application Architecture

Use a modular architecture with clear separation between:

- Public pages and SEO rendering.
- Interactive user interfaces.
- Server-side endpoints.
- Authentication and authorization.
- Business logic and validation.
- MongoDB repositories and database operations.
- Object-storage operations.
- Moderation and administrative services.
- Analytics and reporting.
- Background or scheduled maintenance jobs.

Use Astro's static rendering where appropriate and server rendering for pages that require current database data, authentication, or dynamic access control.

Astro islands may be used for interactive features such as search filters, upload forms, dashboards, and PDF utilities. Avoid unnecessary client-side JavaScript.

## 2.3 Deployment Compatibility

Before implementing deployment-dependent functionality, verify that the chosen Vercel configuration supports the required Node.js APIs, database connectivity, storage SDK, file processing, and server routes.

Long-running tasks, large file conversions, and scheduled cleanup must not assume that a Vercel request can run indefinitely.

If a background worker or external processing service becomes necessary, document its purpose and deployment requirements. Do not introduce one merely for architectural complexity.

---

# 3. User Roles and Permissions

StuddyBuddy must support the following roles.

## 3.1 Visitor

A visitor is a user who is not logged in.

Visitors can:

- Browse public university, program, academic-term, and subject pages.
- Search for academic resources.
- Filter and sort resources.
- View approved resource details.
- Download approved public resources.
- View published announcements.
- Use public pages and eligible file utilities.
- Access public community content where allowed.

Visitors cannot:

- Upload resources.
- Save resources to an account.
- Edit or delete another user's resources.
- Access private account data.
- Use administrative functionality.

If guest chat is enabled, visitors may participate subject to its restrictions.

## 3.2 Registered User

A registered user can perform visitor actions and additionally:

- Upload academic resources.
- Submit resources for moderation.
- View and manage their own contributions.
- Edit permitted metadata for their own resources.
- Delete or withdraw their own contributions.
- Save and unsave resources.
- Manage their profile.
- View their authenticated download history.
- Participate in authenticated community features.
- Submit catalog suggestions.
- Report inappropriate or incorrect content.

Users cannot approve their own resources, modify other users' content, or bypass moderation.

## 3.3 Moderator

A moderator can perform explicitly assigned moderation tasks, including:

- Review pending resources.
- Approve or reject submissions.
- Remove content when authorized.
- Review user reports.
- Moderate community discussions.
- Record moderation reasons.

A moderator must not automatically receive owner-level access to analytics, roles, system settings, or all user-management functions.

## 3.4 Administrator

An administrator can access the administrative features assigned to their permissions, such as:

- Resource moderation.
- Catalog management.
- User management.
- Community moderation.
- Announcements.
- Storage monitoring.
- Analytics.
- Reports and audit history.

## 3.5 Owner / Super Administrator

The owner role is reserved for the project owner and explicitly authorized personnel.

The owner can manage administrator roles and permissions and access all authorized administrative functions.

**Important:** Never determine ownership or administrative access from a public email address, a client-side role value, a URL, or a hidden UI element.

Initial owner access must be configured securely through a documented server-side setup or bootstrap process. Do not automatically grant the first person who signs up unrestricted access.

All role and permission checks must be enforced on the server.

---

# 4. Academic Catalog Structure

## 4.1 Required Hierarchy

The platform must support the following logical structure:

**University → Faculty / Department → Program / Course → Academic Term → Subject → Resource**

A university may have multiple faculties or departments. Each faculty or department may contain multiple programs. Programs contain configurable academic terms and subjects.

The data model must accommodate universities that organize their academic offerings differently.

Academic terms must not be hardcoded to eight semesters. Some programs may use semesters, years, trimesters, or another approved structure.

## 4.2 Initial Academic Groups

The initial Parul University catalog should support these 20 proposed academic groups:

1. Engineering & Technology
2. IT & Computer Science
3. Management Studies
4. Medicine
5. Ayurved
6. Homeopathy
7. Pharmacy
8. Physiotherapy
9. Nursing
10. Applied Sciences
11. Design / PID
12. Fine Arts & Performing Arts
13. Commerce
14. Hotel Management & Catering Technology
15. Law
16. Social Work
17. Arts & Liberal Arts
18. Agriculture
19. Library & Information Science
20. Architecture & Planning

These are initial catalog categories, not a guarantee that every label corresponds to an official Parul University faculty or department.

Before publishing the catalog, verify official university names and available programs. Do not fabricate programs, subjects, course codes, academic terms, or affiliations.

Administrators must be able to add, rename, merge, deactivate, and reorganize catalog records while preserving existing resource relationships.

## 4.3 Catalog Fields

### University

- Unique ID.
- Official name.
- Slug.
- Location and optional address.
- Logo, if available and authorized.
- Website URL, if verified.
- Description.
- Active/inactive status.
- Created and updated timestamps.

### Faculty / Department

- Unique ID.
- University ID.
- Name and slug.
- Description, where available.
- Active/inactive status.

### Program

- Unique ID.
- University ID.
- Faculty or department ID.
- Program name.
- Slug.
- Optional official course code.
- Academic structure type.
- Configurable academic duration or term list.
- Active/inactive status.

### Academic Term

- Unique ID.
- Program ID.
- Display name, such as Semester 1, Semester 2, or Year 1.
- Optional ordering number.
- Active/inactive status.

### Subject

- Unique ID.
- Program ID.
- Academic-term ID.
- Subject name.
- Slug.
- Optional verified subject code.
- Description, where available.
- Active/inactive status.

Use stable IDs for relationships. Slugs are for URLs and presentation, not the sole basis for database relationships.

## 4.4 Missing Catalog Entries

If a user cannot find a university, faculty, program, academic term, or subject, provide a **Suggest Missing Information** flow.

A suggestion must include:

- Suggested entity type.
- Existing parent entity, if applicable.
- Proposed name.
- Optional official code or reference URL.
- Optional explanation.
- Submitter ID when authenticated.
- Submission timestamp.
- Review status.
- Moderator decision and reason.

Suggested statuses:

- Pending.
- Approved.
- Rejected.
- Merged into Existing Entry.

Suggestions must not automatically create publicly visible catalog entries.

Administrators must check for duplicates and spelling variations before approval.

---

# 5. Resource Management

## 5.1 Supported File Formats

The initial release must support the following resource formats:

- PDF.
- PPT and PPTX.
- DOC and DOCX.
- JPG and JPEG.
- PNG.
- WebP.

The maximum upload size must be configurable, with an initial default of **25 MB per file**.

Additional formats require explicit approval and security validation.

## 5.2 Resource Categories

The platform must support:

- Previous-Year Question Papers.
- Mid-Semester Examination Papers.
- End-Semester Examination Papers.
- Assignments.
- Assignment Solutions.
- Lecture Notes.
- Question Banks.
- Solved Question Papers.
- Practical and Lab Materials.
- Presentations.
- Reference Materials.
- Other Academic Resources.

Administrators should be able to manage the available categories.

## 5.3 Required Resource Metadata

Every resource must store the appropriate fields:

- Resource ID.
- Title.
- Description.
- University ID.
- Faculty or department ID.
- Program ID.
- Academic-term ID.
- Subject ID.
- Category ID or category value.
- Contributor user ID.
- Contributor display name or public attribution preference.
- Original filename.
- Safe display filename.
- Object-storage key.
- MIME type.
- File extension.
- File size.
- Checksum or content hash where appropriate.
- Moderation status.
- Creation timestamp.
- Submission timestamp.
- Approval or publication timestamp, when applicable.
- Last updated timestamp.
- Optional exam date, year, session, or academic year.
- Optional verified source or reference URL.
- Download and view counters or equivalent derived analytics.

Exam dates and academic years must be separate from upload and publication dates.

If an exam date or year is unknown, display it as unknown rather than inventing a value.

## 5.4 Resource Lifecycle

The standard lifecycle is:

**Upload → Validation → Pending Review → Approved / Rejected → Published or Withdrawn**

The system must support additional removal or administrative states when needed.

### Pending

- Visible to the contributor in their own dashboard.
- Not publicly downloadable.
- Not exposed through public resource APIs.
- Not indexed by search engines.

### Approved

- Available on public pages.
- Eligible for public downloads.
- Eligible for search-engine indexing if the page meets SEO requirements.

### Rejected

- Not publicly accessible.
- Visible to the contributor with a rejection reason where appropriate.
- May be edited and resubmitted if permitted.

### Removed

- No longer publicly accessible.
- Removal reason and action history retained according to policy.
- File cleanup performed according to retention and appeal requirements.

All public resource queries must enforce the allowed publication status on the server.

## 5.5 Upload Workflow

1. The user signs in.
2. The user selects a university.
3. The user selects the relevant faculty or department.
4. The user selects a program.
5. The user selects an academic term.
6. The user selects a subject.
7. The user chooses a resource category.
8. The user enters a title and optional description.
9. The user provides available exam metadata.
10. The user selects a supported file.
11. The server validates authorization, metadata, file type, size, quotas, and storage policy.
12. The file is stored securely.
13. A pending resource record is created.
14. The contributor sees the submission status.
15. An authorized moderator approves or rejects the submission.
16. Approved resources become public.

Where practical, use a reservation-based upload process so concurrent uploads cannot exceed storage quotas.

An upload must not be marked successful merely because the browser selected a file. Confirm successful storage and database state.

## 5.6 File Validation and Storage Security

The application must:

- Validate file size on the server.
- Validate file extensions and MIME types.
- Inspect file signatures or magic bytes where applicable.
- Generate safe storage keys independent of user-supplied filenames.
- Prevent path traversal and unsafe filenames.
- Avoid trusting the browser's Content-Type header.
- Restrict access to unapproved files.
- Use short-lived signed download URLs or an equivalent controlled delivery mechanism.
- Never expose storage secret keys in frontend code.
- Apply appropriate upload rate limits.
- Clean up failed and abandoned uploads.
- Reconcile actual storage usage with database records.
- Handle failed storage operations without creating false successful submissions.

Consider malware scanning where available. If scanning is not implemented, document this limitation and apply appropriate restrictions before publishing files.

## 5.7 Contributor Permissions

A contributor may edit or delete only resources they own, subject to moderation and retention rules.

Ownership must be derived from the authenticated server-side session.

The application must never accept a client-provided owner ID as sufficient proof of ownership.

Contributors may edit permitted metadata without silently changing the underlying file.

If the file itself is replaced, the replacement must pass validation and the applicable moderation policy.

Renaming a display filename must not unintentionally change the storage key or break existing references.

## 5.8 My Contributions

Provide a dashboard showing the user's contributions with:

- Resource title.
- Subject and academic term.
- Category.
- Submission date.
- Current status.
- Approval or rejection date, where applicable.
- Download and view statistics, if available.
- Rejection reason, when applicable.
- Edit, withdraw, delete, or resubmit actions as permitted.

The dashboard must support pagination, filtering, and useful empty states.

## 5.9 Saved Resources

Users must be able to bookmark or save resources.

Saved resources should reference the existing resource record rather than creating duplicate binary files.

Provide:

- Save and unsave actions.
- A saved-resources page.
- Search and filtering.
- Clear behavior when a resource becomes private, removed, or unavailable.

Saved resources must not bypass the underlying resource's current access permissions.

## 5.10 Download History

Authenticated users should be able to view their download history.

Record successful download events separately from download requests that fail.

Where technically feasible, confirm successful delivery or completion without storing unnecessary personal data.

Guest download history may be maintained locally when appropriate, but must not be represented as authenticated server-side history.

---

# 6. Search, Filtering, and Discovery

## 6.1 Search

Provide search for approved public resources.

Searchable fields should include:

- Resource title.
- Description.
- Subject name.
- Program name.
- Category.
- Verified exam year or session.
- University and faculty names.

Use MongoDB indexes and appropriate search capabilities. Do not scan every resource document for every request.

A dedicated search service may be considered later if required by actual scale.

## 6.2 Filters

Users should be able to filter by:

- University.
- Faculty or department.
- Program.
- Academic term.
- Subject.
- Resource category.
- Exam year or session, when available.
- File type.
- Date added, where appropriate.

Filters must return accurate results and preserve usable URLs where doing so benefits navigation or SEO.

Do not index every possible filter combination.

## 6.3 Sorting

Support appropriate sorting options, such as:

- Most relevant.
- Recently added.
- Most downloaded.
- Alphabetical.

Sort by actual available data. Do not fabricate popularity metrics.

## 6.4 Empty and Error States

If no resources are available:

- Clearly state that no matching resources were found.
- Offer relevant filters to remove or change.
- Suggest contributing material when appropriate.
- Provide the missing-catalog suggestion flow where relevant.

Never display fabricated resource cards as real content.

---

# 7. Public Pages and User Interface

The interface must be responsive, accessible, and consistent across mobile, tablet, and desktop.

## 7.1 Required Public Pages

- Home page.
- University directory.
- University detail pages.
- Faculty or department pages.
- Program pages.
- Academic-term pages.
- Subject pages.
- Resource detail pages.
- Search results.
- Announcements.
- Community pages where public access is enabled.
- About page.
- Contact or support page.
- Privacy policy.
- Terms of use.
- Copyright and takedown information.
- Authentication pages.

## 7.2 Authenticated Pages

- User dashboard.
- My Contributions.
- Saved Resources.
- Download History.
- Profile and account settings.
- Upload Resource.
- Catalog Suggestions.
- Community participation pages.
- Relevant notifications.

## 7.3 Design Requirements

- Use Tailwind CSS for styling.
- Maintain a consistent design system for colors, typography, spacing, forms, cards, and navigation.
- Provide clear loading, success, empty, and error states.
- Use accessible labels and keyboard navigation.
- Maintain visible focus indicators.
- Use appropriate contrast.
- Avoid unnecessary animations and heavy client-side JavaScript.
- Ensure file-upload progress and failures are understandable.
- Do not replace existing working features merely to make a design change.
- Keep existing design decisions unless a change is required or explicitly requested.

---

# 8. Authentication and Account Security

## 8.1 Authentication

Implement secure authentication compatible with Astro and the selected Vercel deployment model.

Support account registration, login, logout, session management, and password recovery.

Email verification may be required according to the chosen account policy.

The selected authentication library must be actively maintained and compatible with the application's server-side session model.

Do not use client-side state as the authoritative source of authentication.

## 8.2 Session Security

- Use secure, HTTP-only cookies where applicable.
- Apply appropriate SameSite settings.
- Use Secure cookies in production.
- Rotate sessions after authentication or privilege changes when appropriate.
- Expire sessions according to policy.
- Revoke sessions on logout and administrative suspension when required.
- Protect state-changing requests against CSRF where applicable.
- Apply login and password-recovery rate limits.
- Do not log plaintext passwords, session tokens, or recovery secrets.

## 8.3 Passwords and Account Recovery

- Hash passwords with Argon2id or a securely configured equivalent.
- Never store plaintext passwords.
- Use short-lived, single-use password-reset tokens.
- Avoid revealing whether an email address is registered through account-recovery responses.
- Validate password changes server-side.

## 8.4 Account Deletion

Users should have a documented account-deletion or deletion-request process.

The system must define how account deletion affects:

- Personal profile information.
- Uploaded resources.
- Attribution.
- Saved resources.
- Download history.
- Community contributions.
- Audit and legal-retention records.

Do not automatically delete useful public academic resources without an explicit product policy. Where appropriate, anonymize contributor attribution while preserving legitimate resources and required moderation records.

---

# 9. PDF and Document Utilities

## 9.1 Required Utilities

The initial release should provide the following utilities where technically feasible:

- Merge PDFs.
- Compress PDFs.
- Split PDFs by page range.
- Convert supported images to PDF.

## 9.2 Processing Requirements

- Validate input formats and sizes.
- Process files using reliable libraries or a suitable processing service.
- Return actual processed output.
- Display useful errors for unsupported, corrupt, or password-protected files.
- Avoid exposing temporary files publicly.
- Delete temporary inputs and outputs according to a documented cleanup policy.
- Apply resource limits to prevent abuse.
- Keep generated utility outputs private by default.

Utility outputs must not automatically become public academic resources.

Do not show a fake progress animation that suggests processing succeeded when no actual processing occurred.

Word and PowerPoint conversion may be added only when a reliable, compatible processing method is implemented and tested.

---

# 10. Academic Community

## 10.1 Community Features

The platform may provide academic discussion threads, comments, or temporary guest discussions.

The implementation must clearly distinguish public content from authenticated-only content.

Users must be able to report inappropriate or misleading content.

## 10.2 Moderation

- Provide server-side rate limits.
- Validate message content.
- Sanitize user-generated HTML or avoid accepting arbitrary HTML.
- Protect against spam and repeated submissions.
- Provide moderator actions for removing content.
- Record relevant moderation decisions.
- Prevent suspended users from bypassing restrictions through direct API calls.

## 10.3 Guest Chat Expiry

If temporary guest chat is enabled, guest conversations must expire after **8 hours**.

Expiry must be enforced by server-side timestamps and query conditions.

MongoDB TTL indexes may clean up expired documents, but TTL deletion must not be the only expiry control because physical deletion can be delayed.

Avoid collecting unnecessary identity information from guest participants.

---

# 11. Announcements

## 11.1 Announcement Management

Authorized administrators must be able to create, edit, schedule, publish, expire, archive, and delete announcements according to permissions.

Announcement fields should include:

- Announcement ID.
- Title.
- Body.
- Status.
- Priority.
- Optional call-to-action label and URL.
- Start time.
- Expiry time.
- Created by.
- Updated by.
- Created and updated timestamps.
- Publication history.

Suggested statuses:

- Draft.
- Scheduled.
- Published.
- Expired.
- Archived.

## 11.2 Public Announcement Display

Active published announcements must be visible to both visitors and logged-in users.

Display them in appropriate public areas, such as the home page or announcement section.

Only announcements whose publication window is active should appear in the public API.

Public announcements should be rendered in crawlable HTML when useful for search discovery.

Sanitize announcement content and validate CTA URLs to prevent XSS and unsafe redirects.

Record relevant announcement views and clicks without collecting unnecessary personal data.

---

# 12. Owner and Administration Dashboard

The administrative dashboard is a core platform requirement.

Only the owner and authorized personnel may access administrative features. Hiding the admin link in the interface is not sufficient security.

## 12.1 Permission Model

Implement granular permissions for:

- Analytics.
- Resource moderation.
- Catalog management.
- User management.
- Community moderation.
- Announcements.
- Storage management.
- Administrator roles.
- Audit logs.
- System settings.

The owner may grant or revoke permissions according to policy.

Role changes must be enforced on the server and recorded in audit logs.

## 12.2 Overview Dashboard

Show available, accurately calculated metrics, including:

- Total registered users.
- New registrations during the selected period.
- Active users.
- Unique visitors where measurable.
- Sessions and pageviews.
- Resource views.
- Daily, weekly, and monthly active users.
- Returning-user metrics.
- Total resource submissions.
- Pending, approved, rejected, and removed resources.
- Successful uploads and downloads.
- Universities containing resources.
- Programs and subjects containing resources.
- Storage used, reserved, and remaining.
- Open user reports.
- Published and scheduled announcements.

Each metric must define its measurement period and counting method.

Do not display invented, estimated-as-real, or hardcoded production statistics.

If analytics collection has just started, show the actual available data range and explain that historical data is unavailable.

## 12.3 Traffic Analytics

Provide filters for:

- Today.
- Last 7 days.
- Last 30 days.
- Last 90 days.
- This month.
- Last month.
- Custom date range.

Show:

- Traffic by day and month.
- Month with the highest recorded traffic.
- Peak traffic hours when sufficient data exists.
- Most visited pages.
- Most viewed resources.
- Most searched terms, subject to privacy safeguards.
- Referral sources where available.
- Device categories where available.
- Trends in registrations and engagement.

Use real event data and consistent timezone rules. Store timestamps in UTC and document the reporting timezone. For India-focused reporting, Asia/Kolkata may be used as the default reporting timezone.

Do not claim that a particular month was the busiest if the relevant months lack comparable data.

## 12.4 Returning-User Analytics

Track returning usage using:

- Stable internal user IDs for authenticated users.
- Privacy-conscious first-party identifiers or session IDs for anonymous users, where appropriate.
- Clearly defined active-user and return-period rules.

Report returning users using a documented measurement method, such as users who had activity on more than one distinct day during the selected period.

Do not use invasive browser fingerprinting.

Do not claim to identify the same anonymous person across devices or after cookies are cleared unless the user authenticates and the measurement method legitimately supports that conclusion.

Disclose relevant analytics collection in the privacy policy.

## 12.5 Upload and Download Analytics

Track these events separately:

- Upload started.
- Upload completed.
- Resource submitted.
- Resource approved.
- Resource rejected.
- Download requested.
- Download successfully delivered or completed, where measurable.
- Failed upload or download.

Provide metrics such as:

- Total successful uploads.
- Total approved contributions.
- Total successful downloads.
- Downloads by resource.
- Downloads by subject and university.
- Uploads by contributor.
- Average uploads per active contributor.
- Average uploads per registered user.
- Average downloads per active user.
- Resource approval rate.

Every average must state its denominator and time period.

For example, average uploads per active contributor is total successful uploads by active contributors divided by the number of qualifying active contributors during the same period.

Prevent obvious double-counting from retries and automated traffic where practical. Do not treat a download-link request as a successful completed download unless the system can substantiate that interpretation.

## 12.6 Academic Coverage Analytics

Show:

- Universities with at least one approved resource.
- Programs with approved resources.
- Academic terms with approved resources.
- Subjects with approved resources.
- Resource counts by university, program, term, and subject.
- Subjects with no resources.
- Catalog entries awaiting review.

Distinguish catalog entries from entities that actually contain approved resources.

## 12.7 User Management

Authorized administrators should be able to:

- Search and paginate users.
- View relevant account status and registration details.
- Review a user's contribution history.
- View attributable activity where permitted.
- Suspend and restore accounts.
- Restrict uploads or community participation.
- Apply temporary restrictions.
- Revoke sessions where required.
- Initiate account deletion or anonymization according to policy.

Every restrictive or destructive action must require appropriate authorization and confirmation.

Suspension, content removal, and account deletion must remain distinct operations.

The policy for existing approved resources belonging to suspended users must be explicit. Suspension should not automatically erase legitimate resources unless the applicable policy requires it.

All restrictions must be enforced on the server, including upload, comment, login, and mutation endpoints as applicable.

## 12.8 Storage Management

The initial platform storage budget should be configurable, with a default target of **20 GB**.

The owner dashboard must show:

- Total stored data.
- Reserved upload capacity.
- Available capacity.
- Temporary and abandoned files.
- Usage by resource or category where useful.
- Storage growth over time.
- Failed cleanup operations.
- Quota warnings.

Trigger configurable warnings when storage approaches its limit, with an initial warning threshold of 80%.

The storage quota must be enforced server-side. Concurrent upload reservations must not allow the total quota to be exceeded unintentionally.

Do not automatically delete legitimate approved content simply because storage is approaching capacity.

## 12.9 Audit Logs

Record security-relevant administrative operations, including:

- Resource approval, rejection, and removal.
- User suspension and restoration.
- Permission and role changes.
- Catalog modifications.
- Announcement publication and removal.
- Storage cleanup and administrative storage actions.
- Report resolution.
- Account deletion or anonymization.
- System setting changes.

Audit entries should include:

- Actor ID.
- Action.
- Target entity and ID.
- Timestamp.
- Reason, where required.
- Minimal relevant before-and-after values.

Protect audit logs from unauthorized modification and access. Avoid recording passwords, tokens, or unnecessary sensitive information.

---

# 13. Analytics Data Model and Reporting

## 13.1 Event Collection

Use a consistent event schema for analytics.

Potential event names include:

- `page_view`
- `resource_view`
- `search_performed`
- `download_requested`
- `download_completed`
- `upload_started`
- `upload_completed`
- `contribution_submitted`
- `resource_approved`
- `resource_rejected`
- `user_registered`
- `session_started`
- `announcement_viewed`
- `announcement_clicked`

Events should contain only necessary information, including relevant timestamps, event type, entity IDs, and privacy-conscious attribution fields.

Security-sensitive events such as approvals and confirmed database operations should be recorded server-side.

Client-reported events must not be trusted as proof that an upload, download, approval, or administrative operation succeeded.

## 13.2 Analytics Performance

- Index fields required for common reports.
- Use MongoDB aggregation pipelines where appropriate.
- Consider daily aggregates or precomputed summaries as traffic grows.
- Paginate detailed event history.
- Avoid running unbounded analytics queries on every dashboard request.
- Establish retention periods for raw events and aggregated statistics.
- Reconcile important event totals against authoritative resource and storage records.

Historical reports must not be retroactively fabricated from current counters.

---

# 14. MongoDB Data Model

The following collections are the proposed logical model. Collections may be consolidated or separated when justified, but all required behavior must be preserved.

| Collection | Purpose |
|---|---|
| `users` | User accounts, profile fields, account status |
| `sessions` | Server-side session records, if supported by the selected auth library |
| `universities` | University catalog |
| `faculties` | Faculty and department records |
| `programs` | Programs and courses |
| `academicTerms` | Configurable academic terms |
| `subjects` | Subject catalog |
| `resources` | Resource metadata and moderation state |
| `resourceFiles` | File metadata and object-storage references where separation is useful |
| `savedResources` | User bookmarks |
| `downloadEvents` | Download requests and successful deliveries |
| `catalogSuggestions` | Suggested catalog additions and changes |
| `communityThreads` | Discussion threads |
| `communityMessages` | Discussion messages, if separate storage is needed |
| `reports` | User reports and moderation requests |
| `moderationActions` | Moderation decisions |
| `announcements` | Announcement content and publication windows |
| `analyticsEvents` | Raw event data |
| `dailyAnalyticsAggregates` | Precomputed daily metrics |
| `storageUsage` | Storage usage summaries |
| `storageReservations` | Reserved upload capacity and expiry |
| `auditLogs` | Administrative and security-relevant history |
| `userNotifications` | Notifications, if implemented |
| `systemSettings` | Configurable limits and application settings |

The authentication library may require additional collections or different names. Its documented schema takes precedence for authentication internals.

## 14.1 Database Design Requirements

- Use MongoDB ObjectIds or another consistent stable identifier strategy.
- Use references for entities that require independent lifecycle management.
- Add indexes for common queries.
- Enforce uniqueness for slugs and official codes within their correct scope.
- Use schema validation where practical.
- Validate data at application boundaries.
- Use transactions where supported and necessary for consistency.
- Design for concurrent uploads and moderation actions.
- Do not rely exclusively on frontend validation.
- Never expose database connection strings to the browser.

Indexes must be documented for frequent operations such as user lookup, subject resource listing, moderation queues, saved resources, analytics periods, and announcement publication windows.

---

# 15. API and Server-Side Requirements

Astro server endpoints or an appropriately justified server-side API structure must provide all required operations.

Organize APIs by domain, such as:

- Authentication.
- Users and profiles.
- Academic catalog.
- Resources and uploads.
- Search.
- Saved resources.
- Download history.
- PDF utilities.
- Community.
- Catalog suggestions.
- Announcements.
- Administration.
- Analytics.

The exact URL structure may be chosen during implementation, but endpoint behavior and authorization requirements must remain consistent.

Every API must:

- Validate request parameters and payloads.
- Enforce authentication where required.
- Enforce role and ownership checks.
- Apply rate limits to sensitive operations.
- Return appropriate HTTP status codes.
- Avoid leaking stack traces or internal secrets.
- Use consistent response and error formats.
- Prevent unauthorized access through direct API requests.
- Apply pagination and reasonable query limits.

Public APIs must return only public, approved, and currently available information.

Administrative APIs must independently enforce permissions regardless of whether the UI is accessible.

---

# 16. SEO Requirements

SEO is a core product requirement, not a final cosmetic step.

## 16.1 Rendering Strategy

Use Astro's static rendering or server-side rendering according to each page's needs.

Public academic pages should deliver meaningful HTML content to search engines without requiring client-side JavaScript to discover their primary content.

Use stable URLs for universities, faculties, programs, academic terms, subjects, and approved resources.

## 16.2 Metadata

Implement:

- Unique page titles.
- Relevant meta descriptions.
- Canonical URLs.
- Open Graph metadata.
- Appropriate social-sharing metadata.
- Descriptive headings.
- Breadcrumbs.
- Image alt text.
- Internal links between related academic pages.

Metadata must reflect actual page content and must not contain fabricated resource counts, academic details, or dates.

## 16.3 Sitemap and Crawling

Implement:

- `robots.txt`.
- An XML sitemap or sitemap index when needed.
- Canonical URL rules.
- Appropriate HTTP status codes.
- Redirects when public slugs change.
- Monitoring for broken public URLs.

Only eligible public pages should be included in the sitemap.

Do not expose pending resources, private profiles, account pages, private discussions, administrative pages, or other restricted content through the sitemap.

## 16.4 Indexing Policy

Index public pages only when they provide meaningful and accessible content.

Prevent indexing of:

- Pending and rejected resources.
- Removed or private resources.
- Administrative pages.
- Authentication pages where indexing offers no value.
- Private account pages.
- Expired or unavailable resources.
- Thin or empty catalog pages when they do not provide useful information.
- Duplicate filter combinations.
- Private chats and user-specific history.

For a resource that becomes unavailable, return an appropriate status or redirect based on the reason and available replacement. Do not redirect every missing page to the home page.

## 16.5 Structured Data

Use structured data only when the selected schema accurately represents the page.

Validate structured data and never include fabricated ratings, reviews, prices, authorship, or other unsupported claims.

## 16.6 SEO Monitoring

Document how to:

- Submit the sitemap to Google Search Console.
- Monitor indexing and crawl errors.
- Identify broken links.
- Track public-page performance.
- Review organic search traffic.
- Improve pages based on real search data.

SEO performance targets may be established after a baseline is measured. Do not promise rankings or traffic outcomes.

---

# 17. Security Requirements

Security controls must be applied throughout the application.

## 17.1 Input and Output Security

- Validate all external input.
- Use parameterized database operations and safe query construction.
- Protect against NoSQL injection.
- Escape or sanitize untrusted user-generated content.
- Prevent stored and reflected XSS.
- Validate redirect destinations.
- Apply CSRF protection where applicable.
- Use appropriate security headers.
- Avoid rendering arbitrary HTML from users or announcements.

## 17.2 Authorization

- Enforce permissions server-side.
- Check ownership for resource mutations.
- Check moderation status before public delivery.
- Restrict administrative endpoints.
- Prevent privilege escalation through modified request bodies.
- Recheck authorization for signed URL generation.
- Revoke relevant sessions when required.

## 17.3 Secrets and Environment Configuration

Keep all secrets in environment variables or an appropriate secret manager.

Provide a safe `.env.example` containing variable names and placeholder values only.

Never commit real credentials.

Never expose private environment variables through Astro's public environment-variable conventions or client-side bundles.

## 17.4 Operational Security

- Use HTTPS in production.
- Configure database network access and credentials securely.
- Apply least-privilege database and storage permissions.
- Back up the database according to an explicit policy.
- Test backup restoration.
- Monitor server errors and unusual activity.
- Rate-limit authentication, uploads, downloads, reports, and other abuse-prone endpoints.
- Define an incident-response and account-recovery procedure.

---

# 18. Privacy, Copyright, and Content Policy

StuddyBuddy must publish clear privacy, terms-of-use, and copyright/takedown policies before public production launch.

The policies must explain:

- What account information is collected.
- What analytics events are collected.
- How uploaded resources are handled.
- How long data is retained.
- How account deletion requests work.
- How users can report content.
- How copyright complaints are handled.
- What happens to content after a user is suspended or deleted.

Require contributors to confirm that they are permitted to share the materials they upload.

Provide a process for reporting copyright infringement, private information, malware, misleading academic material, or other prohibited content.

Do not encourage uploading confidential examination material, personally identifiable information, or files that users are not authorized to share.

Restrict or remove content according to the published policy and applicable law.

Do not claim that uploaded resources have been officially verified by a university unless that verification actually occurred.

---

# 19. Performance and Reliability

## 19.1 Performance

- Minimize unnecessary JavaScript.
- Optimize images and static assets.
- Use pagination for large result sets.
- Add appropriate MongoDB indexes.
- Avoid N+1 query patterns where they materially affect performance.
- Cache eligible public data safely.
- Do not cache private account responses in shared public caches.
- Stream large files where appropriate instead of unnecessarily buffering them in memory.
- Avoid heavy PDF processing inside requests that exceed the deployment platform's practical limits.

## 19.2 Reliability

- Handle database and storage failures gracefully.
- Use timeouts and bounded retries where appropriate.
- Prevent duplicate submissions where practical.
- Clean up failed upload reservations.
- Reconcile storage records with actual objects.
- Keep public resource records consistent with their files.
- Make scheduled maintenance jobs retryable.
- Document recovery procedures.

## 19.3 Accessibility

Target WCAG 2.2 Level AA where practical.

Ensure keyboard access, semantic HTML, labels, focus visibility, appropriate contrast, accessible error messages, and usable screen-reader behavior.

---

# 20. Notifications

The application may provide in-app notifications for:

- Resource approval.
- Resource rejection.
- Catalog suggestion decisions.
- Relevant moderation actions.
- Important announcements.
- Account-security events.

Notifications must be associated with the correct user and must not expose another user's private information.

Email notifications may be added if a reliable email service is configured. Do not pretend that an email was sent if no email provider is configured or the send operation failed.

---

# 21. Configuration and Environment Variables

Provide a documented `.env.example` covering the environment variables required by the selected implementation.

Possible variables include:

- `MONGODB_URI`
- `MONGODB_DB_NAME`
- `SESSION_SECRET`
- `APP_URL`
- `STORAGE_ENDPOINT`
- `STORAGE_BUCKET`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- `STORAGE_REGION`
- Authentication-provider settings, if required.
- Email-provider settings, if enabled.
- Optional monitoring configuration.

The actual variable names must match the implemented libraries and deployment setup.

Secrets must remain server-only. Public environment variables must contain only values that are safe to expose.

Storage limits, maximum upload size, guest-chat expiry, analytics retention, and reporting timezone should be configurable where appropriate.

---

# 22. Testing Requirements

## 22.1 Authentication Tests

- A visitor cannot access authenticated endpoints.
- Registration and login work.
- Logout invalidates the relevant session.
- Password recovery uses valid, expiring tokens.
- Suspended accounts cannot continue prohibited actions.
- Role escalation through client requests is rejected.

## 22.2 Resource Tests

- Valid supported files can be uploaded.
- Unsupported file types are rejected.
- Oversized files are rejected.
- Invalid file signatures are rejected where validation is required.
- Pending resources cannot be downloaded publicly.
- Rejected and removed resources remain inaccessible publicly.
- Approved resources can be downloaded.
- Contributors cannot edit or delete other users' resources.
- Signed download access cannot bypass authorization.
- Concurrent uploads cannot silently exceed configured storage limits.

## 22.3 Catalog Tests

- Resources appear under the correct academic hierarchy.
- Catalog suggestions remain pending until approved.
- Duplicate suggestions can be identified and merged.
- Different academic structures work without assuming eight semesters.
- Deactivated catalog records do not break existing resource history.

## 22.4 Community Tests

- Rate limits are enforced.
- Unauthorized users cannot bypass restrictions.
- Reported content can be reviewed.
- Guest conversations expire after eight hours according to server-side enforcement.
- Expired conversations are not returned by normal read endpoints.

## 22.5 Administration Tests

- Unauthorized users cannot open protected admin endpoints.
- Each administrative role has only its permitted actions.
- Published announcements are visible publicly.
- Draft, scheduled, expired, and archived announcements follow their publication rules.
- User suspension and restoration are enforced.
- Destructive actions require the required confirmation and authorization.
- Audit logs record relevant administrative operations.
- Analytics reports use correct date ranges and counting rules.

## 22.6 SEO Tests

- Public pages render meaningful HTML.
- Titles and canonical URLs are correct.
- Sitemap entries point to eligible public pages.
- Private and pending resources are not exposed in public sitemaps.
- Missing pages return appropriate status codes.
- Redirects work after slug changes.
- Structured data matches visible page content.

## 22.7 Analytics Tests

- Upload and download events are not incorrectly conflated.
- Failed operations do not count as successful operations.
- Returning-user definitions are applied consistently.
- Monthly traffic comparisons use comparable periods.
- Average metrics use the documented denominator.
- Missing historical data is not fabricated.
- Analytics do not unnecessarily expose personal information.

## 22.8 Testing Standards

Create unit tests for business logic, integration tests for database and storage behavior, and browser tests for important user workflows.

Run type checking, linting, and production builds as part of verification.

Document any tests that could not be run and explain why.

---

# 23. Development and Implementation Rules for AI Agents

These rules apply to every coding agent working on StuddyBuddy.

## 23.1 Before Starting Any Task

1. Read `STUDDYBUDDY_SRS.md` completely.
2. Read `AGENTS.md` and the relevant project documentation.
3. Inspect the current repository structure.
4. Inspect `package.json`, Astro configuration, environment-variable documentation, and existing implementations.
5. Identify which requirements apply to the requested task.
6. Check whether relevant features already exist.
7. Make a small implementation plan before changing files.

Do not assume the repository is empty.

## 23.2 Preserve Existing Work

- Do not replace working modules without a justified need.
- Do not rewrite the whole application to implement a small feature.
- Do not remove existing functionality without approval.
- Prefer minimal, targeted changes.
- Reuse existing components, services, styles, and conventions where appropriate.
- Keep database migrations or schema changes backward-compatible where practical.
- Do not overwrite user changes.
- Never replace the approved technology stack without explicit permission.

## 23.3 Implementation Discipline

- Use TypeScript strict mode.
- Follow existing naming and folder conventions.
- Keep business logic out of presentation components where practical.
- Validate server inputs.
- Implement server-side authorization.
- Handle errors explicitly.
- Avoid placeholder implementations in production-critical workflows.
- Do not hardcode fake users, resources, analytics, upload success, download success, or admin metrics.
- Do not mark unimplemented requirements as complete.
- Add or update tests for relevant changes.
- Update documentation when behavior or configuration changes.

## 23.4 Completion Report

At the end of each task, report:

1. What was implemented.
2. Which files were changed.
3. Which SRS requirements were addressed.
4. Which tests were run and their actual results.
5. Any known limitations.
6. Any environment variables or deployment steps required.
7. Which items remain incomplete.

Clearly distinguish among:

- Implemented.
- Tested locally.
- Verified in production.

Never claim production verification if the feature has only been tested locally.

---

# 24. Suggested Repository Structure

The structure may evolve, but maintain clear separation of concerns.

```text
studdybuddy/
├── AGENTS.md
├── STUDDYBUDDY_SRS.md
├── README.md
├── package.json
├── package-lock.json
├── astro.config.mjs
├── tsconfig.json
├── .env.example
├── .gitignore
├── public/
│   ├── robots.txt
│   └── images/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── resources/
│   │   ├── catalog/
│   │   └── admin/
│   ├── layouts/
│   ├── pages/
│   │   ├── index.astro
│   │   ├── universities/
│   │   ├── resources/
│   │   ├── subjects/
│   │   ├── dashboard/
│   │   ├── admin/
│   │   └── api/
│   ├── server/
│   │   ├── auth/
│   │   ├── db/
│   │   ├── repositories/
│   │   ├── services/
│   │   ├── storage/
│   │   ├── analytics/
│   │   └── security/
│   ├── lib/
│   ├── middleware.ts
│   ├── styles/
│   └── types/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    ├── architecture.md
    ├── deployment.md
    ├── security.md
    └── analytics.md
```

This is a recommended structure, not permission to reorganize an existing working repository unnecessarily.

---

# 25. Deployment and Operations

## 25.1 Required Environments

Maintain separate development and production configurations.

Staging may be added when practical.

Do not reuse production secrets in local development.

## 25.2 Production Deployment Checklist

Before launch:

- Configure the Vercel project and Astro adapter.
- Configure MongoDB Atlas database access.
- Configure object storage and restricted credentials.
- Set production environment variables.
- Verify authentication and secure cookies.
- Verify public and private resource access.
- Verify administrator permissions.
- Verify database indexes.
- Verify file upload and download behavior.
- Verify scheduled cleanup and reservation recovery.
- Configure error monitoring.
- Configure backups and restore procedures.
- Publish privacy, terms, and takedown policies.
- Verify public-page metadata, sitemap, and robots rules.
- Test mobile layouts.
- Run production build and relevant tests.

## 25.3 Documentation

The README must explain:

- Project purpose.
- Technology stack.
- Prerequisites.
- Local setup.
- Installation commands.
- Development commands.
- Environment-variable setup.
- MongoDB Atlas setup.
- Object-storage setup.
- Test and build commands.
- Deployment process.
- Common errors and troubleshooting.

Do not include real secrets in documentation.

---

# 26. Acceptance Criteria

The initial release is acceptable only when the following requirements are implemented and verified to the extent applicable.

1. The application uses Astro.js, TypeScript, Tailwind CSS, MongoDB Atlas, secure authentication, and configured object storage.
2. The application builds successfully for the intended deployment environment.
3. Public visitors can browse and download approved resources without signing in.
4. Authenticated users can upload supported files within configured limits.
5. Pending, rejected, and removed resources cannot be accessed through public endpoints.
6. Resource ownership is enforced server-side.
7. Academic catalogs support configurable programs and academic terms.
8. Missing catalog information can be suggested and reviewed.
9. Contributors can manage their own permitted submissions.
10. Users can save resources and access their account-specific history.
11. PDF and image utilities return actual processed files when enabled.
12. Community controls and guest expiry are enforced server-side when those features are enabled.
13. Public announcements display correctly, and only active published announcements appear publicly.
14. The owner dashboard reports real user, resource, storage, and traffic data.
15. Analytics clearly define returning users, averages, and successful operations.
16. User suspension and role restrictions cannot be bypassed through direct API requests.
17. Administrative actions are recorded in protected audit logs.
18. SEO metadata, canonical URLs, sitemap, robots rules, and indexing policies work correctly.
19. Security-sensitive operations are validated, authorized, and tested.
20. Documentation covers local setup, configuration, testing, and deployment.
21. The final implementation report accurately distinguishes implemented, tested, and production-verified features.

---

# 27. Prioritization

## Phase 1 — Foundation

- Astro.js and TypeScript setup.
- Tailwind CSS.
- MongoDB Atlas connection.
- Secure authentication and sessions.
- Core layouts and public pages.
- Academic catalog.
- Environment configuration.
- Initial deployment.

## Phase 2 — Core Resource Platform

- Resource metadata and upload workflow.
- Object storage.
- Moderation.
- Public resource pages.
- Search and filtering.
- Download delivery.
- My Contributions.
- Saved Resources.
- Download History.

## Phase 3 — Administration

- Owner and role-based access.
- Resource moderation dashboard.
- Catalog management.
- User management.
- Announcements.
- Audit logs.
- Storage monitoring.

## Phase 4 — Analytics and SEO

- Server-confirmed analytics events.
- Traffic and returning-user reports.
- Upload and download metrics.
- Academic coverage reports.
- Sitemap, metadata, canonical URLs, and indexing controls.
- Search Console setup documentation.

## Phase 5 — Additional Features

- PDF merge, compression, and splitting.
- Image-to-PDF conversion.
- Academic community.
- Temporary guest discussions.
- Notifications.
- Additional universities.
- Performance and accessibility improvements.

Phases are an implementation guide, not permission to ignore requirements. Dependencies may change the execution order, but scope changes must be documented.

---

# 28. Final Authority and Change Control

`STUDDYBUDDY_SRS.md` is the authoritative product requirements document for StuddyBuddy.

If existing code conflicts with this SRS, inspect the conflict and report it before making destructive changes.

If a requested feature conflicts with the SRS, explain the conflict and ask for clarification when the choice materially affects architecture, security, data integrity, or product scope.

Approved changes must be reflected in this document.

The SRS defines expected behavior, but it does not prove that the feature exists. Implementation status must be maintained separately and verified through code inspection and testing.

**Final technology decision: Astro.js + TypeScript + Tailwind CSS + MongoDB Atlas + secure authentication + Cloudflare R2 or compatible S3 object storage + Vercel.**

**Next.js, Supabase PostgreSQL, Supabase Auth, and Supabase Storage are not part of the approved stack for this specification.**
