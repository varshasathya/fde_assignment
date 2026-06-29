// app/api/notify/route.js
// Forwards a completed order to your n8n webhook (which sends the WhatsApp messages).
// The webhook URL stays server-side. Best-effort: never blocks or fails the order.
export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const order = await req.json();
    const url = process.env.N8N_WEBHOOK_URL;
    if (!url) return Response.json({ notified: false, reason: "N8N_WEBHOOK_URL not set" });

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    return Response.json({ notified: r.ok });
  } catch (e) {
    // Swallow errors — a down webhook must not break checkout.
    return Response.json({ notified: false, error: String(e) }, { status: 200 });
  }
}
