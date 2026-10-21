import { expect, test, type Page } from '@playwright/test';
import type { AuthorSummary, Message, Role, TicketDetail, User } from '../src/lib/types';

const author: User = {
  id: 'author-user',
  name: 'Test Author',
  email: 'author@example.test',
  role: 'AUTHOR',
  authorId: 'author-1',
};
const admin: User = {
  id: 'admin-user',
  name: 'Test Admin',
  email: 'admin@example.test',
  role: 'ADMIN',
  authorId: null,
};
const now = new Date().toISOString();
const summary: AuthorSummary = {
  author: {
    id: 'author-1', name: author.name, email: author.email, phone: '',
    city: 'Delhi', joinedDate: now, tier: 'Standard', bankName: null, bankLast4: null,
  },
  metrics: {
    bookCount: 0, publishedCount: 0, productionCount: 0, openTickets: 1,
    totalRoyaltyEarned: 0, royaltyPaid: 0, royaltyPending: 0, totalCopiesSold: 0,
  },
  recentTickets: [],
};
const knowledge = [
  {
    id: 'royalty-timing', title: 'Payout timeline', categories: ['ROYALTY_PAYMENTS'],
    content: 'Payouts are released within 45 days after the quarter closes. Balances below INR 1,000 roll over.',
  },
  {
    id: 'distribution-availability', title: 'Distribution', categories: ['DISTRIBUTION_AVAILABILITY'],
    content: 'An unavailable listing usually indicates a stock-sync issue. Support can request a distribution re-sync.',
  },
];

const createTicket = (): TicketDetail => ({
  id: 'ticket-1', ticketNumber: 'TKT-9001', subject: 'Royalty payout question',
  description: 'Please check my pending payout.', status: 'OPEN', category: 'ROYALTY_PAYMENTS',
  categorySource: 'AUTHOR', aiCategory: null, aiConfidence: null, priority: 'MEDIUM',
  prioritySource: 'HEURISTIC', aiPriority: null, aiPriorityReason: null,
  attachmentName: null, attachmentSize: null, createdAt: now, updatedAt: now,
  lastMessageAt: now, firstResponseAt: null, resolvedAt: null, closedAt: null, book: null,
  author: { id: 'author-1', name: author.name, email: author.email }, assignee: null,
  messageCount: 0, ageMinutes: 0, slaHours: 24, slaDueAt: now,
  slaRemainingMinutes: 1440, slaBreached: false, messages: [], events: [],
});

const messageFor = (role: Message['role'], body: string, isInternal = false): Message => ({
  id: `message-${role}-${body}`, ticketId: 'ticket-1', authorName: role === 'ADMIN' ? admin.name : author.name,
  role, body, isInternal, createdAt: now,
  user: { id: role === 'ADMIN' ? admin.id : author.id, name: role === 'ADMIN' ? admin.name : author.name },
});

// Drive live frames independently of the API mutation, as they arrive in production.
const emitMessage = async (page: Page, message: Message) => {
  await page.evaluate((value) => {
    window.dispatchEvent(new CustomEvent('test:live-event', {
      detail: { type: 'ticket.message', ticketId: 'ticket-1', data: { message: value } },
    }));
  }, message);
};

async function mockPortal(page: Page, signedInRole?: Role) {
  const ticket = createTicket();
  let sessionUser = signedInRole === 'ADMIN' ? admin : author;
  await page.addInitScript((role) => {
    if (role) localStorage.setItem('bookleaf.token', 'test-token');
    class TestEventSource extends EventTarget {
      onopen: (() => void) | null = null;
      forward = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        this.dispatchEvent(new MessageEvent(detail.type, { data: JSON.stringify(detail) }));
      };
      constructor() {
        super();
        window.addEventListener('test:live-event', this.forward);
        setTimeout(() => this.onopen?.(), 0);
      }
      close() {
        window.removeEventListener('test:live-event', this.forward);
      }
    }
    Object.defineProperty(window, 'EventSource', { value: TestEventSource });
  }, signedInRole);
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace('/api/v1', '');
    let data: unknown;
    if (path === '/auth/login') {
      const credentials = request.postDataJSON();
      sessionUser = credentials.email === admin.email ? admin : author;
      data = { token: 'test-token', user: sessionUser };
    } else if (path === '/auth/me') {
      data = { user: sessionUser };
    } else if (path === '/authors/me') {
      data = summary;
    } else if (path === '/books') {
      data = [];
    } else if (path === '/knowledge-base') {
      data = knowledge;
    } else if (path === '/tickets/ticket-1/messages') {
      const message = messageFor('AUTHOR', request.postDataJSON().body);
      ticket.messages.push(message);
      ticket.messageCount = ticket.messages.length;
      data = message;
    } else if (path === '/tickets/ticket-1') {
      data = ticket;
    } else if (path === '/tickets') {
      data = [ticket];
    } else if (path === '/admin/stats') {
      data = {
        totals: {
          total: 1, unresolved: 1, criticalOpen: 0, highOpen: 0,
          overdueCount: 0, unassignedOpen: 1, resolvedToday: 0,
        },
        percentages: { resolvedRate: 0, autoClassified: 0, fallbackRate: 0 },
        avgFirstResponseMinutes: 0,
        priorities: { CRITICAL: 0, HIGH: 0, MEDIUM: 1, LOW: 0 },
        ai: { estimatedCostUsd: 0, calls: 0, tokens: 0 },
      };
    } else {
      throw new Error(`Unexpected API request: ${request.method()} ${path}`);
    }
    await route.fulfill({
      json: { data, meta: { total: 1, page: 1, pageSize: 100, pages: 1 } },
    });
  });
  return ticket;
}

test('author login is the default, admin login is separate, and fields start empty', async ({ page }, testInfo) => {
  await mockPortal(page);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Author sign in' })).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveValue('');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page.getByText(/bookleaf123|demo accounts|priya\.sharma@email\.com|admin@bookleaf\.in/i)).toHaveCount(0);

  await page.getByRole('button', { name: 'Admin login', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
  await page.getByLabel('Email address').fill(admin.email);
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in as admin' }).click();
  await expect(page).toHaveURL('/admin/queue');
  await expect(page.getByRole('heading', { name: 'Operations Hub — Support Queue' })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('admin-queue.png'), fullPage: true });
});

test('login rejects the wrong role before creating a local session', async ({ page }) => {
  await mockPortal(page);
  await page.goto('/login');
  await page.getByLabel('Email address').fill(admin.email);
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in as author' }).click();
  await expect(page.getByRole('alert')).toContainText('Please use Admin login');
  expect(await page.evaluate(() => localStorage.getItem('bookleaf.token'))).toBeNull();

  await page.getByRole('button', { name: 'Admin login', exact: true }).click();
  await expect(page.getByLabel('Email address')).toHaveValue('');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await page.getByLabel('Email address').fill(author.email);
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in as admin' }).click();
  await expect(page.getByRole('alert')).toContainText('Please use author login');
  expect(await page.evaluate(() => localStorage.getItem('bookleaf.token'))).toBeNull();
  await page.getByRole('button', { name: 'Back to author login' }).click();
  await page.getByLabel('Email address').fill(author.email);
  await page.getByLabel('Password', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Sign in as author' }).click();
  await expect(page).toHaveURL('/app/dashboard');
});

test('quick answers expand below the question without navigating or creating a ticket', async ({ page }, testInfo) => {
  await mockPortal(page, 'AUTHOR');
  await page.goto('/app/dashboard');
  for (const [index, label] of [
    'When is my next royalty payout?', 'My Amazon listing is unavailable',
  ].entries()) {
    const question = page.locator('details').filter({ hasText: label });
    await question.locator('summary').click();
    await expect(question.getByText(knowledge[index].content, { exact: true })).toBeVisible();
    await expect(page).toHaveURL('/app/dashboard');
    await question.locator('summary').click();
    await expect(question.getByText(knowledge[index].content, { exact: true })).toBeHidden();
  }
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: testInfo.outputPath('author-dashboard.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const question = page.locator('details').first();
  await question.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(question.getByText(knowledge[0].content, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath('author-dashboard-mobile.png'), fullPage: true });
  await page.getByRole('link', { name: 'Open a new query' }).click();
  await expect(page).toHaveURL('/app/tickets/new');
});

test('author reply gets one success toast; only public admin replies trigger BookLeaf notifications', async ({ page }) => {
  const ticket = await mockPortal(page, 'AUTHOR');
  await page.goto('/app/tickets/ticket-1');
  await expect(page.getByText('Live thread', { exact: true })).toBeVisible();
  await page.getByLabel('Reply to the desk').fill('Here are my updated account details.');
  await page.getByRole('button', { name: /Send reply/ }).click();
  await expect(page.getByRole('status')).toContainText('Reply sent to the BookLeaf desk.');
  await emitMessage(page, ticket.messages[0]);
  await expect(page.getByRole('status')).toHaveCount(1);
  await expect(page.getByText('BookLeaf replied to your ticket', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Here are my updated account details.', { exact: true })).toBeVisible();

  await emitMessage(page, messageFor('ADMIN', 'Private operations note', true));
  await emitMessage(page, messageFor('SYSTEM', 'Ticket updated'));
  await expect(page.getByText('BookLeaf replied to your ticket', { exact: true })).toHaveCount(0);

  const reply = messageFor('ADMIN', 'We have received your updated details.');
  ticket.messages.push(reply);
  await emitMessage(page, reply);
  await expect(page.getByText('BookLeaf replied to your ticket', { exact: true })).toHaveCount(1);
  await expect(page.getByText(reply.body, { exact: true })).toBeVisible();
});
