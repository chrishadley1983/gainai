// ---------------------------------------------------------------------------
// Google Business Profile (GBP) API response types
// ---------------------------------------------------------------------------

// --- Locations ---

export interface GoogleLocation {
  name: string; // e.g. "locations/123456"
  title: string;
  storeCode?: string;
  storefrontAddress?: GooglePostalAddress;
  phoneNumbers?: GooglePhoneNumbers;
  websiteUri?: string;
  regularHours?: GoogleBusinessHours;
  specialHours?: GoogleSpecialHours;
  categories?: GoogleCategories;
  labels?: string[];
  languageCode?: string;
  latlng?: GoogleLatLng;
  metadata?: GoogleLocationMetadata;
  profile?: GoogleProfile;
  serviceArea?: GoogleServiceArea;
  openInfo?: GoogleOpenInfo;
}

export interface GooglePostalAddress {
  regionCode: string;
  languageCode?: string;
  postalCode?: string;
  administrativeArea?: string;
  locality?: string;
  sublocality?: string;
  addressLines: string[];
}

export interface GooglePhoneNumbers {
  primaryPhone?: string;
  additionalPhones?: string[];
}

export interface GoogleBusinessHours {
  periods: GoogleTimePeriod[];
}

export interface GoogleTimePeriod {
  openDay: string;
  openTime: GoogleTimeOfDay;
  closeDay: string;
  closeTime: GoogleTimeOfDay;
}

export interface GoogleTimeOfDay {
  hours: number;
  minutes: number;
  seconds?: number;
  nanos?: number;
}

export interface GoogleSpecialHours {
  specialHourPeriods: GoogleSpecialHourPeriod[];
}

export interface GoogleSpecialHourPeriod {
  startDate: GoogleDate;
  openTime?: GoogleTimeOfDay;
  endDate?: GoogleDate;
  closeTime?: GoogleTimeOfDay;
  isClosed?: boolean;
}

export interface GoogleDate {
  year: number;
  month: number;
  day: number;
}

export interface GoogleLatLng {
  latitude: number;
  longitude: number;
}

export interface GoogleLocationMetadata {
  mapsUri?: string;
  newReviewUri?: string;
  canDelete?: boolean;
  canOperateLocalPost?: boolean;
  canModifyServiceList?: boolean;
  canHaveFoodMenus?: boolean;
  hasGoogleUpdated?: boolean;
  hasPendingEdits?: boolean;
  duplicateLocation?: string;
  placeId?: string;
}

export interface GoogleProfile {
  description?: string;
}

export interface GoogleServiceArea {
  businessType?: 'CUSTOMER_LOCATION_ONLY' | 'CUSTOMER_AND_BUSINESS_LOCATION';
  places?: GooglePlaces;
  regionCode?: string;
}

export interface GooglePlaces {
  placeInfos: GooglePlaceInfo[];
}

export interface GooglePlaceInfo {
  placeName: string;
  placeId: string;
}

export interface GoogleOpenInfo {
  status: 'OPEN' | 'CLOSED_PERMANENTLY' | 'CLOSED_TEMPORARILY';
  canReopen?: boolean;
  openingDate?: GoogleDate;
}

// --- Categories ---

export interface GoogleCategories {
  primaryCategory?: GoogleCategory;
  additionalCategories?: GoogleCategory[];
}

export interface GoogleCategory {
  name: string; // e.g. "gcid:restaurant"
  displayName: string;
  serviceTypes?: GoogleServiceType[];
  moreHoursTypes?: GoogleMoreHoursType[];
}

export interface GoogleServiceType {
  serviceTypeId: string;
  displayName: string;
}

export interface GoogleMoreHoursType {
  hoursTypeId: string;
  displayName: string;
  localizedDisplayName: string;
}

// --- Posts (Local Posts) ---

export interface GoogleLocalPost {
  name: string; // e.g. "locations/123/localPosts/456"
  languageCode?: string;
  summary?: string;
  callToAction?: GoogleCallToAction;
  media?: GoogleMediaItem[];
  state?: 'LIVE' | 'REJECTED' | 'PROCESSING';
  topicType?:
    | 'STANDARD'
    | 'EVENT'
    | 'OFFER'
    | 'PRODUCT'
    | 'ALERT';
  event?: GoogleLocalPostEvent;
  offer?: GoogleLocalPostOffer;
  createTime?: string;
  updateTime?: string;
  searchUrl?: string;
}

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

export interface GoogleLocalPostEvent {
  title: string;
  schedule: GoogleTimeInterval;
}

export interface GoogleLocalPostOffer {
  couponCode?: string;
  redeemOnlineUrl?: string;
  termsConditions?: string;
}

export interface GoogleTimeInterval {
  startDate: GoogleDate;
  startTime?: GoogleTimeOfDay;
  endDate: GoogleDate;
  endTime?: GoogleTimeOfDay;
}

// --- Reviews ---

export interface GoogleReview {
  name: string; // e.g. "locations/123/reviews/456"
  reviewId: string;
  reviewer: GoogleReviewer;
  starRating: 'ONE' | 'TWO' | 'THREE' | 'FOUR' | 'FIVE';
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: GoogleReviewReply;
}

export interface GoogleReviewer {
  displayName: string;
  profilePhotoUrl?: string;
  isAnonymous?: boolean;
}

export interface GoogleReviewReply {
  comment: string;
  updateTime: string;
}

export interface GoogleListReviewsResponse {
  reviews?: GoogleReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
}

// --- Media ---

export interface GoogleMediaItem {
  name?: string; // e.g. "locations/123/media/456"
  mediaFormat: 'PHOTO' | 'VIDEO';
  locationAssociation?: GoogleLocationAssociation;
  googleUrl?: string;
  thumbnailUrl?: string;
  createTime?: string;
  dimensions?: GoogleDimensions;
  sourceUrl?: string;
  description?: string;
}

export interface GoogleLocationAssociation {
  category?:
    | 'COVER'
    | 'PROFILE'
    | 'ADDITIONAL'
    | 'FOOD_MENU'
    | 'EXTERIOR'
    | 'INTERIOR'
    | 'PRODUCT'
    | 'AT_WORK'
    | 'TEAMS';
  priceListItemId?: string;
}

export interface GoogleDimensions {
  widthPixels: number;
  heightPixels: number;
}

// --- Performance / Insights ---

export interface GoogleDailyMetricTimeSeries {
  dailyMetric: GoogleDailyMetric;
  timeSeries: GoogleTimeSeries;
}

export type GoogleDailyMetric =
  | 'DAILY_METRIC_UNKNOWN'
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

export interface GoogleTimeSeries {
  datedValues: GoogleDatedValue[];
}

export interface GoogleDatedValue {
  date: GoogleDate;
  value?: string; // string representation of an integer
}

export interface GoogleGetDailyMetricsResponse {
  multiDailyMetricTimeSeries?: GoogleMultiDailyMetricTimeSeries[];
  timeZone?: string;
}

export interface GoogleMultiDailyMetricTimeSeries {
  dailyMetricTimeSeries: GoogleDailyMetricTimeSeries[];
}

export interface GoogleSearchKeywordsImpressionsResponse {
  searchKeywordsCounts?: GoogleSearchKeywordCount[];
  nextPageToken?: string;
}

export interface GoogleSearchKeywordCount {
  searchKeyword: string;
  insightsValue: {
    value?: string;
    threshold?: string;
  };
}

// --- Common list response wrapper ---

export interface GoogleListResponse<T> {
  items?: T[];
  nextPageToken?: string;
  totalSize?: number;
}

// --- OAuth tokens ---

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
  token_type: string;
}

// --- Error response ---

export interface GoogleErrorResponse {
  error: {
    code: number;
    message: string;
    status: string;
    details?: Array<{
      '@type': string;
      [key: string]: unknown;
    }>;
  };
}
