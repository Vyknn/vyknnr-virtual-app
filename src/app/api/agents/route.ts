import { ROSTER } from '@/core/roster';

export function GET() {
  return Response.json({ agents: ROSTER });
}
