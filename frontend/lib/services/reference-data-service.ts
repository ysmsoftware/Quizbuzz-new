// lib/services/reference-data-service.ts
// ────────────────────────────────────────────────────────────────
// Read-only College/Department catalog, curated in quizbuzz-ops-next and
// mirrored into this app's own database (see backend/src/common/colleges.ts).
// Public, unauthenticated — used by contest registration and ambassador
// signup, both anonymous flows.
// ────────────────────────────────────────────────────────────────

export interface CollegeOption {
  id: string;
  name: string;
}

export interface DepartmentOption {
  id: string;
  collegeId: string;
  name: string;
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
  return data.data;
}

class ReferenceDataService {
  async getColleges(): Promise<CollegeOption[]> {
    return publicGet<CollegeOption[]>('/public/colleges');
  }

  async getDepartments(collegeId: string): Promise<DepartmentOption[]> {
    return publicGet<DepartmentOption[]>(`/public/colleges/${collegeId}/departments`);
  }
}

export const referenceDataService = new ReferenceDataService();
