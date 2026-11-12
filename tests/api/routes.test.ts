import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/plan/route';
import { GET } from '@/app/api/agents/route';

const req = (body: string) => new Request('http://x/api/plan', { method: 'POST', body });

describe('api', () => {
  it('plan 400 on missing/non-string text', async () => {
    expect((await POST(req('{}'))).status).toBe(400);
    expect((await POST(req('{"text":5}'))).status).toBe(400);
    expect((await POST(req('nope'))).status).toBe(400);
  });
  it('plan ok', async () => {
    const r = await POST(req('{"text":"deploy server"}'));
    expect(r.status).toBe(200);
    expect(Array.isArray((await r.json()).nodes)).toBe(true);
  });
  it('agents', async () => {
    expect(Array.isArray((await GET().json()).agents)).toBe(true);
  });
});
