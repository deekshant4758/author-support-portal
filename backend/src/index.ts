import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

const start = async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      'Could not connect to the database. Run `npm run setup` inside backend/ first.\n',
      error,
    );
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '  BookLeaf Author Support API',
        `  → http://localhost:${env.PORT}`,
        `  → Docs   http://localhost:${env.PORT}/api/docs`,
        `  → AI     ${env.aiConfigured ? `Groq (${env.GROQ_MODEL_CLASSIFY} / ${env.GROQ_MODEL_DRAFT})` : 'heuristic mode (no GROQ_API_KEY)'}`,
        `  → CORS   ${env.allowedOrigins.join(', ')}`,
        '',
      ].join('\n'),
    );
  });

  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n[server] ${signal} received, shutting down...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
};

void start();
