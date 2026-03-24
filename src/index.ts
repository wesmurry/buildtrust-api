import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './config/env.js';
import { errorHandler } from './utils/errors.js';
import { projectRoutes } from './routes/projects.js';
import { tradeRoutes } from './routes/trades.js';
import { budgetRoutes } from './routes/budget.js';
import { bidRoutes } from './routes/bids.js';
import { changeOrderRoutes } from './routes/change-orders.js';
import { paymentRoutes } from './routes/payments.js';
import { scheduleRoutes } from './routes/schedule.js';
import { materialRoutes } from './routes/materials.js';
import { selectionRoutes } from './routes/selections.js';
import { inspectionRoutes } from './routes/inspections.js';
import { savingsRoutes } from './routes/savings.js';
import { planRoutes } from './routes/plans.js';

const app = Fastify({ logger: true });

// CORS
await app.register(cors, {
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
});

// Error handler
app.setErrorHandler(errorHandler);

// Health check
app.get('/health', async () => ({ status: 'ok' }));

// Routes
await app.register(projectRoutes);
await app.register(tradeRoutes);
await app.register(budgetRoutes);
await app.register(bidRoutes);
await app.register(changeOrderRoutes);
await app.register(paymentRoutes);
await app.register(scheduleRoutes);
await app.register(materialRoutes);
await app.register(selectionRoutes);
await app.register(inspectionRoutes);
await app.register(savingsRoutes);
await app.register(planRoutes);

// Start
try {
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
  console.log(`BuildTrust API running on port ${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

export { app };
