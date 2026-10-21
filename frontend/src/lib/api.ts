import type {
  AdminStats,
  AiUsageEntry,
  AuthorSummary,
  Book,
  CreateTicketPayload,
  DraftMeta,
  KnowledgeSection,
  LiveEvent,
  LoginResponse,
  Message,
  PageMeta,
  TeamMember,
  Ticket,
  TicketDetail,
  TicketFilters,
  Tone,
  User,
} from './types';

/**
 * Same-origin `/api/v1` in local dev (Vite proxies it to the API). For a
 * split deployment, set VITE_API_URL to the public API origin at build time.
 */
const BASE_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');
const TOKEN_KEY = 'bookleaf.token';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

type Envelope<T> = { data: T; meta?: Record<string, unknown> };

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<{ data: T; meta?: Record<string, unknown> }> {
  const token = tokenStore.get();
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');
  if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Cannot reach the BookLeaf API. Check that the backend is running.',
    );
  }

  if (response.status === 204) return { data: undefined as T };

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    /* empty or non-JSON body */
  }

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    if (response.status === 401) tokenStore.clear();
    throw new ApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? `Request failed with status ${response.status}.`,
      error?.details,
    );
  }

  return payload as Envelope<T>;
}

const queryString = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const serialized = search.toString();
  return serialized ? `?${serialized}` : '';
};

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }).then((r) => r.data),
    me: () => request<{ user: User & { author?: AuthorSummary['author'] } }>('/auth/me').then((r) => r.data.user),
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
  },

  authors: {
    me: () => request<AuthorSummary>('/authors/me').then((r) => r.data),
  },

  books: {
    list: () => request<Book[]>('/books').then((r) => r.data),
  },

  tickets: {
    list: async (filters: TicketFilters = {}) => {
      const response = await request<Ticket[]>(
        `/tickets${queryString({
          status: filters.status,
          category: filters.category,
          priority: filters.priority,
          assignee: filters.assignee,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          search: filters.search,
          sort: filters.sort,
          page: filters.page,
          pageSize: filters.pageSize,
        })}`,
      );
      return { items: response.data, meta: response.meta as unknown as PageMeta };
    },
    get: (id: string) => request<TicketDetail>(`/tickets/${id}`).then((r) => r.data),
    create: (payload: CreateTicketPayload) =>
      request<Ticket>('/tickets', { method: 'POST', body: JSON.stringify(payload) }),
    update: (
      id: string,
      payload: {
        status?: string;
        category?: string;
        priority?: string;
        assignedToId?: string | null;
      },
    ) => request<Ticket>(`/tickets/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }).then((r) => r.data),
    assign: (id: string, assignedToId: string | null) =>
      request<Ticket>(`/tickets/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assignedToId }),
      }).then((r) => r.data),
    message: (id: string, body: string, isInternal = false) =>
      request<Message>(`/tickets/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, isInternal }),
      }).then((r) => r.data),
    close: (id: string) => request<Ticket>(`/tickets/${id}/close`, { method: 'POST' }).then((r) => r.data),
    draft: (id: string, payload: { tone: Tone; includeHistory?: boolean; instructions?: string }) =>
      request<{ draft: string; meta: DraftMeta }>(`/tickets/${id}/ai/draft`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }).then((r) => r.data),
    reclassify: (id: string) =>
      request<Ticket>(`/tickets/${id}/ai/reclassify`, { method: 'POST' }),
  },

  admin: {
    stats: () => request<AdminStats>('/admin/stats').then((r) => r.data),
    team: () => request<TeamMember[]>('/admin/team').then((r) => r.data),
    aiUsage: () =>
      request<AiUsageEntry[]>('/admin/ai/usage?limit=50').then((r) => r.data),
  },

  knowledge: {
    list: () => request<KnowledgeSection[]>('/knowledge-base').then((r) => r.data),
  },
};

/** Build the SSE URL with the JWT (EventSource cannot set headers). */
export const eventStreamUrl = (): string | null => {
  const token = tokenStore.get();
  if (!token) return null;
  return `${BASE_URL}/events?token=${encodeURIComponent(token)}`;
};

export type { LiveEvent };
