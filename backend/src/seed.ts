/**
 * Seeds the application from the assignment's sample dataset
 * (prisma/data/authors.json: 10 authors, 18 books) plus demo accounts, support
 * tickets and AI telemetry so every screen has realistic content.
 *
 * Run with: npm run db:seed  (or npm run db:reset)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface SampleBook {
  book_id: string;
  title: string;
  isbn: string;
  genre: string;
  publication_date: string | null;
  status: string;
  mrp: number | null;
  author_royalty_per_copy: number | null;
  total_copies_sold: number;
  total_royalty_earned: number;
  royalty_paid: number;
  royalty_pending: number;
  last_royalty_payout_date: string | null;
  print_partner: string | null;
  available_on: string[];
}

interface SampleAuthor {
  author_id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  joined_date: string;
  books: SampleBook[];
}

const DEMO_PASSWORD = 'bookleaf123';
const BANK_NAMES = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank'];

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const hoursAgo = (hours: number) => minutesAgo(hours * 60);

const productionStageFor = (status: string): number | null => {
  if (status === 'Published & Live') return null;
  if (/cover design/i.test(status)) return 3;
  if (/typesetting/i.test(status)) return 4;
  if (/proofread/i.test(status)) return 5;
  if (/isbn/i.test(status)) return 6;
  if (/print/i.test(status)) return 7;
  if (/distribution/i.test(status)) return 8;
  return 1;
};

const productionNoteFor = (status: string): string | null => {
  if (/cover design/i.test(status)) {
    return 'Cover concepts are with the author for approval. Typesetting begins once the cover is signed off.';
  }
  if (/typesetting/i.test(status)) {
    return 'Typesetting revision round 1 in progress. Interior galley expected shortly; a date will be confirmed by the production editor.';
  }
  return null;
};

const tierFor = (books: SampleBook[]): string => {
  const lifetime = books.reduce((sum, book) => sum + book.total_royalty_earned, 0);
  return lifetime >= 25_000 ? 'Bestseller Breakthrough' : 'Standard Free';
};

async function main() {
  const dataPath = path.join(process.cwd(), 'prisma', 'data', 'authors.json');
  const sample = JSON.parse(readFileSync(dataPath, 'utf8')) as { authors: SampleAuthor[] };

  console.log(`Seeding ${sample.authors.length} authors and their books...`);

  // Clean in FK-safe order so the seed is idempotent.
  await prisma.aiUsage.deleteMany();
  await prisma.ticketEvent.deleteMany();
  await prisma.message.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.user.deleteMany();
  await prisma.book.deleteMany();
  await prisma.author.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const [index, sampleAuthor] of sample.authors.entries()) {
    const tier = tierFor(sampleAuthor.books);
    const digits = sampleAuthor.phone.replace(/\D/g, '');

    await prisma.author.create({
      data: {
        id: sampleAuthor.author_id,
        name: sampleAuthor.name,
        email: sampleAuthor.email,
        phone: sampleAuthor.phone,
        city: sampleAuthor.city,
        joinedDate: sampleAuthor.joined_date,
        tier,
        bankName: BANK_NAMES[index % BANK_NAMES.length],
        bankLast4: digits.slice(-4),
        user: {
          create: {
            email: sampleAuthor.email,
            passwordHash,
            name: sampleAuthor.name,
            role: 'AUTHOR',
          },
        },
        books: {
          create: sampleAuthor.books.map((book) => ({
            id: book.book_id,
            title: book.title,
            isbn: book.isbn,
            genre: book.genre,
            publicationDate: book.publication_date,
            status: book.status,
            mrp: book.mrp,
            royaltyPerCopy: book.author_royalty_per_copy,
            totalCopiesSold: book.total_copies_sold,
            totalRoyaltyEarned: book.total_royalty_earned,
            royaltyPaid: book.royalty_paid,
            royaltyPending: book.royalty_pending,
            lastRoyaltyPayoutDate: book.last_royalty_payout_date,
            printPartner: book.print_partner,
            availableOn: JSON.stringify(book.available_on),
            productionStage: productionStageFor(book.status),
            productionNote: productionNoteFor(book.status),
          })),
        },
      },
    });
  }

  // --- Operations team -----------------------------------------------------
  const adminPrimary = await prisma.user.create({
    data: {
      email: 'admin@bookleaf.in',
      passwordHash,
      name: 'Pooja Mehta',
      role: 'ADMIN',
    },
  });
  const adminRaghav = await prisma.user.create({
    data: {
      email: 'raghav@bookleaf.in',
      passwordHash,
      name: 'Raghav Sharma',
      role: 'ADMIN',
    },
  });
  await prisma.user.create({
    data: {
      email: 'siddharth@bookleaf.in',
      passwordHash,
      name: 'Siddharth Das',
      role: 'ADMIN',
    },
  });

  const systemAck = (firstName: string, publicId: string, category: string) =>
    `Thanks for reaching out, ${firstName}. Your ticket ${publicId} is in the queue and has been routed to our ` +
    `${category} desk. A specialist will reply here within 24 hours (usually much sooner). You will see the reply live on this page.`;

  type SeedTicket = Prisma.TicketCreateInput & { publicId: string };

  const tickets: SeedTicket[] = [
    {
      publicId: 'TKT-8912',
      author: { connect: { id: 'AUTH001' } },
      book: { connect: { id: 'BK001' } },
      subject: 'Royalty payout still pending for Whispers of the Ganges',
      description:
        "I published my book 4 months ago and still haven't received the royalty that is showing as pending. " +
        'The dashboard says ₹3,570 is pending with the last payout on 15 Oct, but nothing has reached my HDFC account since. ' +
        'Can you check what is happening? I have attached the statement screenshot.',
      category: 'ROYALTY_PAYMENTS',
      categorySource: 'AI',
      aiCategory: 'ROYALTY_PAYMENTS',
      aiConfidence: 0.97,
      priority: 'CRITICAL',
      prioritySource: 'AI',
      aiPriority: 'CRITICAL',
      aiPriorityReason:
        'Royalty payout appears overdue relative to the quarterly 45-day window, with a pending balance above the ₹1,000 threshold.',
      status: 'IN_PROGRESS',
      assignedTo: { connect: { id: adminPrimary.id } },
      attachmentName: 'hdfc-statement-oct.png',
      attachmentSize: '1.2 MB',
      firstResponseAt: hoursAgo(3.5),
      createdAt: hoursAgo(5.5),
      lastMessageAt: minutesAgo(28),
      messages: {
        create: [
          {
            authorName: 'Priya Sharma',
            role: 'AUTHOR',
            body:
              "I published my book 4 months ago and still haven't received the royalty that is showing as pending. " +
              'The dashboard says ₹3,570 is pending with the last payout on 15 Oct, but nothing has reached my HDFC account since. ' +
              'Can you check what is happening? I have attached the statement screenshot.',
            createdAt: hoursAgo(5.5),
          },
          {
            authorName: 'BookLeaf Support',
            role: 'SYSTEM',
            body: systemAck('Priya', 'TKT-8912', 'Royalty & Payments'),
            createdAt: minutesAgo(329),
          },
          {
            userId: adminPrimary.id,
            authorName: 'Pooja Mehta',
            role: 'ADMIN',
            body:
              'Hi Priya,\n\nI understand the concern — waiting on a pending balance with no money in the bank is ' +
              'genuinely frustrating, and I am sorry this has taken longer than it should have.\n\n' +
              "I've checked Whispers of the Ganges: 342 copies sold, ₹11,970 earned to date, ₹8,400 already paid and ₹3,570 pending. " +
              'The balance is above the ₹1,000 threshold, so it should have moved with the last quarterly run. ' +
              'I am escalating the settlement to our finance team now and confirming the bank details on file (HDFC ending 3210). ' +
              'They will confirm the release date within 48 hours.\n\n' +
              'Next step: we will update this ticket with the confirmed payout date by Friday. You do not need to do anything unless your bank details have changed.\n\nWarmly,\nBookLeaf Author Support',
            createdAt: hoursAgo(3.5),
          },
          {
            userId: adminPrimary.id,
            authorName: 'Pooja Mehta',
            role: 'ADMIN',
            body:
              'Finance confirmed the Q3 batch is scheduled for this Friday. Verified bank details (HDFC **3210) and raised ESC-4417. ' +
              'Will confirm the UTR as soon as it is released.',
            isInternal: true,
            createdAt: minutesAgo(28),
          },
        ],
      },
      events: {
        create: [
          {
            actorName: 'Priya Sharma',
            type: 'CREATED',
            description: 'Priya Sharma submitted this ticket via the author portal.',
            createdAt: hoursAgo(5.5),
          },
          {
            actorName: 'BookLeaf Triage',
            type: 'AI_TRIAGE',
            description:
              'AI classified this ticket as Royalty & Payments (97% confidence) and set priority CRITICAL.',
            metadata: JSON.stringify({ source: 'AI', confidence: 0.97 }),
            createdAt: minutesAgo(329),
          },
          {
            actorId: adminPrimary.id,
            actorName: 'Pooja Mehta',
            type: 'ASSIGNED',
            description: 'Assigned to Pooja Mehta.',
            createdAt: hoursAgo(4.2),
          },
          {
            actorId: adminPrimary.id,
            actorName: 'Pooja Mehta',
            type: 'PUBLIC_REPLY',
            description: 'Pooja Mehta replied to the author.',
            createdAt: hoursAgo(3.5),
          },
          {
            actorId: adminPrimary.id,
            actorName: 'Pooja Mehta',
            type: 'INTERNAL_NOTE',
            description: 'Pooja Mehta added an internal note (not visible to the author).',
            createdAt: minutesAgo(28),
          },
        ],
      },
    },
    {
      publicId: 'TKT-8908',
      author: { connect: { id: 'AUTH005' } },
      book: { connect: { id: 'BK009' } },
      subject: "Letters from Lakshadweep showing 'Currently Unavailable' on Amazon US",
      description:
        'My book is published but it is showing as "Currently Unavailable" on Amazon US. It has been like this for 4 days ' +
        'and I am losing sales during the launch window. Amazon India still shows in stock. Can you get the listing back up?',
      category: 'DISTRIBUTION_AVAILABILITY',
      categorySource: 'AI',
      aiCategory: 'DISTRIBUTION_AVAILABILITY',
      aiConfidence: 0.98,
      priority: 'HIGH',
      prioritySource: 'AI',
      aiPriority: 'HIGH',
      aiPriorityReason:
        'A live title is unavailable on a major channel, creating direct sales loss during its launch window.',
      status: 'OPEN',
      createdAt: hoursAgo(2.2),
      lastMessageAt: hoursAgo(2.2),
      events: {
        create: [
          {
            actorName: 'Meera Nair',
            type: 'CREATED',
            description: 'Meera Nair submitted this ticket via the author portal.',
            createdAt: hoursAgo(2.2),
          },
          {
            actorName: 'BookLeaf Triage',
            type: 'AI_TRIAGE',
            description:
              'AI classified this ticket as Distribution & Availability (98% confidence) and set priority HIGH.',
            metadata: JSON.stringify({ source: 'AI', confidence: 0.98 }),
            createdAt: hoursAgo(2.2),
          },
        ],
      },
      messages: {
        create: [
          {
            authorName: 'Meera Nair',
            role: 'AUTHOR',
            body:
              'My book is published but it is showing as "Currently Unavailable" on Amazon US. It has been like this for 4 days ' +
              'and I am losing sales during the launch window. Amazon India still shows in stock. Can you get the listing back up?',
            createdAt: hoursAgo(2.2),
          },
          {
            authorName: 'BookLeaf Support',
            role: 'SYSTEM',
            body: systemAck('Meera', 'TKT-8908', 'Distribution & Availability'),
            createdAt: minutesAgo(131),
          },
        ],
      },
    },
    {
      publicId: 'TKT-8904',
      author: { connect: { id: 'AUTH004' } },
      book: { connect: { id: 'BK006' } },
      subject: 'Author copies delivered with bent spines and blurry cover text',
      description:
        'I received the 50 author copies of Debugging Life today and the quality is terrible. The cover text is blurry, ' +
        'several spines are bent, and pages 40-48 are misaligned. This is embarrassing to send to reviewers. I need replacements.',
      category: 'PRINTING_QUALITY',
      categorySource: 'AI',
      aiCategory: 'PRINTING_QUALITY',
      aiConfidence: 0.96,
      priority: 'HIGH',
      prioritySource: 'AI',
      aiPriority: 'HIGH',
      aiPriorityReason: 'Verified-looking print defect across a 50-copy consignment; affects author distribution.',
      status: 'IN_PROGRESS',
      assignedTo: { connect: { id: adminRaghav.id } },
      firstResponseAt: minutesAgo(40),
      createdAt: hoursAgo(1.5),
      lastMessageAt: minutesAgo(40),
      messages: {
        create: [
          {
            authorName: 'Vikram Joshi',
            role: 'AUTHOR',
            body:
              'I received the 50 author copies of Debugging Life today and the quality is terrible. The cover text is blurry, ' +
              'several spines are bent, and pages 40-48 are misaligned. This is embarrassing to send to reviewers. I need replacements.',
            createdAt: hoursAgo(1.5),
          },
          {
            authorName: 'BookLeaf Support',
            role: 'SYSTEM',
            body: systemAck('Vikram', 'TKT-8904', 'Printing & Quality'),
            createdAt: minutesAgo(89),
          },
          {
            userId: adminRaghav.id,
            authorName: 'Raghav Sharma',
            role: 'ADMIN',
            body:
              'Hi Vikram,\n\nI am really sorry — that is not the print standard we want you to receive, especially for copies ' +
              'you are sending to reviewers. Thank you for flagging it clearly.\n\n' +
              'I have logged this as a production defect against the Delhi print run and raised a free reprint request. ' +
              'To close the verification quickly, could you reply with 2-3 photos showing the cover text, the bent spines and ' +
              'the misaligned pages? Once those are attached, we will schedule the replacement run. Reprints normally dispatch ' +
              'within 5-7 business days, and you will not be charged for this.\n\n' +
              'Next step: send the photos here and I will confirm the reprint dispatch date within 24 hours.\n\nWarmly,\nBookLeaf Author Support',
            createdAt: minutesAgo(40),
          },
        ],
      },
      events: {
        create: [
          {
            actorName: 'Vikram Joshi',
            type: 'CREATED',
            description: 'Vikram Joshi submitted this ticket via the author portal.',
            createdAt: hoursAgo(1.5),
          },
          {
            actorName: 'BookLeaf Triage',
            type: 'AI_TRIAGE',
            description:
              'AI classified this ticket as Printing & Quality (96% confidence) and set priority HIGH.',
            metadata: JSON.stringify({ source: 'AI', confidence: 0.96 }),
            createdAt: minutesAgo(89),
          },
          {
            actorId: adminRaghav.id,
            actorName: 'Raghav Sharma',
            type: 'ASSIGNED',
            description: 'Assigned to Raghav Sharma.',
            createdAt: hoursAgo(1.2),
          },
          {
            actorId: adminRaghav.id,
            actorName: 'Raghav Sharma',
            type: 'PUBLIC_REPLY',
            description: 'Raghav Sharma replied to the author.',
            createdAt: minutesAgo(40),
          },
        ],
      },
    },
    {
      publicId: 'TKT-8899',
      author: { connect: { id: 'AUTH010' } },
      book: { connect: { id: 'BK018' } },
      subject: 'Wrong ISBN showing on the Amazon listing for Howrah Nights',
      description:
        'The ISBN on my Amazon listing for Howrah Nights is different from the one printed on the physical copy. ' +
        'The physical book shows 978-93-5XXXX-18-9, but the Amazon page shows a different number. This is a serious data issue ' +
        'and I need it corrected before a review campaign starts next week.',
      category: 'ISBN_METADATA',
      categorySource: 'AI',
      aiCategory: 'ISBN_METADATA',
      aiConfidence: 0.99,
      priority: 'CRITICAL',
      prioritySource: 'AI',
      aiPriority: 'CRITICAL',
      aiPriorityReason:
        'Duplicate/wrong ISBN on a live listing is a catalogue-integrity failure and is explicitly high priority under policy.',
      status: 'RESOLVED',
      assignedTo: { connect: { id: adminPrimary.id } },
      firstResponseAt: hoursAgo(30),
      createdAt: hoursAgo(33),
      lastMessageAt: hoursAgo(26),
      resolvedAt: hoursAgo(26),
      messages: {
        create: [
          {
            authorName: 'Diya Chatterjee',
            role: 'AUTHOR',
            body:
              'The ISBN on my Amazon listing for Howrah Nights is different from the one printed on the physical copy. ' +
              'The physical book shows 978-93-5XXXX-18-9, but the Amazon page shows a different number. This is a serious data issue ' +
              'and I need it corrected before a review campaign starts next week.',
            createdAt: hoursAgo(33),
          },
          {
            authorName: 'BookLeaf Support',
            role: 'SYSTEM',
            body: systemAck('Diya', 'TKT-8899', 'ISBN & Metadata'),
            createdAt: minutesAgo(1979),
          },
          {
            userId: adminPrimary.id,
            authorName: 'Pooja Mehta',
            role: 'ADMIN',
            body:
              'Hi Diya,\n\nThank you for catching this, and I am sorry the listing went live with the wrong ISBN. ' +
              'That is our data error, not something you should have had to chase.\n\n' +
              'I escalated it to the production metadata team immediately. The Amazon feed has now been corrected and the ' +
              'listing shows 978-93-5XXXX-18-9, matching the physical copy. The platform cache can take a few hours to refresh, ' +
              'so please check again this evening. I have also flagged the original feed record so the same ISBN cannot be reused ' +
              'on another title.\n\n' +
              'Next step: if the listing still shows the old number after 24 hours, reply here and I will reopen this with the ' +
              'platform account manager.\n\nWarmly,\nBookLeaf Author Support',
            createdAt: hoursAgo(30),
          },
        ],
      },
      events: {
        create: [
          {
            actorName: 'Diya Chatterjee',
            type: 'CREATED',
            description: 'Diya Chatterjee submitted this ticket via the author portal.',
            createdAt: hoursAgo(33),
          },
          {
            actorName: 'BookLeaf Triage',
            type: 'AI_TRIAGE',
            description:
              'AI classified this ticket as ISBN & Metadata (99% confidence) and set priority CRITICAL.',
            createdAt: minutesAgo(1979),
          },
          {
            actorId: adminPrimary.id,
            actorName: 'Pooja Mehta',
            type: 'STATUS_CHANGED',
            description: 'Status changed from IN_PROGRESS to RESOLVED.',
            createdAt: hoursAgo(26),
          },
        ],
      },
    },
    {
      publicId: 'TKT-8891',
      author: { connect: { id: 'AUTH003' } },
      book: { connect: { id: 'BK005' } },
      subject: 'Royalty amount seems too low for 67 copies sold',
      description:
        'Between Two Temples has sold 67 copies according to my dashboard, but the royalty credited is only ₹2,546. ' +
        'That works out to about ₹38 per copy, which does not look right when the MRP is ₹425. Could you share a proper ' +
        'line-by-line breakdown of how the net profit was calculated?',
      category: 'ROYALTY_PAYMENTS',
      categorySource: 'AI',
      aiCategory: 'ROYALTY_PAYMENTS',
      aiConfidence: 0.94,
      priority: 'HIGH',
      prioritySource: 'AI',
      aiPriority: 'HIGH',
      aiPriorityReason: 'Royalty amount discrepancy on a live title; requires a transparent reconciliation.',
      status: 'OPEN',
      createdAt: hoursAgo(8),
      lastMessageAt: hoursAgo(8),
      messages: {
        create: [
          {
            authorName: 'Ananya Reddy',
            role: 'AUTHOR',
            body:
              'Between Two Temples has sold 67 copies according to my dashboard, but the royalty credited is only ₹2,546. ' +
              'That works out to about ₹38 per copy, which does not look right when the MRP is ₹425. Could you share a proper ' +
              'line-by-line breakdown of how the net profit was calculated?',
            createdAt: hoursAgo(8),
          },
          {
            authorName: 'BookLeaf Support',
            role: 'SYSTEM',
            body: systemAck('Ananya', 'TKT-8891', 'Royalty & Payments'),
            createdAt: minutesAgo(444),
          },
        ],
      },
      events: {
        create: [
          {
            actorName: 'Ananya Reddy',
            type: 'CREATED',
            description: 'Ananya Reddy submitted this ticket via the author portal.',
            createdAt: hoursAgo(8),
          },
          {
            actorName: 'BookLeaf Triage',
            type: 'AI_TRIAGE',
            description:
              'AI classified this ticket as Royalty & Payments (94% confidence) and set priority HIGH.',
            createdAt: minutesAgo(444),
          },
        ],
      },
    },
    {
      publicId: 'TKT-8884',
      author: { connect: { id: 'AUTH009' } },
      book: { connect: { id: 'BK015' } },
      subject: "It's been 3 weeks and Raising Roots is still in typesetting",
      description:
        'It has been 3 weeks and my book Raising Roots is still in typesetting. When will it be done? ' +
        'I was told the manuscript was approved and I have not heard anything since. I would like a realistic date, not a generic update.',
      category: 'BOOK_STATUS_PRODUCTION',
      categorySource: 'AI',
      aiCategory: 'BOOK_STATUS_PRODUCTION',
      aiConfidence: 0.93,
      priority: 'HIGH',
      prioritySource: 'AI',
      aiPriority: 'HIGH',
      aiPriorityReason: 'Production delay beyond two weeks on an in-production title; author needs a revised date.',
      status: 'OPEN',
      assignedTo: { connect: { id: adminRaghav.id } },
      createdAt: hoursAgo(26),
      lastMessageAt: hoursAgo(26),
      messages: {
        create: [
          {
            authorName: 'Kavita Deshmukh',
            role: 'AUTHOR',
            body:
              'It has been 3 weeks and my book Raising Roots is still in typesetting. When will it be done? ' +
              'I was told the manuscript was approved and I have not heard anything since. I would like a realistic date, not a generic update.',
            createdAt: hoursAgo(26),
          },
          {
            authorName: 'BookLeaf Support',
            role: 'SYSTEM',
            body: systemAck('Kavita', 'TKT-8884', 'Book Status & Production'),
            createdAt: minutesAgo(1551),
          },
        ],
      },
      events: {
        create: [
          {
            actorName: 'Kavita Deshmukh',
            type: 'CREATED',
            description: 'Kavita Deshmukh submitted this ticket via the author portal.',
            createdAt: hoursAgo(26),
          },
          {
            actorName: 'BookLeaf Triage',
            type: 'AI_TRIAGE',
            description:
              'AI classified this ticket as Book Status & Production (93% confidence) and set priority HIGH.',
            createdAt: minutesAgo(1551),
          },
          {
            actorId: adminRaghav.id,
            actorName: 'Raghav Sharma',
            type: 'ASSIGNED',
            description: 'Assigned to Raghav Sharma.',
            createdAt: hoursAgo(25),
          },
        ],
      },
    },
    {
      publicId: 'TKT-8879',
      author: { connect: { id: 'AUTH007' } },
      book: { connect: { id: 'BK013' } },
      subject: 'Typesetting approval submitted — when does proofreading start?',
      description:
        'I signed off on the PDF proof v2 for Midnight in Mysore yesterday. Could you confirm when proofreading starts ' +
        'and whether the physical advance proof will be dispatched to me? I would like to plan my launch announcement around it.',
      category: 'BOOK_STATUS_PRODUCTION',
      categorySource: 'AI',
      aiCategory: 'BOOK_STATUS_PRODUCTION',
      aiConfidence: 0.9,
      priority: 'MEDIUM',
      prioritySource: 'AI',
      aiPriority: 'MEDIUM',
      aiPriorityReason: 'Routine production-timeline query with no active revenue or integrity impact.',
      status: 'OPEN',
      createdAt: hoursAgo(30),
      lastMessageAt: hoursAgo(30),
      messages: {
        create: [
          {
            authorName: 'Sneha Kulkarni',
            role: 'AUTHOR',
            body:
              'I signed off on the PDF proof v2 for Midnight in Mysore yesterday. Could you confirm when proofreading starts ' +
              'and whether the physical advance proof will be dispatched to me? I would like to plan my launch announcement around it.',
            createdAt: hoursAgo(30),
          },
          {
            authorName: 'BookLeaf Support',
            role: 'SYSTEM',
            body: systemAck('Sneha', 'TKT-8879', 'Book Status & Production'),
            createdAt: minutesAgo(1791),
          },
        ],
      },
      events: {
        create: [
          {
            actorName: 'Sneha Kulkarni',
            type: 'CREATED',
            description: 'Sneha Kulkarni submitted this ticket via the author portal.',
            createdAt: hoursAgo(30),
          },
          {
            actorName: 'BookLeaf Triage',
            type: 'AI_TRIAGE',
            description:
              'AI classified this ticket as Book Status & Production (90% confidence) and set priority MEDIUM.',
            createdAt: minutesAgo(1791),
          },
        ],
      },
    },
    {
      publicId: 'TKT-8871',
      author: { connect: { id: 'AUTH008' } },
      book: { connect: { id: 'BK014' } },
      subject: 'Ghazal of the Forgotten is missing from Flipkart',
      description:
        'My poetry collection is live on Amazon India and the BookLeaf Store, but when I search Flipkart it does not appear at all. ' +
        'It was supposed to be on Flipkart as part of the standard distribution. Can you check why it was excluded and list it?',
      category: 'DISTRIBUTION_AVAILABILITY',
      categorySource: 'AI',
      aiCategory: 'DISTRIBUTION_AVAILABILITY',
      aiConfidence: 0.92,
      priority: 'MEDIUM',
      prioritySource: 'AI',
      aiPriority: 'MEDIUM',
      aiPriorityReason: 'Channel coverage gap on a live title; affects reach but the book remains purchasable elsewhere.',
      status: 'OPEN',
      createdAt: hoursAgo(52),
      lastMessageAt: hoursAgo(52),
      messages: {
        create: [
          {
            authorName: 'Farhan Sheikh',
            role: 'AUTHOR',
            body:
              'My poetry collection is live on Amazon India and the BookLeaf Store, but when I search Flipkart it does not appear at all. ' +
              'It was supposed to be on Flipkart as part of the standard distribution. Can you check why it was excluded and list it?',
            createdAt: hoursAgo(52),
          },
          {
            authorName: 'BookLeaf Support',
            role: 'SYSTEM',
            body: systemAck('Farhan', 'TKT-8871', 'Distribution & Availability'),
            createdAt: minutesAgo(3109),
          },
        ],
      },
      events: {
        create: [
          {
            actorName: 'Farhan Sheikh',
            type: 'CREATED',
            description: 'Farhan Sheikh submitted this ticket via the author portal.',
            createdAt: hoursAgo(52),
          },
          {
            actorName: 'BookLeaf Triage',
            type: 'AI_TRIAGE',
            description:
              'AI classified this ticket as Distribution & Availability (92% confidence) and set priority MEDIUM.',
            createdAt: minutesAgo(3109),
          },
        ],
      },
    },
    {
      publicId: 'TKT-8865',
      author: { connect: { id: 'AUTH006' } },
      subject: 'Can I update my author bio on the Amazon author page?',
      description:
        'I would like to update my author bio and add my new podcast to the profile. Is that something I can do from the dashboard, ' +
        'or do I need to email the team? Also, how long does it usually take to reflect on Amazon?',
      category: 'GENERAL_INQUIRY',
      categorySource: 'AI',
      aiCategory: 'GENERAL_INQUIRY',
      aiConfidence: 0.88,
      priority: 'LOW',
      prioritySource: 'AI',
      aiPriority: 'LOW',
      aiPriorityReason: 'Low-impact account/metadata request with no revenue or catalogue-integrity impact.',
      status: 'CLOSED',
      assignedTo: { connect: { id: adminPrimary.id } },
      firstResponseAt: hoursAgo(70),
      createdAt: hoursAgo(73),
      lastMessageAt: hoursAgo(60),
      resolvedAt: hoursAgo(60),
      closedAt: hoursAgo(60),
      messages: {
        create: [
          {
            authorName: 'Arjun Malhotra',
            role: 'AUTHOR',
            body:
              'I would like to update my author bio and add my new podcast to the profile. Is that something I can do from the dashboard, ' +
              'or do I need to email the team? Also, how long does it usually take to reflect on Amazon?',
            createdAt: hoursAgo(73),
          },
          {
            authorName: 'BookLeaf Support',
            role: 'SYSTEM',
            body: systemAck('Arjun', 'TKT-8865', 'General Inquiry'),
            createdAt: minutesAgo(4369),
          },
          {
            userId: adminPrimary.id,
            authorName: 'Pooja Mehta',
            role: 'ADMIN',
            body:
              'Hi Arjun,\n\nYes — author bio and profile updates can be submitted from your dashboard (My Books → profile details) ' +
              'or by replying here with the exact text you want. Changes typically reflect on Amazon and Flipkart within 3-5 business days.\n\n' +
              'Next step: send me the bio text and podcast link, and I will submit the metadata update for you today.\n\nWarmly,\nBookLeaf Author Support',
            createdAt: hoursAgo(70),
          },
          {
            authorName: 'Arjun Malhotra',
            role: 'AUTHOR',
            body: 'That worked, thank you. You can close this ticket.',
            createdAt: hoursAgo(60),
          },
        ],
      },
      events: {
        create: [
          {
            actorName: 'Arjun Malhotra',
            type: 'CREATED',
            description: 'Arjun Malhotra submitted this ticket via the author portal.',
            createdAt: hoursAgo(73),
          },
          {
            actorName: 'BookLeaf Triage',
            type: 'AI_TRIAGE',
            description:
              'AI classified this ticket as General Inquiry (88% confidence) and set priority LOW.',
            createdAt: minutesAgo(4369),
          },
          {
            actorId: adminPrimary.id,
            actorName: 'Pooja Mehta',
            type: 'PUBLIC_REPLY',
            description: 'Pooja Mehta replied to the author.',
            createdAt: hoursAgo(70),
          },
          {
            actorName: 'Arjun Malhotra',
            type: 'CLOSED',
            description: 'Ticket closed by the author.',
            createdAt: hoursAgo(60),
          },
        ],
      },
    },
    {
      publicId: 'TKT-8854',
      author: { connect: { id: 'AUTH002' } },
      book: { connect: { id: 'BK004' } },
      subject: 'Q2 royalty statement mismatch for Startup Sutra',
      description:
        'The Q2 statement for Startup Sutra shows 1,203 lifetime copies but the Flipkart dashboard I can see says more. ' +
        'I am not sure the platform commission is being applied correctly either. Can someone reconcile the numbers and send ' +
        'a line-by-line statement? This is urgent because my CA needs it for tax filing.',
      category: 'ROYALTY_PAYMENTS',
      categorySource: 'AI',
      aiCategory: 'ROYALTY_PAYMENTS',
      aiConfidence: 0.95,
      priority: 'HIGH',
      prioritySource: 'AI',
      aiPriority: 'HIGH',
      aiPriorityReason: 'Financial reconciliation request tied to tax filing; needs a detailed statement.',
      status: 'IN_PROGRESS',
      assignedTo: { connect: { id: adminPrimary.id } },
      firstResponseAt: hoursAgo(92),
      createdAt: hoursAgo(97),
      lastMessageAt: hoursAgo(92),
      messages: {
        create: [
          {
            authorName: 'Rohit Kapoor',
            role: 'AUTHOR',
            body:
              'The Q2 statement for Startup Sutra shows 1,203 lifetime copies but the Flipkart dashboard I can see says more. ' +
              'I am not sure the platform commission is being applied correctly either. Can someone reconcile the numbers and send ' +
              'a line-by-line statement? This is urgent because my CA needs it for tax filing.',
            createdAt: hoursAgo(97),
          },
          {
            authorName: 'BookLeaf Support',
            role: 'SYSTEM',
            body: systemAck('Rohit', 'TKT-8854', 'Royalty & Payments'),
            createdAt: minutesAgo(5791),
          },
          {
            userId: adminPrimary.id,
            authorName: 'Pooja Mehta',
            role: 'ADMIN',
            body:
              'Hi Rohit,\n\nUnderstood — a tax-filing deadline makes this time-sensitive, so I am treating it accordingly.\n\n' +
              'I have requested a line-by-line reconciliation from finance covering the Flipkart settlement cycle, platform commission ' +
              'and the 80/20 split. Startup Sutra currently shows ₹57,744 earned, ₹50,000 paid and ₹7,744 pending in our system. ' +
              'We will send the detailed statement as a CSV/PDF on this ticket within 48 hours so your CA has the figures in writing.\n\n' +
              'Next step: the finance reconciliation is in progress; expect the statement here within 48 hours.\n\nWarmly,\nBookLeaf Author Support',
            createdAt: hoursAgo(92),
          },
        ],
      },
      events: {
        create: [
          {
            actorName: 'Rohit Kapoor',
            type: 'CREATED',
            description: 'Rohit Kapoor submitted this ticket via the author portal.',
            createdAt: hoursAgo(97),
          },
          {
            actorName: 'BookLeaf Triage',
            type: 'AI_TRIAGE',
            description:
              'AI classified this ticket as Royalty & Payments (95% confidence) and set priority HIGH.',
            createdAt: minutesAgo(5791),
          },
          {
            actorId: adminPrimary.id,
            actorName: 'Pooja Mehta',
            type: 'PUBLIC_REPLY',
            description: 'Pooja Mehta replied to the author.',
            createdAt: hoursAgo(92),
          },
        ],
      },
    },
  ];

  for (const ticket of tickets) {
    await prisma.ticket.create({ data: ticket });
  }

  // --- AI telemetry (makes the cost dashboard meaningful on first load) -----
  await prisma.aiUsage.createMany({
    data: [
      { operation: 'CLASSIFY', model: 'openai/gpt-oss-20b', promptTokens: 420, completionTokens: 78, latencyMs: 612, estimatedCostUsd: 0.00011, success: true, cached: false, createdAt: minutesAgo(330) },
      { operation: 'DRAFT', model: 'openai/gpt-oss-120b', promptTokens: 1180, completionTokens: 362, latencyMs: 2410, estimatedCostUsd: 0.00039, success: true, cached: false, createdAt: minutesAgo(328) },
      { operation: 'CLASSIFY', model: 'openai/gpt-oss-20b', promptTokens: 388, completionTokens: 71, latencyMs: 508, estimatedCostUsd: 0.0001, success: true, cached: false, createdAt: hoursAgo(2.2) },
      { operation: 'DRAFT', model: 'openai/gpt-oss-120b', promptTokens: 1044, completionTokens: 298, latencyMs: 2190, estimatedCostUsd: 0.00034, success: true, cached: false, createdAt: minutesAgo(46) },
      { operation: 'CLASSIFY', model: 'bookleaf-rules-v1', promptTokens: 0, completionTokens: 0, latencyMs: 0, estimatedCostUsd: 0, success: true, fallback: true, createdAt: hoursAgo(8) },
      { operation: 'DRAFT', model: 'openai/gpt-oss-120b', promptTokens: 1180, completionTokens: 362, latencyMs: 0, estimatedCostUsd: 0, success: true, cached: true, createdAt: hoursAgo(3) },
      { operation: 'CLASSIFY', model: 'openai/gpt-oss-20b', promptTokens: 405, completionTokens: 65, latencyMs: 544, estimatedCostUsd: 0.0001, success: true, cached: false, createdAt: hoursAgo(26) },
      { operation: 'DRAFT', model: 'openai/gpt-oss-120b', promptTokens: 1320, completionTokens: 410, latencyMs: 2680, estimatedCostUsd: 0.00044, success: true, cached: false, createdAt: hoursAgo(30) },
      { operation: 'CLASSIFY', model: 'openai/gpt-oss-20b', promptTokens: 396, completionTokens: 72, latencyMs: 501, estimatedCostUsd: 0.0001, success: true, cached: false, createdAt: hoursAgo(52) },
      { operation: 'DRAFT', model: 'openai/gpt-oss-120b', promptTokens: 1090, completionTokens: 320, latencyMs: 2310, estimatedCostUsd: 0.00036, success: true, cached: false, createdAt: hoursAgo(70) },
    ],
  });

  const counts = {
    authors: await prisma.author.count(),
    books: await prisma.book.count(),
    users: await prisma.user.count(),
    tickets: await prisma.ticket.count(),
    messages: await prisma.message.count(),
  };

  console.log('Seed complete:', counts);
  console.log('');
  console.log('Demo logins (password: bookleaf123)');
  console.log('  Author: priya.sharma@email.com  (2 books, live + pending royalty)');
  console.log('  Author: meera.nair@email.com    (distribution issue)');
  console.log('  Admin:  admin@bookleaf.in       (Pooja Mehta, ops lead)');
  console.log('  Admin:  raghav@bookleaf.in      (Raghav Sharma, production)');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
