const categoryEnum = [
  'ROYALTY_PAYMENTS',
  'ISBN_METADATA',
  'PRINTING_QUALITY',
  'DISTRIBUTION_AVAILABILITY',
  'BOOK_STATUS_PRODUCTION',
  'GENERAL_INQUIRY',
];

const priorityEnum = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const statusEnum = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

const errorResponse = {
  description: 'Error response',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorResponse' },
    },
  },
};

const jsonBody = (schema: unknown, description = 'Request body') => ({
  required: true,
  description,
  content: { 'application/json': { schema } },
});

const dataResponse = (schema: unknown, description = 'Success') => ({
  description,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          data: schema,
          meta: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
});

const ticketIdParam = {
  name: 'id',
  in: 'path',
  required: true,
  schema: { type: 'string' },
  description: 'Internal ticket ID or public TKT reference.',
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'BookLeaf Author Support & Communication Portal API',
    version: '1.0.0',
    description:
      'REST API for the author-facing support portal and the internal operations console.\n\n' +
      '**Auth:** obtain a JWT from `POST /auth/login` and send it as `Authorization: Bearer <token>`.\n\n' +
      '**RBAC:** `AUTHOR` accounts can only read their own books and tickets. `ADMIN` accounts can read everything, ' +
      'override triage, assign tickets, add internal notes and generate AI drafts.\n\n' +
      '**AI:** keys stay server-side. If Groq is unavailable the API degrades to deterministic rule-based triage and ' +
      'grounded template drafts instead of failing the request.\n\n' +
      '**Errors:** every error returns `{ "error": { "code", "message", "details?" } }` with a meaningful HTTP status ' +
      '(400, 401, 403, 404, 409, 422, 429, 503).',
  },
  servers: [{ url: '/api/v1', description: 'Versioned API root' }],
  tags: [
    { name: 'Auth', description: 'Session and identity' },
    { name: 'Author', description: 'Author profile and dashboard' },
    { name: 'Books', description: 'Catalogue, royalties and production state' },
    { name: 'Tickets', description: 'Support ticket lifecycle and messaging' },
    { name: 'AI', description: 'Triage and grounded draft generation' },
    { name: 'Admin', description: 'Operations analytics and team' },
    { name: 'Knowledge Base', description: 'BookLeaf policy content used for grounding' },
    { name: 'Realtime', description: 'Server-Sent Events stream' },
  ],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: {
                type: 'string',
                example: 'VALIDATION_ERROR',
                enum: [
                  'BAD_REQUEST',
                  'UNAUTHORIZED',
                  'FORBIDDEN',
                  'NOT_FOUND',
                  'CONFLICT',
                  'VALIDATION_ERROR',
                  'RATE_LIMITED',
                  'AI_UNAVAILABLE',
                  'INTERNAL_ERROR',
                ],
              },
              message: { type: 'string', example: 'The submitted data is invalid.' },
              details: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'priya.sharma@email.com' },
          password: { type: 'string', example: 'bookleaf123' },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string', enum: ['AUTHOR', 'ADMIN'] },
          authorId: { type: 'string', nullable: true },
        },
      },
      Book: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'BK001' },
          title: { type: 'string' },
          isbn: { type: 'string' },
          genre: { type: 'string' },
          publicationDate: { type: 'string', nullable: true },
          status: { type: 'string', example: 'Published & Live' },
          mrp: { type: 'number', nullable: true },
          royaltyPerCopy: { type: 'number', nullable: true },
          totalCopiesSold: { type: 'integer' },
          totalRoyaltyEarned: { type: 'number' },
          royaltyPaid: { type: 'number' },
          royaltyPending: { type: 'number' },
          lastRoyaltyPayoutDate: { type: 'string', nullable: true },
          printPartner: { type: 'string', nullable: true },
          availableOn: { type: 'array', items: { type: 'string' } },
          productionStage: { type: 'integer', nullable: true },
          productionNote: { type: 'string', nullable: true },
        },
      },
      Ticket: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          ticketNumber: { type: 'string', example: 'TKT-9001' },
          subject: { type: 'string' },
          description: { type: 'string' },
          status: { type: 'string', enum: statusEnum },
          category: { type: 'string', enum: categoryEnum },
          categorySource: { type: 'string', enum: ['AI', 'HEURISTIC', 'ADMIN', 'AUTHOR'] },
          aiCategory: { type: 'string', nullable: true, enum: categoryEnum },
          aiConfidence: { type: 'number', nullable: true },
          priority: { type: 'string', enum: priorityEnum },
          prioritySource: { type: 'string', enum: ['AI', 'HEURISTIC', 'ADMIN'] },
          aiPriorityReason: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          lastMessageAt: { type: 'string', format: 'date-time' },
          firstResponseAt: { type: 'string', format: 'date-time', nullable: true },
          slaDueAt: { type: 'string', format: 'date-time' },
          slaRemainingMinutes: { type: 'integer' },
          slaBreached: { type: 'boolean' },
          book: { allOf: [{ $ref: '#/components/schemas/Book' }], nullable: true },
          author: { type: 'object', nullable: true, additionalProperties: true },
          assignee: { type: 'object', nullable: true, additionalProperties: true },
          messageCount: { type: 'integer' },
        },
      },
      Message: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          role: { type: 'string', enum: ['AUTHOR', 'ADMIN', 'SYSTEM'] },
          authorName: { type: 'string' },
          body: { type: 'string' },
          isInternal: { type: 'boolean', description: 'Internal notes are never returned to authors.' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateTicketRequest: {
        type: 'object',
        required: ['subject', 'description'],
        properties: {
          bookId: { type: 'string', nullable: true, description: 'Omit or null for account-level queries.' },
          subject: { type: 'string', minLength: 5, maxLength: 140 },
          description: { type: 'string', minLength: 20, maxLength: 5000 },
          category: { type: 'string', enum: ['AUTO', ...categoryEnum], default: 'AUTO' },
          attachmentName: { type: 'string', nullable: true, description: 'UI-only attachment metadata.' },
          attachmentSize: { type: 'string', nullable: true },
        },
      },
      CreateMessageRequest: {
        type: 'object',
        required: ['body'],
        properties: {
          body: { type: 'string', minLength: 1, maxLength: 5000 },
          isInternal: { type: 'boolean', default: false, description: 'Admin only.' },
        },
      },
      UpdateTicketRequest: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: statusEnum },
          category: { type: 'string', enum: categoryEnum },
          priority: { type: 'string', enum: priorityEnum },
          assignedToId: { type: 'string', nullable: true, description: 'Admin user id, "me", or null.' },
        },
      },
      DraftRequest: {
        type: 'object',
        properties: {
          tone: { type: 'string', enum: ['EMPATHETIC', 'CONCISE', 'ESCALATION'], default: 'EMPATHETIC' },
          includeHistory: { type: 'boolean', default: true },
          instructions: { type: 'string', maxLength: 500 },
        },
      },
    },
  },
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in with email and password',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/LoginRequest' }),
        responses: {
          200: dataResponse(
            {
              type: 'object',
              properties: {
                token: { type: 'string' },
                user: { $ref: '#/components/schemas/User' },
              },
            },
            'JWT and user profile',
          ),
          401: errorResponse,
          422: errorResponse,
          429: errorResponse,
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user profile',
        responses: { 200: dataResponse({ type: 'object', additionalProperties: true }), 401: errorResponse },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'End the client session',
        description: 'The client discards its token. Existing JWTs remain valid until expiry.',
        responses: { 204: { description: 'Signed out; no response body' }, 401: errorResponse },
      },
    },
    '/authors/me': {
      get: {
        tags: ['Author'],
        summary: 'Author dashboard summary',
        description: 'Profile, complete book catalogue, royalty totals, catalogue counts and recent tickets.',
        responses: { 200: dataResponse({ type: 'object', additionalProperties: true }), 403: errorResponse },
      },
    },
    '/books': {
      get: {
        tags: ['Books'],
        summary: 'List books',
        description: 'Authors see only their own catalogue. Admins may pass `authorId` to filter.',
        parameters: [
          { name: 'authorId', in: 'query', schema: { type: 'string' }, description: 'Admin only.' },
        ],
        responses: {
          200: dataResponse({ type: 'array', items: { $ref: '#/components/schemas/Book' } }),
          403: errorResponse,
        },
      },
    },
    '/books/{id}': {
      get: {
        tags: ['Books'],
        summary: 'Get a book',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: dataResponse({ $ref: '#/components/schemas/Book' }),
          403: errorResponse,
          404: errorResponse,
        },
      },
    },
    '/tickets': {
      get: {
        tags: ['Tickets'],
        summary: 'List tickets',
        description:
          'Authors automatically see only their own tickets. Admin filters accept comma-separated values ' +
          '(e.g. `status=OPEN,IN_PROGRESS`). Default sort is `newest` (latest created first).',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' }, example: 'OPEN,IN_PROGRESS' },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string' }, example: 'CRITICAL,HIGH' },
          {
            name: 'assignee',
            in: 'query',
            schema: { type: 'string' },
            description: 'Admin only: me | unassigned | user id',
          },
          { name: 'dateFrom', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'dateTo', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          {
            name: 'sort',
            in: 'query',
            schema: { type: 'string', enum: ['urgency', 'oldest', 'newest', 'updated'] },
          },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 50, maximum: 100 } },
        ],
        responses: {
          200: dataResponse({ type: 'array', items: { $ref: '#/components/schemas/Ticket' } }),
          422: errorResponse,
        },
      },
      post: {
        tags: ['Tickets'],
        summary: 'Create a support ticket (author only)',
        description:
          'Creates the ticket, runs auto-classification and priority scoring, and emits `ticket.created` on the SSE stream. ' +
          'AI failure never blocks creation; the response `meta.triage.source` shows AI vs HEURISTIC.',
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateTicketRequest' }),
        responses: {
          201: dataResponse({ $ref: '#/components/schemas/Ticket' }),
          403: errorResponse,
          404: errorResponse,
          422: errorResponse,
        },
      },
    },
    '/tickets/{id}': {
      get: {
        tags: ['Tickets'],
        summary: 'Ticket detail with thread and timeline',
        description:
          'Authors receive public messages only. Admins also receive internal notes and full audit events.',
        parameters: [ticketIdParam],
        responses: {
          200: dataResponse({ $ref: '#/components/schemas/Ticket' }),
          403: errorResponse,
          404: errorResponse,
        },
      },
      patch: {
        tags: ['Tickets'],
        summary: 'Update status / category / priority / assignee (admin)',
        description:
          'Overrides are recorded in the audit log with categorySource/prioritySource set to ADMIN.',
        parameters: [ticketIdParam],
        requestBody: jsonBody({ $ref: '#/components/schemas/UpdateTicketRequest' }),
        responses: {
          200: dataResponse({ $ref: '#/components/schemas/Ticket' }),
          400: errorResponse,
          403: errorResponse,
          404: errorResponse,
          422: errorResponse,
        },
      },
    },
    '/tickets/{id}/assign': {
      post: {
        tags: ['Tickets'],
        summary: 'Assign a ticket (admin)',
        parameters: [ticketIdParam],
        requestBody: jsonBody({
          type: 'object',
          required: ['assignedToId'],
          properties: {
            assignedToId: { type: 'string', nullable: true, description: 'Admin id, "me", or null' },
          },
        }),
        responses: {
          200: dataResponse({ $ref: '#/components/schemas/Ticket' }),
          400: errorResponse,
          403: errorResponse,
        },
      },
    },
    '/tickets/{id}/messages': {
      post: {
        tags: ['Tickets'],
        summary: 'Reply or add an internal note',
        description:
          'Author replies are public and reopen a RESOLVED ticket. Admin public replies set firstResponseAt and move OPEN → IN_PROGRESS. ' +
          'Admin internal notes are excluded from the author API and SSE stream.',
        parameters: [ticketIdParam],
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateMessageRequest' }),
        responses: {
          201: dataResponse({ $ref: '#/components/schemas/Message' }),
          403: errorResponse,
          404: errorResponse,
          409: errorResponse,
        },
      },
    },
    '/tickets/{id}/close': {
      post: {
        tags: ['Tickets'],
        summary: 'Close a ticket',
        description: 'Admin only.',
        parameters: [ticketIdParam],
        responses: {
          200: dataResponse({ $ref: '#/components/schemas/Ticket' }),
          403: errorResponse,
          409: errorResponse,
        },
      },
    },
    '/tickets/{id}/reopen': {
      post: {
        tags: ['Tickets'],
        summary: 'Reopen a closed or resolved ticket',
        description: 'Admin only. The ticket returns to OPEN.',
        parameters: [ticketIdParam],
        responses: {
          200: dataResponse({ $ref: '#/components/schemas/Ticket' }),
          403: errorResponse,
          409: errorResponse,
        },
      },
    },
    '/tickets/{id}/ai/draft': {
      post: {
        tags: ['AI'],
        summary: 'Generate a grounded draft response (admin)',
        description:
          'Retrieves only the relevant knowledge-base sections, sends compact account facts and the last two public messages, ' +
          'and returns an editable draft plus model/token/cost metadata. Falls back to a policy-grounded template if Groq is unavailable.',
        parameters: [ticketIdParam],
        requestBody: jsonBody({ $ref: '#/components/schemas/DraftRequest' }),
        responses: {
          200: dataResponse({
            type: 'object',
            properties: {
              draft: { type: 'string' },
              meta: {
                type: 'object',
                properties: {
                  source: { type: 'string', enum: ['AI', 'TEMPLATE'] },
                  model: { type: 'string' },
                  cached: { type: 'boolean' },
                  sections: { type: 'array', items: { type: 'string' } },
                  promptTokens: { type: 'integer' },
                  completionTokens: { type: 'integer' },
                  estimatedCostUsd: { type: 'number' },
                },
              },
            },
          }),
          403: errorResponse,
          404: errorResponse,
          429: errorResponse,
        },
      },
    },
    '/tickets/{id}/ai/reclassify': {
      post: {
        tags: ['AI'],
        summary: 'Re-run AI triage (admin)',
        parameters: [ticketIdParam],
        responses: {
          200: dataResponse({ $ref: '#/components/schemas/Ticket' }),
          403: errorResponse,
          429: errorResponse,
        },
      },
    },
    '/admin/stats': {
      get: {
        tags: ['Admin'],
        summary: 'Queue and AI telemetry',
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { 200: dataResponse({ type: 'object', additionalProperties: true }), 403: errorResponse },
      },
    },
    '/admin/team': {
      get: {
        tags: ['Admin'],
        summary: 'Operations team and assignment counts',
        responses: {
          200: dataResponse({ type: 'array', items: { type: 'object', additionalProperties: true } }),
        },
      },
    },
    '/admin/authors': {
      get: {
        tags: ['Admin'],
        summary: 'Author directory with book and ticket counts',
        responses: {
          200: dataResponse({ type: 'array', items: { type: 'object', additionalProperties: true } }),
        },
      },
    },
    '/admin/ai/usage': {
      get: {
        tags: ['Admin'],
        summary: 'Recent AI usage log and token/cost totals',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 30, maximum: 100 } }],
        responses: {
          200: dataResponse({ type: 'array', items: { type: 'object', additionalProperties: true } }),
        },
      },
    },
    '/knowledge-base': {
      get: {
        tags: ['Knowledge Base'],
        summary: 'Internal policy sections used for AI grounding (admin only)',
        responses: {
          200: dataResponse({ type: 'array', items: { type: 'object', additionalProperties: true } }),
          403: errorResponse,
        },
      },
    },
    '/knowledge-base/answers': {
      get: {
        tags: ['Knowledge Base'],
        summary: 'Public support answers for authenticated portal users',
        responses: {
          200: dataResponse({
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                question: { type: 'string' },
                answer: { type: 'string' },
              },
            },
          }),
        },
      },
    },
    '/events': {
      get: {
        tags: ['Realtime'],
        summary: 'Server-Sent Events stream',
        description:
          'Authenticated stream (`?token=<jwt>`). Admins receive every event; authors receive only events for their tickets. ' +
          'Event types: `connected`, `ticket.created`, `ticket.updated`, `ticket.message`, `ticket.closed`, `heartbeat`.',
        security: [],
        parameters: [{ name: 'token', in: 'query', required: true, schema: { type: 'string' } }],
        responses: {
          200: {
            description: 'text/event-stream',
            content: { 'text/event-stream': { schema: { type: 'string' } } },
          },
          401: errorResponse,
        },
      },
    },
  },
};
