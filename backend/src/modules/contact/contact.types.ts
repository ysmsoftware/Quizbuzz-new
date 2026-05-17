
export interface CreateContactDTO {
  email:      string;
  phone?:     string | undefined;
  firstName:  string;
  lastName?:  string | undefined;
  college?:   string | undefined;
  department?: string | undefined;
  city?:      string | undefined;
  state?:     string | undefined;
}

export interface UpdateContactDTO {
  phone?:      string | undefined;
  firstName?:  string | undefined;
  lastName?:   string | undefined;
  college?:    string | undefined;
  department?: string | undefined;
  city?:       string | undefined;
  state?:      string | undefined;
}



export interface ListContactsQueryDTO {
  search?:    string | undefined;   // full-text across firstName, lastName, email, phone
  city?:      string | undefined;
  state?:     string | undefined;
  college?:   string | undefined;
  page?:      number;
  limit?:     number;
}

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
  
  totalContests: number;
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
  status:           string;   // ParticipantStatus enum value
  registeredAt:     Date;
}

export interface ContactMessageItem {
  id:          string;
  channel:     string;   // MessageChannel enum value
  template:    string;   // MessageTemplate enum value
  status:      string;   // MessageStatus enum value
  recipient:   string;
  sentAt:      Date | null;
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
  city?:          string | undefined;
  state?:         string | undefined;
}

export interface UpdateContactInput {
  phone?:      string | undefined;
  firstName?:  string | undefined;
  lastName?:   string | undefined;
  college?:    string | undefined;
  department?: string | undefined;
  city?:       string | undefined;
  state?:      string | undefined;
}

export interface FindContactsFilter {
  organizationId: string;
  search?:        string;
  city?:          string;
  state?:         string;
  college?:       string;
  skip:           number;
  take:           number;
}