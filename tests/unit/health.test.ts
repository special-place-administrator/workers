import Fastify from 'fastify';
import { healthRoutes } from '../../src/routes/health';

describe('health route', () => {
  it('returns ok', async () => {
    const app = Fastify();
    await app.register(healthRoutes);
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });
});
