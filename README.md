# Pixel Forge Studio — AI Agent Orchestrator

จำลองออฟฟิศ AI Agent แบบ 3 มิติ ไอโซเมตริก ผู้ใช้พิมพ์คำสั่งภาษาไทย → AI Core วางแผน (task graph) → แจกงานให้ agent แต่ละคนเดินไปทำงานที่โต๊ะ/server rack พร้อม telemetry แบบ real-time

Stack: Next.js 16, React 19, React Three Fiber, zustand, Tailwind 4.

## เริ่มต้นใช้งาน

```bash
npm install
npm run dev
```

เปิด http://localhost:3000 หรือ http://localhost:3000/?demo=1

`?demo=1` = auto-submit คำสั่ง "ทำเกมใหม่แนว puzzle" ตอนโหลดหน้า (ใช้ demo/ถ่ายภาพ)

## ลองคำสั่งเหล่านี้

- `ทำ API login ให้เกม Space Run`
- `ทำเกมใหม่แนว puzzle`
- `deploy server ใหม่`
- `ทำโลโก้เกม`
- `สวัสดี` — คำสั่งไม่ชัด ระบบจะตอบเป็น clarification request

## ควบคุมกล้อง

- ลาก (drag) = pan
- scroll wheel = zoom
- `Q` / `E` = หมุนกล้อง
- คลิก agent = เลือก + โฟกัส + เปิด Agent detail

## สถาปัตยกรรม

```
src/core/      pure sim: roster, office, pathfinding, planner, steps, sim (ไม่มี React/three)
src/services/  OrchestratorService (interface) + MockOrchestratorService
src/store/     useOfficeStore (zustand)
src/scene/     3D scene (R3F): office, avatars, effects
src/ui/        dashboard panels (TopBar, chat, plan graph, telemetry, AgentDetail)
src/app/api/   contract routes: /api/agents, /api/plan
```

Data flow:

```
core sim ──events/state──> service ──subscribe──> store ──selectors──> scene (useFrame) + UI (throttled)
                              ^                      |
                              └──── submit(cmd) ─────┘ (UI chat → store → service)
```

- `core` เป็น pure function/ state ล้วน ทดสอบได้ไม่ต้องมี DOM
- `service` ห่อ sim ด้วย tick loop + speed; ส่ง `SimEvent` ให้ store
- `store` เก็บ `SimState` ล่าสุด; scene อ่านผ่าน `getState()` ใน frame loop, UI อ่านผ่าน throttled selector

## เสียบ AI จริงภายหลัง

1. เขียน class ใหม่ที่ `implements OrchestratorService` (`src/services/orchestrator.ts`): `submit`, `setSpeed`, `subscribe`, `getState`, `start`, `stop`
2. ส่ง `SimEvent` stream เดิม (เช่น ผ่าน SSE) เข้า listener — store/scene/UI ไม่ต้องแก้
3. สลับ service ที่ store สร้างจาก `MockOrchestratorService` เป็นตัวใหม่
4. ดู contract ที่ `src/app/api/plan/route.ts`: `POST /api/plan` body `{ "text": string }` → คืน plan (หรือ clarification); 400 ถ้า `text` ไม่ใช่ string. `GET /api/agents` คืน `{ agents: ROSTER }`. ใช้เป็นจุดเริ่มสำหรับ LLM planner ฝั่ง server (ดู spec §9.5)

Spec: `docs/superpowers/specs/2026-11-12-pixel-forge-agent-office-design.md`

## ทดสอบ

```bash
npm test
```

## Known limitations

- ยังไม่ได้ตรวจ visual จริงที่ความละเอียด 1600×900
- ค่า bloom และ emissive ยังต้อง tune
- หน้าตา agent (ผม/สีผิว/เสื้อ) derive จาก hash ของ agent id จึงอาจซ้ำ/ไม่ตรงใจ ปรับได้ที่ roster
