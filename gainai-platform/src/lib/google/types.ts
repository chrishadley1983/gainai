/**
 * TypeScript types for Google Business Profile API responses.
 */

// ---------------------------------------------------------------------------
// OAuth
// ---------------------------------------------------------------------------

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  expiry_date: number;
  token_type?: string;
  scope?: string;
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export interface GoogleAddress {
  regionCode?: string;
  languageCode?: string;
  postalCode?: string;
  administrativeArea?: string;
  locality?: string;
  addressLines?: string[];
}

export interface GoogleLatLng {
  latitude: number;
  longitude: number;
}

export interface GoogleBusinessHours {
  periods?: {
    openDay: string;
    openTime: string;
    closeDay: string;
    closeTime: string;
  }[];
}

export interface GoogleLocation {
  name?: string;
  languageCode?: string;
  storeCode?: string;
  title?: string;
  phoneNumbers?: {
    primaryPhone?: string;
    additionalPhones?: string[];
  };
  categories?: {
    primaryCategory?: GoogleCategory;
    additionalCategories?: GoogleCategory[];
  };
  storefrontAddress?: GoogleAddress;
  websiteUri?: string;
  regularHours?: GoogleBusinessHours;
  specialHours?: {
    specialHourPeriods?: {
      startDate: { year: number; month: number; day: number };
      openTime?: string;
      endDate: { year: number; month: number; day: number };
      closeTime?: string;
      closed?: boolean;
    }[];
  };
  serviceArea?: {
    businessType?: string;
    places?: { placeInfos?: { placeName: string; placeId: string }[] };
    radius?: { latlng: GoogleLatLng; radiusKm: number };
  };
  labels?: string[];
  adWordsLocationExtensions?: {
    adPhone?: string;
  };
  latlng?: GoogleLatLng;
  openInfo?: {
    status?: 'OPEN' | 'CLOSED_PERMANENTLY' | 'CLOSED_TEMPORARILY';
    canReopen?: boolean;
    openingDate?: { year: number; month: number; day: number };
  };
  metadata?: {
    mapsUri?: string;
    newReviewUri?: string;
    duplicateLocation?: string;
    canDelete?: boolean;
    canOperateLocalPost?: boolean;
    canModifyServiceList?: boolean;
    canHaveFoodMenus?: boolean;
    hasPendingEdits?: boolean;
    hasGoogleUpdated?: boolean;
    canOperateHealthData?: boolean;
    canOperateLodgingData?: boolean;
  };
  profile?: {
    description?: string;
  };
  relationshipData?: {
    parentLocation?: { relationType: string; resourceName: string };
    childrenLocations?: { relationType: string; resourceName: string }[];
  };
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export type GooglePostTopicType =
  | 'STANDARD'
  | 'EVENT'
  | 'OFFER'
  | 'ALERT';

export type GooglePostState =
  | 'LIVE'
  | 'REJECTED'
  | 'PROCESSING';

export interface GoogleCallToAction {
  actionType:
    | 'ACTION_TYPE_UNSPECIFIED'
    | 'BOOK'
    | 'ORDER'
    | 'SHOP'
    | 'LEARN_MORE'
    | 'SIGN_UP'
    | 'CALL';
  url?: string;
}

export interface GooglePost {
  name?: string;
  languageCode?: string;
  summary?: string;
  callToAction?: GoogleCallToAction;
  media?: {
    mediaFormat: 'PHOTO' | 'VIDEO';
    sourceUrl: string;
  }[];
  state?: GooglePostState;
  topicType?: GooglePostTopicType;
  event?: {
    title?: string;
    schedule?: {
      startDate: { year: number; month: number; day: number };
      startTime?: { hours: number; minutes: number };
      endDate: { year: number; month: number; day: number };
      endTime?: { hours: number; minutes: number };
    };
  };
  offer?: {
    couponCode?: string;
    redeemOnlineUrl?: string;
    termsConditions?: string;
  };
  createTime?: string;
  updateTime?: string;
  searchUrl?: string;
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export type StarRating =
  | 'STAR_RATING_UNSPECIFIED'
  | 'ONE'
  | 'TWO'
  | 'THREE'
  | 'FOUR'
  | 'FIVE';

export interface GoogleReviewReply {
  comment?: string;
  updateTime?: string;
}

export interface GoogleReview {
  name?: string;
  reviewId?: string;
  reviewer?: {
    profilePhotoUrl?: string;
    displayName?: string;
    isAnonymous?: boolean;
  };
  starRating?: StarRating;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: GoogleReviewReply;
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export type MediaFormat = 'PHOTO' | 'VIDEO';

export type MediaCategory =
  | 'CATEGORY_UNSPECIFIED'
  | 'COVER'
  | 'PROFILE'
  | 'LOGO'
  | 'EXTERIOR'
  | 'INTERIOR'
  | 'PRODUCT'
  | 'AT_WORK'
  | 'FOOD_AND_DRINK'
  | 'MENU'
  | 'COMMON_AREA'
  | 'ROOMS'
  | 'TEAMS'
  | 'ADDITIONAL';

export interface GoogleMediaItem {
  name?: string;
  mediaFormat?: MediaFormat;
  locationAssociation?: {
    category?: MediaCategory;
    priceListItemId?: string;
  };
  googleUrl?: string;
  thumbnailUrl?: string;
  createTime?: string;
  dimensions?: {
    widthPixels?: number;
    heightPixels?: number;
  };
  insights?: {
    viewCount?: string;
  };
  attribution?: {
    profileName?: string;
    profilePhotoUrl?: string;
    takedownUrl?: string;
    profileUrl?: string;
  };
  description?: string;
  sourceUrl?: string;
  dataRef?: {
    resourceName?: string;
  };
}

// ---------------------------------------------------------------------------
// Performance Metrics
// ---------------------------------------------------------------------------

export interface DailyMetricValue {
  metric:
    | 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS'
    | 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH'
    | 'BUSINESS_IMPRESSIONS_MOBILE_MAPS'
    | 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH'
    | 'BUSINESS_CONVERSATIONS'
    | 'BUSINESS_DIRECTION_REQUESTS'
    | 'CALL_CLICKS'
    | 'WEBSITE_CLICKS'
    | 'BUSINESS_BOOKINGS'
    | 'BUSINESS_FOOD_ORDERS'
    | 'BUSINESS_FOOD_MENU_CLICKS';
  timeSeries?: {
    datedValues?: {
      date: { year: number; month: number; day: number };
      value?: string;
    }[];
  };
}

export interface PerformanceMetrics {
  locationName?: string;
  timeSeries?: DailyMetricValue[];
}

export interface SearchKeywordCount {
  searchKeyword: string;
  insightCount: {
    value: string;
  };
}

export interface SearchKeywordData {
  searchKeywordsCounts?: SearchKeywordCount[];
}

// ---------------------------------------------------------------------------
// Categories & Attributes
// ---------------------------------------------------------------------------

export interface GoogleCategory {
  name?: string;
  displayName?: string;
  serviceTypes?: {
    serviceTypeId?: string;
    displayName?: string;
  }[];
  moreHoursTypes?: {
    hoursTypeId?: string;
    displayName?: string;
  }[];
}

export interface GoogleAttribute {
  attributeId?: string;
  displayName?: string;
  groupDisplayName?: string;
  valueType?: 'BOOL' | 'ENUM' | 'REPEATED_ENUM' | 'URL';
  values?: {
    attributeValue?: unknown;
    displayName?: string;
  }[];
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

export type VerificationMethod =
  | 'ADDRESS'
  | 'EMAIL'
  | 'PHONE_CALL'
  | 'SMS'
  | 'AUTO'
  | 'VETTED_PARTNER';

export interface VerificationOption {
  verificationMethod: VerificationMethod;
  phoneNumber?: string;
  emailAddress?: string;
  addressData?: GoogleAddress;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export interface GoogleAPIError {
  code: number;
  message: string;
  status: string;
  details?: {
    '@type'?: string;
    reason?: string;
    domain?: string;
    metadata?: Record<string, string>;
  }[];
}

// ---------------------------------------------------------------------------
// API list response wrappers
// ---------------------------------------------------------------------------

export interface GoogleListResponse<T> {
  nextPageToken?: string;
  totalSize?: number;
  items: T[];
}
