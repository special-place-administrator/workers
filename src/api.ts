import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { healthRoutes } from './routes/health';

dotenv.config();

const app = Fastify({ logger: true });
app.register(cors, { origin: true });
app.register(healthRoutes);

const port = Number(process.env.PORT) || 3001;

app.listen({ port, host: '0.0.0.0' })
  .then(() => {
    console.log(`API running on port ${port}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
