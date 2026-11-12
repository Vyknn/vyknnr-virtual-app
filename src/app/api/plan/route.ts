import { makePlan } from '@/core/planner';

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { body = null; }
  const text = (body as { text?: unknown } | null)?.text;
  if (typeof text !== 'string') return Response.json({ error: 'text (string) required' }, { status: 400 });
  return Response.json(makePlan(text));
}
