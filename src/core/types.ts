export type DeptId = 'ceo'|'producer'|'gamedev'|'graphic'|'frontend'|'backend'|'mobile'|'qa'|'sound'|'marketing'|'account';
export type SkillId = string; // e.g. 'write_code', 'generate_image'
export type Cell = { x: number; z: number };
export interface AgentDef { id: string; name: string; dept: DeptId; title: string; personality: string;
  color: string; skills: SkillId[]; tools: string[]; keywords: string[]; idleStyle: 'sofa'|'coffee'|'pingpong'|'wander'|'chat';
  voice: { accept: string[]; done: string[] } }
export type AgentState = 'idle'|'walking_to_work'|'working'|'done'|'walking_to_lounge';
export interface AgentRuntime { id: string; state: AgentState; cell: Cell; pos: { x: number; z: number };
  path: Cell[]; heading: number; currentNodeId: string | null; queue: string[]; doneToday: number;
  /** Absolute sim time (s) at which the current state began. */
  stateTime: number }
export type NodeStatus = 'blocked'|'ready'|'queued'|'running'|'done';
export interface AgentStep { kind: 'thinking'|'tool_call'|'tool_result'|'output'; text: string; tool?: string; args?: Record<string,string>; at: number; duration: number }
export interface TaskNode { id: string; jobId: string; title: string; skill: SkillId; assigneeId: string;
  dependsOn: string[]; status: NodeStatus; workplace: 'desk'|'rack'; steps: AgentStep[]; stepIndex: number;
  stepElapsed: number; inputs: string[]; output: Deliverable | null }
export type Deliverable = { kind: 'code'; files: string[]; snippet: string } | { kind: 'image'; title: string; palette: string[] }
  | { kind: 'numbers'; rows: [string, string][] } | { kind: 'text'; text: string };
export interface Job { id: string; command: string; color: string; status: 'planning'|'running'|'done';
  nodeIds: string[]; createdAt: number; planningLeft: number; summary: string | null }
export interface ChatMessage { id: string; from: 'admin'|'core'|string; text: string; at: number; jobId?: string; deliverable?: Deliverable }
