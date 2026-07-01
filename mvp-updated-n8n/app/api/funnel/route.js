// mvp-updated-n8n/app/api/funnel/route.js — Event logging and secure aggregation API
import { createFunnelEvent, getFunnelMetrics } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const event = await createFunnelEvent(body);
    return Response.json({ ok: true, event });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const authHeader = req.headers.get("authorization");
    const pwd = authHeader ? authHeader.replace("Bearer ", "").trim() : "";
    const expectedPwd = process.env.ADMIN_PASSWORD || "slicematic123";

    if (pwd !== expectedPwd) {
      return Response.json({ error: "Unauthorized access to funnel analytics" }, { status: 401 });
    }

    const metrics = await getFunnelMetrics();
    return Response.json({ success: true, metrics });
  } catch (e) {
    return Response.json({ success: false, error: String(e) }, { status: 500 });
  }
}
