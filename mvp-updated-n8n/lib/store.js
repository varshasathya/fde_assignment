// mvp-updated-n8n/lib/store.js — Supabase order store & funnel state management
import { supabase } from "./supabase";

export const STATUSES = [
  "PLACED",
  "ACCEPTED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
];

// ---- Orders Store ----

export async function createOrder(orderData) {
  // Destructure properties explicitly to prevent parameter injection and status tampering
  const {
    name,
    phone,
    address,
    pincode,
    geo,
    items,
    itemsSummary,
    quantity,
    subtotal,
    discount,
    gst,
    total,
    payment_mode,
  } = orderData || {};

  const order = {
    name: (name ?? "").trim(),
    phone: (phone ?? "").trim(),
    address: address ?? "",
    pincode: (pincode ?? "").trim(),
    geo: geo ?? "",
    items: items ?? [],
    itemsSummary: itemsSummary ?? "",
    quantity: parseInt(quantity, 10) || 0,
    subtotal: parseFloat(subtotal) || 0.0,
    discount: parseFloat(discount) || 0.0,
    gst: parseFloat(gst) || 0.0,
    total: parseFloat(total) || 0.0,
    payment_mode: payment_mode ?? "Cash",
    createdAt: new Date().toISOString(),
    status: "PLACED", // Enforced status
  };

  const { data, error } = await supabase
    .from("orders")
    .insert(order)
    .select()
    .single();

  if (error) throw error;

  return data;
}

export async function listOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error("SUPABASE listOrders ERROR:", error);
    throw error;
  }

  return data || [];
}

export async function getOrder(id) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", Number(id))
    .single();

  if (error) return null;

  return data;
}

export async function getOrdersByPhone(phone) {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("phone", phone)
    .order("id", { ascending: false });

  if (error) throw error;

  return data || [];
}

export async function updateStatus(id, status) {
  if (!STATUSES.includes(status)) return null;

  const { data, error } = await supabase
    .from("orders")
    .update({
      status,
      updatedAt: new Date().toISOString(),
    })
    .eq("id", Number(id))
    .select()
    .single();

  if (error) return null;

  return data;
}

// ---- Funnel State Management Store ----

/**
 * Persists a funnel event to the DB, or falls back to local logging if database is offline.
 */
export async function createFunnelEvent(eventData) {
  const { sessionId, phone, stage, eventName, metadata } = eventData || {};
  const event = {
    session_id: sessionId,
    phone: phone || null,
    stage: stage,
    event_name: eventName,
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("funnel_events")
      .insert(event)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error("Supabase funnel logging failed, falling back to local storage:", err.message || err);
    try {
      const fs = await import("fs");
      const path = await import("path");
      const logDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFile = path.join(logDir, "funnel_log.jsonl");
      fs.appendFileSync(logFile, JSON.stringify(event) + "\n");
    } catch (fsErr) {
      console.error("Failed to write to local fallback funnel log:", fsErr);
    }
    return null;
  }
}

/**
 * Fetches all funnel events and computes aggregates for TOFU, MOFU, BOFU, and attach metrics.
 */
export async function getFunnelMetrics() {
  let events = [];
  try {
    const { data, error } = await supabase
      .from("funnel_events")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) throw error;
    events = data || [];
  } catch (err) {
    console.warn("Failed fetching funnel metrics from DB. Reading fallback log file:", err.message || err);
    try {
      const fs = await import("fs");
      const path = await import("path");
      const logFile = path.join(process.cwd(), "data", "funnel_log.jsonl");
      if (fs.existsSync(logFile)) {
        const content = fs.readFileSync(logFile, "utf8");
        events = content
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line));
      }
    } catch (fsErr) {
      console.error("Failed reading fallback log file:", fsErr);
    }
  }

  return computeFunnelMetricsFromEvents(events);
}

function computeFunnelMetricsFromEvents(events) {
  const sessions = {};

  for (const e of events) {
    const sId = e.session_id || "unknown";
    if (!sessions[sId]) {
      sessions[sId] = {
        sessionId: sId,
        started: false,
        intakeComplete: false,
        paymentSelection: false,
        orderCompleted: false,
        recommendationShown: false,
        recommendationAccepted: false,
        validationErrors: {},
      };
    }

    const s = sessions[sId];
    if (e.event_name === "SESSION_START") s.started = true;
    if (e.event_name === "INTAKE_COMPLETE") s.intakeComplete = true;
    if (e.event_name === "PAYMENT_SELECTED") s.paymentSelection = true;
    if (e.event_name === "ORDER_COMPLETED") s.orderCompleted = true;
    if (e.event_name === "RECOMMENDATION_SHOWN") s.recommendationShown = true;
    if (e.event_name === "RECOMMENDATION_ACCEPTED") s.recommendationAccepted = true;
    
    if (e.event_name === "VALIDATION_ERROR") {
      const field = e.metadata?.field || "unknown";
      s.validationErrors[field] = (s.validationErrors[field] || 0) + 1;
    }
  }

  const sessionList = Object.values(sessions);
  const totalSessions = sessionList.length;
  const reachedBuild = sessionList.filter((s) => s.intakeComplete || s.paymentSelection || s.orderCompleted).length;
  const reachedPayment = sessionList.filter((s) => s.paymentSelection || s.orderCompleted).length;
  const completedOrder = sessionList.filter((s) => s.orderCompleted).length;

  const recShownCount = sessionList.filter((s) => s.recommendationShown).length;
  const recAcceptedCount = sessionList.filter((s) => s.recommendationAccepted).length;

  const errorCounts = {};
  for (const s of sessionList) {
    for (const [field, count] of Object.entries(s.validationErrors)) {
      errorCounts[field] = (errorCounts[field] || 0) + count;
    }
  }

  return {
    totalSessions,
    reachedBuild,
    reachedPayment,
    completedOrder,
    recShownCount,
    recAcceptedCount,
    errorCounts,
  };
}
