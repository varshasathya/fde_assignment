// app/api/recommend/route.js — AI recommendation engine (Stage 3, Option A).
// Runs server-side so OPENROUTER_API_KEY is never exposed to the browser.
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const SYSTEM_PROMPT = `You are SliceMatic's friendly in-app pizza concierge for an outlet in New Ashok Nagar, Delhi.
Recommend exactly ONE combination of crust + pizza + one topping from the menu, in ONE warm sentence (max 30 words).
If the customer has order history, build on what they liked before. If they are new, suggest a crowd-pleaser.
Never invent items that are not on the menu. Do not mention prices. Output only the sentence, no preamble.`;

export async function POST(req) {
  try {
    const { phone, name } = await req.json();

    // 1. Pull this customer's recent orders (server-side, service-role key).
    let history = [];
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && serviceKey && phone) {
      try {
        const admin = createClient(url, serviceKey);
        const { data } = await admin
          .from("orders")
          .select("id, created_at, order_items(name, category)")
          .eq("phone", phone)
          .order("created_at", { ascending: false })
          .limit(5);
        history = data || [];
      } catch { /* ignore — treat as new customer */ }
    }

    const key = process.env.OPENROUTER_API_KEY;
    const model = process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct";

    // Graceful fallback if AI isn't configured — the app still works.
    if (!key) {
      const text = history.length
        ? "Welcome back! Try a Cheese Burst BBQ Chicken with Extra Cheese — a regular favourite."
        : "First time? Go for a Thick Crust Farm House with Caramelised Onions — our most-loved combo.";
      return Response.json({ recommendation: text, model: "fallback (no OpenRouter key)" });
    }

    const historyText = history.length
      ? "Past orders: " + history.map((o) =>
          (o.order_items || []).map((i) => i.name).join(" + ")).join("; ")
      : "No past orders (new customer).";

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Customer ${name || "guest"}. ${historyText} Give one recommendation.` },
        ],
        max_tokens: 80,
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      return Response.json({ recommendation: "Try a Thick Crust Farm House with Caramelised Onions — a house favourite.", model: "fallback" });
    }
    const json = await resp.json();
    const text = json?.choices?.[0]?.message?.content?.trim() || "";
    return Response.json({ recommendation: text, model });
  } catch (e) {
    return Response.json({ recommendation: "", model: "" }, { status: 200 });
  }
}
