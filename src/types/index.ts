import type { ObjectId } from 'mongodb';

// User & Role Types
export type UserRole = 'visitor' | 'user' | 'moderator' | 'admin' | 'owner';

export type UserStatus = 'active' | 'suspended' | 'restricted';

export interface UserRestrictions {
  uploadsBlocked?: boolean;
  communityBlocked?: boolean;
  reason?: string;
  expiresAt?: Date | null;
}

export interface User {
  _id?: ObjectId | string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  restrictions?: UserRestrictions;
  universityId?: string | null;
  programId?: string | null;
  academicTermId?: string | null;
  bio?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface Session {
  _id?: ObjectId | string;
  userId: string;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
}

// Academic Catalog Types
export interface University {
  _id?: ObjectId | string;
  name: string;
  slug: string;
  location?: string;
  logoUrl?: string;
  websiteUrl?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Faculty {
  _id?: ObjectId | string;
  universityId: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Program {
  _id?: ObjectId | string;
  universityId: string;
  facultyId: string;
  name: string;
  slug: string;
  code?: string;
  structureType: 'semester' | 'year' | 'trimester';
  durationYears?: number;
  totalTerms: number;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AcademicTerm {
  _id?: ObjectId | string;
  programId: string;
  name: string; // e.g. "Semester 1", "Year 1"
  orderIndex: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subject {
  _id?: ObjectId | string;
  programId: string;
  academicTermId: string;
  name: string;
  slug: string;
  code?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Resource Categories according to SRS Section 5.2
export type ResourceCategory =
  | 'Previous Year Question Paper'
  | 'Mid-Semester Paper'
  | 'End-Semester Paper'
  | 'Assignment'
  | 'Assignment Solution'
  | 'Notes'
  | 'Question Bank'
  | 'Solved Paper'
  | 'Practical & Lab Material'
  | 'Presentation/PPT'
  | 'Reference Material'
  | 'Other';

export type ResourceStatus = 'pending' | 'approved' | 'rejected' | 'removed';

export type SupportedFileExtension = 'pdf' | 'ppt' | 'pptx' | 'doc' | 'docx' | 'jpg' | 'jpeg' | 'png' | 'webp';

export interface Resource {
  _id?: ObjectId | string;
  title: string;
  description?: string;
  universityId: string;
  facultyId: string;
  programId: string;
  academicTermId: string;
  subjectId: string;
  category: ResourceCategory;
  contributorId: string;
  contributorName: string;
  
  // Storage & file properties
  originalFilename: string;
  storageKey: string;
  fileExtension: SupportedFileExtension;
  mimeType: string;
  fileSizeBytes: number;
  checksum?: string;

  // Academic metadata
  examYear?: number;
  examSession?: string; // e.g. "Summer", "Winter", "Mid-Sem"
  academicYear?: string; // e.g. "2023-2024"

  // Status & Moderation
  status: ResourceStatus;
  moderatedBy?: string;
  moderationReason?: string;
  moderatedAt?: Date;

  // Counters
  viewCount: number;
  downloadCount: number;

  createdAt: Date;
  updatedAt: Date;
}

// Saved bookmarks
export interface SavedResource {
  _id?: ObjectId | string;
  userId: string;
  resourceId: string;
  createdAt: Date;
}

// Catalog Suggestions
export interface CatalogSuggestion {
  _id?: ObjectId | string;
  entityType: 'university' | 'faculty' | 'program' | 'academicTerm' | 'subject';
  parentEntityId?: string;
  parentEntityName?: string;
  parentEntityType?: string;
  proposedName: string;
  officialCode?: string;
  referenceUrl?: string;
  explanation?: string;
  submitterId?: string;
  submitterEmail?: string;
  status: 'pending' | 'approved' | 'rejected' | 'merged';
  reviewDecisionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Community Discussions & Guest Chat
export interface CommunityThread {
  _id?: ObjectId | string;
  title: string;
  content: string;
  authorId?: string;
  authorName: string;
  isGuest: boolean;
  universityId?: string;
  subjectId?: string;
  isPinned?: boolean;
  isLocked?: boolean;
  expiresAt?: Date | null; // Set for 8-hour guest chat expiry
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunityReply {
  _id?: ObjectId | string;
  threadId: string;
  authorId?: string;
  authorName: string;
  isGuest: boolean;
  content: string;
  expiresAt?: Date | null;
  createdAt: Date;
}

// Announcements
export type AnnouncementStatus = 'draft' | 'scheduled' | 'published' | 'expired' | 'archived';

export interface Announcement {
  _id?: ObjectId | string;
  title: string;
  content: string;
  status: AnnouncementStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  callToActionLabel?: string;
  callToActionUrl?: string;
  publishedAt?: Date;
  expiresAt?: Date;
  createdBy: string;
  createdByName?: string;
  viewCount: number;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Reports & Moderation
export interface ContentReport {
  _id?: ObjectId | string;
  targetType: 'resource' | 'community' | 'user';
  targetId: string;
  reason: 'copyright' | 'misleading' | 'inappropriate' | 'spam' | 'other';
  details?: string;
  reporterId?: string;
  reporterEmail?: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

// Audit Logs
export interface AuditLog {
  _id?: ObjectId | string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

// Analytics Events
export type AnalyticsEventType =
  | 'page_view'
  | 'resource_view'
  | 'search_performed'
  | 'download_requested'
  | 'download_completed'
  | 'upload_started'
  | 'upload_completed'
  | 'contribution_submitted'
  | 'resource_approved'
  | 'resource_rejected'
  | 'user_registered'
  | 'session_started'
  | 'announcement_viewed'
  | 'announcement_clicked';

export interface AnalyticsEvent {
  _id?: ObjectId | string;
  eventType: AnalyticsEventType;
  timestamp: Date;
  userId?: string;
  anonymousVisitorId?: string;
  resourceId?: string;
  universityId?: string;
  programId?: string;
  subjectId?: string;
  path?: string;
  searchQuery?: string;
  metadata?: Record<string, any>;
}

// Storage Management
export interface StorageReservation {
  _id?: ObjectId | string;
  reservationId: string;
  userId: string;
  expectedSizeBytes: number;
  storageKey: string;
  expiresAt: Date;
  status: 'pending' | 'completed' | 'expired' | 'released';
  createdAt: Date;
}
