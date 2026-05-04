import request from 'supertest';
import app from '../app.js';
import { describe, expect, it, afterAll } from '@jest/globals';
import { prisma } from '../lib/prisma.js';
describe('GET /api/profiles/search', () => {
  it('should return 401 when no authentication is provided', async () => {
    const response = await request(app)
      .get('/api/profiles/search?q=victor')
      .set('X-API-Version', '1')
      .expect(401);
    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Unauthorized');
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });
});
