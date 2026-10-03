import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

let impl: (t: string) => Promise<any> = async () => { throw new Error('unset'); };
const verifyIdToken = {
  mockResolvedValue: (v: any) => { impl = async () => v; },
  mockImplementation: (f: any) => { impl = f; },
  mockReset: () => { impl = async () => { throw new Error('unset'); }; },
  call: (t: string) => impl(t),
};

vi.mock('../../config/env', () => ({
  env: { AI_GATEWAY_SECRET: 'test-gateway-secret-0123456789', NODE_ENV: 'test' },
}));
vi.mock('../../config/firebase', () => ({
  getFirebaseAuth: () => ({ verifyIdToken: (t: string) => impl(t) }),
  getFirestore: () => null,
}));

import { requireAuth, requireRole, requireService, optionalAuth, ROLE_GROUPS } from '../auth';

function mockRes() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (c: number) => { res.statusCode = c; return res; };
  res.json = (b: any) => { res.body = b; return res; };
  return res;
}

function signed(body: any, secret = 'test-gateway-secret-0123456789', ts = Date.now()) {
  const timestamp = String(ts);
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}:${JSON.stringify(body)}`).digest('hex');
  return { 'x-ai-signature': signature, 'x-ai-timestamp': timestamp };
}

async function run(mw: any, req: any) {
  const res = mockRes();
  let called = false;
  await mw(req, res, () => { called = true; });
  return { res, called };
}

beforeEach(() => verifyIdToken.mockReset());

describe('AI auth — user (Firebase ID token)', () => {
  it('rejects a missing token', async () => {
    const { res, called } = await run(requireAuth, { headers: {}, body: {} });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('does NOT treat an Authorization header as authentication (invalid token => 401)', async () => {
    verifyIdToken.mockImplementation(async () => { throw Object.assign(new Error('bad'), { code: 'auth/argument-error' }); });
    const { res, called } = await run(requireAuth, { headers: { authorization: 'Bearer anything' }, body: {} });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('rejects an expired token', async () => {
    verifyIdToken.mockImplementation(async () => { throw Object.assign(new Error('expired'), { code: 'auth/id-token-expired' }); });
    const { res } = await run(requireAuth, { headers: { authorization: 'Bearer old' }, body: {} });
    expect(res.statusCode).toBe(401);
  });

  it('accepts a verified token and attaches the principal', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1', email: 'c@x.com', email_verified: true, role: 'customer' });
    const req: any = { headers: { authorization: 'Bearer good' }, body: {} };
    const { called } = await run(requireAuth, req);
    expect(called).toBe(true);
    expect(req.principal).toMatchObject({ uid: 'u1', role: 'customer', kind: 'user', idToken: 'good' });
  });

  it('optionalAuth lets anonymous through but rejects a presented-but-invalid token', async () => {
    expect((await run(optionalAuth, { headers: {}, body: {} })).called).toBe(true);
    verifyIdToken.mockImplementation(async () => { throw new Error('bad'); });
    const r = await run(optionalAuth, { headers: { authorization: 'Bearer bad' }, body: {} });
    expect(r.called).toBe(false);
    expect(r.res.statusCode).toBe(401);
  });

  it('wrong role => 403 on publish; owner allowed', async () => {
    const publishers = requireRole(ROLE_GROUPS.PUBLISHERS);
    verifyIdToken.mockResolvedValue({ uid: 'u1', role: 'customer' });
    const denied = await run(publishers, { headers: { authorization: 'Bearer t' }, body: {} });
    expect(denied.res.statusCode).toBe(403);

    verifyIdToken.mockResolvedValue({ uid: 'o1', role: 'owner' });
    const ok = await run(publishers, { headers: { authorization: 'Bearer t' }, body: {} });
    expect(ok.called).toBe(true);
  });

  it('a client-supplied role in the body/claims-less token never elevates (customer stays customer)', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'u1' });
    const req: any = { headers: { authorization: 'Bearer t' }, body: { role: 'owner' } };
    const r = await run(requireRole(ROLE_GROUPS.PUBLISHERS), req);
    expect(r.res.statusCode).toBe(403);
  });
});

describe('AI auth — service (HMAC)', () => {
  it('accepts a valid signature', async () => {
    const body = { eventType: 'MENU_UPDATED' };
    const { called } = await run(requireService, { headers: signed(body), body });
    expect(called).toBe(true);
  });

  it('rejects a wrong secret', async () => {
    const body = { eventType: 'X' };
    const { res, called } = await run(requireService, { headers: signed(body, 'wrong-secret-wrong-secret'), body });
    expect(called).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('rejects an expired timestamp', async () => {
    const body = { eventType: 'X' };
    const { called } = await run(requireService, { headers: signed(body, undefined, Date.now() - 10 * 60 * 1000), body });
    expect(called).toBe(false);
  });

  it('rejects a tampered body', async () => {
    const headers = signed({ eventType: 'A' });
    const { called } = await run(requireService, { headers, body: { eventType: 'B' } });
    expect(called).toBe(false);
  });

  it('rejects a replayed signature', async () => {
    const body = { eventType: 'REPLAY' };
    const headers = signed(body);
    expect((await run(requireService, { headers, body })).called).toBe(true);
    expect((await run(requireService, { headers, body })).called).toBe(false);
  });

  it('a user token is NOT accepted on a service-only route', async () => {
    verifyIdToken.mockResolvedValue({ uid: 'o1', role: 'owner' });
    const { called } = await run(requireService, { headers: { authorization: 'Bearer t' }, body: {} });
    expect(called).toBe(false);
  });
});
