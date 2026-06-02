const BASE_URL = process.env.CRT_API_BASE_URL!;
const CLIENT_ID = process.env.CRT_CLIENT_ID!;
const CLIENT_SECRET = process.env.CRT_CLIENT_SECRET!;

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
}

export interface Organization {
  chamberOfCommerceId: string;
  chamberOfCommerceLocationId: string;
  name: string;
  street: string;
  houseNumber: string;
  houseNumberPostfix?: string;
  postalCode: string;
  city: string;
  countryCode: string;
  telephone?: string;
  region?: string;
  gpsLatitude: number;
  gpsLongitude: number;
  target?: string[];
  LastValidatedDate?: string;
}

export interface Qualification {
  id: string;
  qualificationType: string;
  qualificationTypeId: string;
  description?: string;
  issuedBy?: string;
  status: string;
  qualificationKindId: string;
  qualificationKind: string;
  schemeOwnerName?: string;
  startDate?: string;
  endDate?: string;
}

export interface OrganizationQualification {
  organization: Organization;
  qualification: Qualification;
}

interface ApiResponse {
  apiVersion: string;
  count: number;
  total: number;
  result: OrganizationQualification[];
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const response = await fetch(`${BASE_URL}/v1/oauth2/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    throw new Error(`Auth failed: ${response.status}`);
  }

  const data: TokenResponse = await response.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return data.access_token;
}

export async function fetchAllOrganizationQualifications(): Promise<
  OrganizationQualification[]
> {
  const token = await getAccessToken();
  const all: OrganizationQualification[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const response = await fetch(
      `${BASE_URL}/v1/organizationQualification?limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: ApiResponse = await response.json();
    all.push(...data.result);

    if (offset + limit >= data.total) break;
    offset += limit;
  }

  return all;
}

let dataCache: {
  data: OrganizationQualification[];
  fetchedAt: number;
} | null = null;

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export async function getCachedData(): Promise<OrganizationQualification[]> {
  if (dataCache && Date.now() - dataCache.fetchedAt < CACHE_TTL) {
    return dataCache.data;
  }

  const data = await fetchAllOrganizationQualifications();
  dataCache = { data, fetchedAt: Date.now() };
  return data;
}

export function getCategories(
  data: OrganizationQualification[]
): { id: string; name: string; kind: string; count: number }[] {
  const map = new Map<
    string,
    { name: string; kind: string; count: number }
  >();

  for (const item of data) {
    const q = item.qualification;
    const existing = map.get(q.qualificationTypeId);
    if (existing) {
      existing.count++;
    } else {
      map.set(q.qualificationTypeId, {
        name: q.qualificationType,
        kind: q.qualificationKind,
        count: 1,
      });
    }
  }

  return Array.from(map.entries())
    .map(([id, info]) => ({ id, ...info }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function filterByCategory(
  data: OrganizationQualification[],
  categoryId: string
): OrganizationQualification[] {
  return data.filter(
    (item) => item.qualification.qualificationTypeId === categoryId
  );
}
