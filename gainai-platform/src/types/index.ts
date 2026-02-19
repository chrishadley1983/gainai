// ---------------------------------------------------------------------------
// Enum-like union types
// ---------------------------------------------------------------------------

export type UserRole = 'ADMIN' | 'MANAGER' | 'EDITOR' | 'VIEWER';

export type ClientStatus = 'ACTIVE' | 'PAUSED' | 'CHURNED' | 'ONBOARDING';

export type PostStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'FAILED'
  | 'DELETED';

export type ReviewResponseStatus =
  | 'PENDING'
  | 'DRAFTED'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'SKIPPED';

export type LocationStatus =
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DISCONNECTED'
  | 'PENDING_VERIFICATION';

export type PackageType = 'STARTER' | 'GROWTH' | 'PREMIUM' | 'ENTERPRISE';

export type ContentType =
  | 'STANDARD'
  | 'EVENT'
  | 'OFFER'
  | 'PRODUCT'
  | 'ALERT';

export type BulkJobType =
  | 'POST_PUBLISH'
  | 'REVIEW_REPLY'
  | 'MEDIA_UPLOAD'
  | 'DATA_SYNC'
  | 'REPORT_GENERATE';

export type BulkJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

// ---------------------------------------------------------------------------
// Core entity interfaces
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Client {
  id: string;
  name: string;
  slug: string;
  status: ClientStatus;
  packageType: PackageType;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Location {
  id: string;
  clientId: string;
  googleAccountId: string;
  googleLocationId: string;
  name: string;
  address: string;
  phone?: string;
  websiteUrl?: string;
  status: LocationStatus;
  placeId?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  primaryCategory?: string;
  additionalCategories?: string[];
  lastSyncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Post {
  id: string;
  locationId: string;
  clientId: string;
  googlePostId?: string;
  contentType: ContentType;
  status: PostStatus;
  title?: string;
  summary: string;
  callToAction?: CallToAction;
  mediaUrls?: string[];
  scheduledAt?: Date;
  publishedAt?: Date;
  failureReason?: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CallToAction {
  type: 'BOOK' | 'ORDER' | 'SHOP' | 'LEARN_MORE' | 'SIGN_UP' | 'CALL';
  url?: string;
}

export interface Review {
  id: string;
  locationId: string;
  clientId: string;
  googleReviewId: string;
  reviewerName: string;
  reviewerPhotoUrl?: string;
  starRating: number;
  comment?: string;
  reviewedAt: Date;
  responseStatus: ReviewResponseStatus;
  response?: ReviewResponse;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewResponse {
  id: string;
  reviewId: string;
  body: string;
  draftedAt: Date;
  approvedAt?: Date;
  publishedAt?: Date;
  approvedById?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MediaItem {
  id: string;
  locationId: string;
  clientId: string;
  googleMediaId?: string;
  url: string;
  thumbnailUrl?: string;
  mimeType: string;
  fileName?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  category: 'COVER' | 'PROFILE' | 'ADDITIONAL' | 'POST';
  uploadedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface PerformanceMetrics {
  id: string;
  locationId: string;
  clientId: string;
  periodStart: Date;
  periodEnd: Date;
  searchViews: number;
  mapViews: number;
  websiteClicks: number;
  phoneClicks: number;
  directionRequests: number;
  totalReviews: number;
  averageRating: number;
  totalPosts: number;
  photoViews: number;
  createdAt: Date;
}

export interface BulkJob {
  id: string;
  clientId?: string;
  type: BulkJobType;
  status: BulkJobStatus;
  totalItems: number;
  processedItems: number;
  failedItems: number;
  errors?: BulkJobError[];
  startedAt?: Date;
  completedAt?: Date;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BulkJobError {
  itemIndex: number;
  itemId?: string;
  message: string;
  code?: string;
}

export interface GoogleAccount {
  id: string;
  clientId: string;
  googleEmail: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  tokenExpiresAt: Date;
  scopes: string[];
  isActive: boolean;
  lastAuthAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Utility / generic types
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
