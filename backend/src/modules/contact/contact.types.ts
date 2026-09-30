
export interface CreateContactDTO {
  email:      string;
  phone?:     string | undefined;
  firstName:  string;
  lastName?:  string | undefined;
  college?:   string | undefined;
  department?: string | undefined;
  // Set when college/department were picked from the catalog (src/common/colleges.ts)
  // rather than typed as "Other" free text.
  collegeId?:   string | undefined;
  departmentId?: string | undefined;
  city?:      string | undefined;
  state?:     string | undefined;
}

export interface UpdateContactDTO {
  phone?:      string | undefined;
  firstName?:  string | undefined;
  lastName?:   string | undefined;
  college?:    string | undefined;
  department?: string | undefined;
  collegeId?:   string | null | undefined;
  departmentId?: string | null | undefined;
  city?:       string | undefined;
  state?:      string | undefined;
}



export interface ListContactsQueryDTO {
  search?:    string | undefined;   // full-text across firstName, lastName, email, phone
  city?:      string | undefined;
  state?:     string | undefined;
  college?:   string | undefined;
  collegeId?: string | undefined;
  letter?:    string | undefined;
  sortBy?:    ContactSortField;
  sortOrder?: "asc" | "desc";
  page?:      number;
  limit?:     number;
}

export type ContactSortField = "firstName" | "lastName" | "email" | "college" | "city" | "createdAt";

export interface ContactLookupQueryDTO {
  organizationId: string;
  email?:         string | undefined;
  phone?:         string | undefined;
}


export interface ContactResult {
  id:          string;
  email:       string;
  phone:       string | null;
  firstName:   string;
  lastName:    string | null;
  college:     string | null;
  department:  string | null;
  collegeId:   string | null;
  departmentId: string | null;
  city:        string | null;
  state:       string | null;
  createdAt:   Date;
  updatedAt:   Date;
}


export interface ContactListItem {
  id:        string;
  email:     string;
  phone:     string | null;
  firstName: string;
  lastName:  string | null;
  college:   string | null;
  city:      string | null;
  state:     string | null;
  createdAt: Date;
}


export interface PaginatedContactsResult {
  data:    ContactListItem[];
  total:   number;
  page:    number;
  limit:   number;
  totalPages: number;
}


export interface ContactContestSummary {
  participantId:    string;
  registrationRef:  string;
  contestId:        string;
  contestTitle:     string;
  contestSlug:      string;
  contestStartTime?: Date | null;
  status:           string;   // ParticipantStatus enum value
  registeredAt:     Date;
  checkedInAt?:     Date | null;
  joinedAt?:        Date | null;
  disqualificationReason?: string | null;
  contestPrice?:    number | undefined;
  payment?: {
    id:             string;
    status:         string;
    amount?:        number;   // rupees
    currency:       string;
    razorpayOrderId?:   string | null;
    razorpayPaymentId?: string | null;
    paidAt?:        Date | null;
    attempts:       number;
    failureReason?: string | null;
    createdAt:      Date;
    orders: {
      id:              string;
      razorpayOrderId: string;
      razorpayPaymentId?: string | null;
      amount:          number;   // rupees
      status:          string;
      method?:         string | null;
      failureReason?:  string | null;
      errorReason?:    string | null;
      createdAt:       Date;
    }[];
  } | undefined;
  certificate?: {
    id:             string;
    status:         string;
    generatedAt?:   Date | null;
    deliveredAt?:   Date | null;
    fileUrl?:       string | null;
  } | undefined;
  submission?: {
    id:             string;
    status:         string;
    submittedAt?:   Date | null;
    score:          string;
    percentage:     string;
    rank:           number;
    totalQuestions?: number | null;
    attempted?:     number | null;
    correct?:       number | null;
    wrong?:         number | null;
    skipped?:       number | null;
    isPassed?:      boolean | null;
    timeTakenSecs?: number | null;
  } | undefined;
}

export interface ContactMessageItem {
  id:          string;
  channel:     string;   // MessageChannel enum value
  template:    string;   // MessageTemplate enum value
  status:      string;   // MessageStatus enum value
  recipient:   string;
  subject:     string | null;
  failureReason: string | null;
  sentAt:      Date | null;
  deliveredAt: Date | null;
  contestId:   string | null;
  contestTitle: string | null;
  createdAt:   Date;
}


export interface ContactCertificateItem {
  id:            string;
  contestId:     string;
  contestTitle:  string;
  status:        string;   // CertificateStatus enum value
  fileUrl:       string | null;
  generatedAt:   Date | null;
  deliveredAt:   Date | null;
}

export interface UpsertContactInput {
  organizationId: string;
  email:          string;
  phone?:         string | undefined;
  firstName:      string;
  lastName?:      string | undefined;
  college?:       string | undefined;
  department?:    string | undefined;
  collegeId?:     string | undefined;
  departmentId?:  string | undefined;
  city?:          string | undefined;
  state?:         string | undefined;
}

export interface UpdateContactInput {
  phone?:      string | undefined;
  firstName?:  string | undefined;
  lastName?:   string | undefined;
  college?:    string | undefined;
  department?: string | undefined;
  collegeId?:  string | null | undefined;
  departmentId?: string | null | undefined;
  city?:       string | undefined;
  state?:      string | undefined;
}

export interface FindContactsFilter {
  organizationId: string;
  search?:        string;
  city?:          string;
  state?:         string;
  college?:       string;
  collegeId?:     string;
  letter?:        string;
  sortBy?:        ContactSortField;
  sortOrder?:     "asc" | "desc";
  skip:           number;
  take:           number;
}