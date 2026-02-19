import { describe, it, expect } from 'vitest';
import express, { type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { doubleCsrfProtection, generateCsrfToken } from './csrf';

function createCsrfTestApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());

  // Route to generate CSRF token (simulates login setting the cookie)
  app.get('/csrf-token', (req: Request, res: Response) => {
    const token = generateCsrfToken(req, res);
    res.json({ csrfToken: token });
  });

  // Protected route
  app.post('/protected', doubleCsrfProtection, (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  // GET route (should be ignored by CSRF)
  app.get('/public', doubleCsrfProtection, (_req: Request, res: Response) => {
    res.json({ success: true });
  });

  // Error handler
  app.use((err: Error & { statusCode?: number }, _req: Request, res: Response, _next: express.NextFunction) => {
    res.status(err.statusCode ?? 403).json({
      success: false,
      error: { code: 'CSRF_VALIDATION_FAILED', message: err.message },
    });
  });

  return app;
}

describe('CSRF middleware', () => {
  it('passes when X-CSRF-Token header matches cookie token', async () => {
    const app = createCsrfTestApp();

    // Get a CSRF token and cookie
    const tokenRes = await request(app).get('/csrf-token');
    const csrfToken = tokenRes.body.csrfToken;
    const cookies = tokenRes.headers['set-cookie'];

    expect(csrfToken).toBeTruthy();
    expect(cookies).toBeDefined();

    // Extract the __csrf cookie string
    const csrfCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith('__csrf'))
      : cookies;
    expect(csrfCookie).toBeDefined();

    // Make protected request with matching header and cookie
    const res = await request(app)
      .post('/protected')
      .set('Cookie', csrfCookie!)
      .set('X-CSRF-Token', csrfToken);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects POST when X-CSRF-Token header is missing', async () => {
    const app = createCsrfTestApp();

    const tokenRes = await request(app).get('/csrf-token');
    const cookies = tokenRes.headers['set-cookie'];
    const csrfCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith('__csrf'))
      : cookies;

    const res = await request(app)
      .post('/protected')
      .set('Cookie', csrfCookie!);

    expect(res.status).toBe(403);
  });

  it('rejects POST when header does not match cookie', async () => {
    const app = createCsrfTestApp();

    const tokenRes = await request(app).get('/csrf-token');
    const cookies = tokenRes.headers['set-cookie'];
    const csrfCookie = Array.isArray(cookies)
      ? cookies.find((c: string) => c.startsWith('__csrf'))
      : cookies;

    const res = await request(app)
      .post('/protected')
      .set('Cookie', csrfCookie!)
      .set('X-CSRF-Token', 'totally-wrong-token');

    expect(res.status).toBe(403);
  });

  it('skips GET/HEAD/OPTIONS methods', async () => {
    const app = createCsrfTestApp();

    // GET should pass without CSRF
    const res = await request(app).get('/public');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('rejects POST with missing CSRF cookie', async () => {
    const app = createCsrfTestApp();

    const res = await request(app)
      .post('/protected')
      .set('X-CSRF-Token', 'some-token');

    expect(res.status).toBe(403);
  });
});
