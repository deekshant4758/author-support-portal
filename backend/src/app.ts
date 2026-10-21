import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env';
import { authRouter } from './routes/auth.routes';
import { authorsRouter } from './routes/authors.routes';
import { booksRouter } from './routes/books.routes';
import { ticketsRouter } from './routes/tickets.routes';
import { adminRouter } from './routes/admin.routes';
import { knowledgeRouter } from './routes/knowledge.routes';
import { eventsRouter } from './routes/events.routes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { openApiSpec } from './docs/openapi';
import { sseStats } from './services/eventBus';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      // Swagger UI uses inline scripts; the API itself has no HTML surface.
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`Origin ${origin} is not allowed by CORS.`));
      },
      credentials: false,
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(morgan(env.isProduction ? 'combined' : 'dev'));

  app.get('/health', (_req, res) => {
    res.json({
      data: {
        status: 'ok',
        uptimeSeconds: Math.round(process.uptime()),
        aiConfigured: env.aiConfigured,
        realtime: sseStats(),
      },
    });
  });

  app.get('/api/openapi.json', (_req, res) => {
    res.json(openApiSpec);
  });
  app.use(
    '/api/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'BookLeaf Support API',
      swaggerOptions: { persistAuthorization: true, docExpansion: 'list' },
    }),
  );

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/authors', authorsRouter);
  app.use('/api/v1/books', booksRouter);
  app.use('/api/v1/tickets', ticketsRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api/v1/knowledge-base', knowledgeRouter);
  app.use('/api/v1/events', eventsRouter);

  app.get('/', (_req, res) => {
    res.json({
      data: {
        name: 'BookLeaf Author Support & Communication Portal API',
        version: '1.0.0',
        docs: '/api/docs',
        health: '/health',
      },
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
