import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from './app';

describe('GET /api/health', () => {
  it('returns status ok with 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
