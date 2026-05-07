import request from 'supertest';
import app from '../app.js';
import { describe, expect, it, beforeAll, afterAll, jest } from '@jest/globals';
import { prisma } from '../lib/prisma.js';
import { uploadQueue } from '../queues/upload.queue.js';
import { worker } from '../workers/upload.worker.js';
import { connection } from '../lib/queue.js';

const TEST_JWT_SECRET = 'test-queue-jwt-secret';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET = TEST_JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

  jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
    id: 'test-user-id',
    github_id: '12345',
    username: 'admin',
    email: 'admin@test.com',
    avatar_url: 'https://example.com/avatar.png',
    role: 'ADMIN',
    is_active: true,
    last_login_at: null,
    created_at: new Date(),
  } as never);
});

afterAll(async () => {
  jest.restoreAllMocks();
  await prisma.$disconnect();
});

describe('GET /api/profiles/upload/:jobId', () => {
  it('should return 401 when no authentication is provided', async () => {
    const response = await request(app)
      .get('/api/profiles/upload/some-job-id')
      .set('X-API-Version', '1')
      .expect(401);
    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Unauthorized');
  });
});

describe('BullMQ module exports', () => {
  it('should export a Redis connection', () => {
    expect(connection).toBeDefined();
  });

  it('should export an upload queue instance', () => {
    expect(uploadQueue).toBeDefined();
    expect(uploadQueue).not.toBeNull();
  });

  it('should export a worker instance', () => {
    expect(worker).toBeDefined();
    expect(worker).not.toBeNull();
  });

  it('should have closeQueue function on uploadQueue', () => {
    expect(typeof uploadQueue?.close).toBe('function');
  });

  it('should have close function on worker', () => {
    expect(typeof worker?.close).toBe('function');
  });
});
