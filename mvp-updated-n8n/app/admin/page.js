"use client";
import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { formatINR } from "@/lib/pricing";

const FLOW = {
  PLACED: { label: "Placed", color: "#9c5a14", bg: "#fbf0e1", next: "ACCEPTED", action: "Accept order" },
  ACCEPTED: { label: "Accepted", color: "#1d4ed8", bg: "#e8eefc", next: "OUT_FOR_DELIVERY", action: "Out for delivery" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", color: "#B01259", bg: "#fdeef5", next: "DELIVERED", action: "Mark delivered" },
  DELIVERED: { label: "Delivered", color: "#2F7A4D", bg: "#e7f3ec", next: null, action: null },
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [orders, setOrders] = useState([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mode, setMode] = useState("All");
  const [statusF, setStatusF] = useState("All");
  const [busy, setBusy] = useState(null);
  const [funnelMetrics, setFunnelMetrics] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const r = await fetch("/api/orders", { cache: "no-store" });
      const d = await r.json();
      setOrders(d.orders || []);
    } catch {}
  }, []);

  const fetchFunnelMetrics = useCallback(async () => {
    try {
      const r = await fetch("/api/funnel", {
        headers: { "Authorization": `Bearer ${password}` },
        cache: "no-store",
      });
      if (r.ok) {
        const d = await r.json();
        if (d.success) setFunnelMetrics(d.metrics);
      }
    } catch (e) {
      console.error("Fetch funnel metrics error:", e);
    }
  }, [password]);

  useEffect(() => {
    if (!authed) return;
    fetchOrders();
    fetchFunnelMetrics();
    const t = setInterval(() => {
      fetchOrders();
      fetchFunnelMetrics();
    }, 5000); // live refresh
    return () => clearInterval(t);
  }, [authed, fetchOrders, fetchFunnelMetrics]);

  async function signIn(e) {
    e.preventDefault();
    setAuthError("");
    const r = await fetch("/api/admin/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const d = await r.json();
    if (d.ok) setAuthed(true); else setAuthError("Wrong password.");
  }

  async function advance(o) {
    const next = FLOW[o.status]?.next;
    if (!next) return;
    setBusy(o.id);
    await fetch("/api/orders/status", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: o.id, status: next }),
    });
    await fetchOrders();
    setBusy(null);
  }

  const filtered = useMemo(() => orders.filter((o) => {
    const d = new Date(o.createdAt);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to + "T23:59:59")) return false;
    if (mode !== "All" && o.payment_mode !== mode) return false;
    if (statusF !== "All" && o.status !== statusF) return false;
    return true;
  }), [orders, from, to, mode, statusF]);

  const kpis = useMemo(() => {
    const revenue = filtered.reduce((s, o) => s + Number(o.total || 0), 0);
    const pizzaCounts = {}, hourCounts = {};
    for (const o of filtered) {
      for (const it of o.items || [])
        pizzaCounts[it.pizza] = (pizzaCounts[it.pizza] || 0) + (it.quantity || 1);
      const h = new Date(o.createdAt).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
    const top = Object.entries(pizzaCounts).sort((a, b) => b[1] - a[1])[0];
    const busy = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    const active = filtered.filter((o) => o.status !== "DELIVERED").length;
    return {
      revenue, count: filtered.length, active,
      top: top ? `${top[0]} (qty ${top[1]})` : "—",
      busiest: busy ? `${String(busy[0]).padStart(2, "0")}:00` : "—",
    };
  }, [filtered]);

  function exportCsv() {
    const header = ["id", "createdAt", "status", "name", "phone", "address", "quantity", "subtotal", "discount", "gst", "total", "payment_mode", "itemsSummary"];
    const rows = filtered.map((o) => header.map((k) => JSON.stringify(o[k] ?? "")).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `slicematic_orders_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!authed) {
    return (
      <Shell>
        <form onSubmit={signIn} className="bg-panel border border-line rounded-2xl p-6 max-w-sm shadow-card" style={{ margin: "40px auto 0" }}>
          <h2 className="font-display font-bold text-xl mb-1">Staff sign in</h2>
          <p className="text-[12px] text-muted mb-3">Default password: <code>slicematic123</code> (set <code>ADMIN_PASSWORD</code> to change).</p>
          <input type="password" className="w-full mb-3 rounded-xl border border-line px-3 py-2.5 text-[14px] outline-none focus:border-brand"
            placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {authError && <p className="text-brand text-[12px] mb-2">{authError}</p>}
          <button className="w-full rounded-xl bg-brand hover:bg-branddark text-white font-semibold py-2.5">Sign in</button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display font-extrabold text-2xl">Kitchen dashboard</h1>
          <p className="text-[12px] text-muted">Live · refreshes every 5s</p>
        </div>
        <button onClick={() => setAuthed(false)} className="text-[13px] text-muted hover:text-ink">Sign out</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[["Revenue", formatINR(kpis.revenue)], ["Orders", kpis.count], ["Active now", kpis.active], ["Top pizza", kpis.top], ["Busiest hour", kpis.busiest]].map(([k, v]) => (
          <div key={k} className="bg-panel border border-line rounded-2xl p-4 shadow-card">
            <div className="text-[11px] uppercase tracking-wide text-muted">{k}</div>
            <div className="text-[16px] font-bold mt-1 leading-tight">{v}</div>
          </div>
        ))}
      </div>

      {/* Funnel State Analytics */}
      {funnelMetrics && (
        <div className="bg-panel border border-line rounded-2xl p-5 shadow-card mb-6">
          <h2 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
            📊 Funnel Conversion Analytics
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand bg-brand/5 border border-brand/20 px-2.5 py-0.5 rounded-full">
              Live State Management (TOFU/MOFU/BOFU)
            </span>
          </h2>
          
          <div className="grid md:grid-cols-[1.4fr_1fr] gap-6">
            {/* The Pipeline (TOFU -> MOFU -> BOFU) */}
            <div className="space-y-4">
              <div className="text-[12px] font-bold text-ink/75 uppercase tracking-wide">
                User Progression Pipeline
              </div>
              
              {/* Step 1: TOFU Sessions */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>1. TOFU: Sessions Started</span>
                  <span className="font-mono">{funnelMetrics.totalSessions} sessions</span>
                </div>
                <div className="w-full bg-line rounded-full h-2 overflow-hidden">
                  <div className="bg-ink h-full rounded-full transition-all duration-500" style={{ width: "100%" }}></div>
                </div>
              </div>

              {/* Step 2: MOFU Reached Builder */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>2. MOFU: Reached Pizza Builder (Intake Completed)</span>
                  <span className="font-mono">
                    {funnelMetrics.reachedBuild} ({funnelMetrics.totalSessions > 0 ? Math.round((funnelMetrics.reachedBuild / funnelMetrics.totalSessions) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-line rounded-full h-2 overflow-hidden">
                  <div className="bg-brand h-full rounded-full transition-all duration-500" style={{ width: `${funnelMetrics.totalSessions > 0 ? (funnelMetrics.reachedBuild / funnelMetrics.totalSessions) * 100 : 0}%` }}></div>
                </div>
              </div>

              {/* Step 3: MOFU Reached Payment */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>3. MOFU: Reached Payment Selection</span>
                  <span className="font-mono">
                    {funnelMetrics.reachedPayment} ({funnelMetrics.totalSessions > 0 ? Math.round((funnelMetrics.reachedPayment / funnelMetrics.totalSessions) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-line rounded-full h-2 overflow-hidden">
                  <div className="bg-branddark h-full rounded-full transition-all duration-500" style={{ width: `${funnelMetrics.totalSessions > 0 ? (funnelMetrics.reachedPayment / funnelMetrics.totalSessions) * 100 : 0}%` }}></div>
                </div>
              </div>

              {/* Step 4: BOFU Completed Order */}
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>4. BOFU: Orders Completed & Saved</span>
                  <span className="font-mono text-basil">
                    {funnelMetrics.completedOrder} ({funnelMetrics.totalSessions > 0 ? Math.round((funnelMetrics.completedOrder / funnelMetrics.totalSessions) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-line rounded-full h-2 overflow-hidden">
                  <div className="bg-basil h-full rounded-full transition-all duration-500" style={{ width: `${funnelMetrics.totalSessions > 0 ? (funnelMetrics.completedOrder / funnelMetrics.totalSessions) * 100 : 0}%` }}></div>
                </div>
              </div>
            </div>

            {/* AI Attach & Validation Failures */}
            <div className="space-y-5">
              {/* AI Recommendation stats */}
              <div className="bg-paper border border-line rounded-xl p-4">
                <div className="text-[12px] font-bold text-branddark uppercase tracking-wide mb-2">
                  ✦ AI Suggestion Conversions
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[11px] text-muted uppercase">Shown</div>
                    <div className="text-xl font-bold font-mono">{funnelMetrics.recShownCount}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-muted uppercase">Accepted</div>
                    <div className="text-xl font-bold font-mono text-basil">{funnelMetrics.recAcceptedCount}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-line flex justify-between items-baseline">
                  <span className="text-xs text-muted">Attach Rate:</span>
                  <span className="text-sm font-bold text-brand font-mono font-semibold">
                    {funnelMetrics.recShownCount > 0 ? Math.round((funnelMetrics.recAcceptedCount / funnelMetrics.recShownCount) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Validation errors breakdown */}
              <div>
                <div className="text-[12px] font-bold text-ink/75 uppercase tracking-wide mb-2">
                  Intake Drop-off Friction (Errors)
                </div>
                {Object.keys(funnelMetrics.errorCounts).length === 0 ? (
                  <div className="text-xs text-muted italic">No input validation errors recorded yet.</div>
                ) : (
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {Object.entries(funnelMetrics.errorCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([field, count]) => (
                        <div key={field} className="flex justify-between items-center text-xs bg-paper border border-line rounded px-2.5 py-1">
                          <span className="capitalize text-ink/80 font-semibold">{field} error</span>
                          <span className="font-mono font-bold bg-line px-1.5 py-0.5 rounded text-[10px] text-muted">
                            {count} prompt{count > 1 ? "s" : ""}
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-[12px] text-muted">From<br /><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 rounded-lg border border-line px-2 py-1.5 text-[13px]" /></label>
        <label className="text-[12px] text-muted">To<br /><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 rounded-lg border border-line px-2 py-1.5 text-[13px]" /></label>
        <label className="text-[12px] text-muted">Status<br />
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="mt-1 rounded-lg border border-line px-2 py-1.5 text-[13px]">
            {["All", "PLACED", "ACCEPTED", "OUT_FOR_DELIVERY", "DELIVERED"].map((m) => <option key={m} value={m}>{m === "All" ? "All" : FLOW[m].label}</option>)}
          </select></label>
        <label className="text-[12px] text-muted">Payment<br />
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 rounded-lg border border-line px-2 py-1.5 text-[13px]">
            {["All", "Cash", "Card", "UPI"].map((m) => <option key={m}>{m}</option>)}
          </select></label>
        <button onClick={exportCsv} className="ml-auto rounded-lg bg-ink text-white px-4 py-2 text-[13px] font-semibold">Export CSV</button>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-panel border border-line rounded-2xl p-8 text-center text-muted">No orders yet. Place one from the storefront to see it appear here live.</div>
        ) : filtered.map((o) => {
          const f = FLOW[o.status] || FLOW.PLACED;
          return (
            <div key={o.id} className="bg-panel border border-line rounded-2xl p-4 shadow-card flex flex-col md:flex-row md:items-center gap-3">
              <div className="md:w-16 font-mono text-[13px] text-muted">#{o.id}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-[14px]">{o.name}</span>
                  <span className="text-[12px] text-muted">{o.phone}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ color: f.color, background: f.bg }}>{f.label}</span>
                </div>
                <div className="text-[13px] text-ink/80 mt-0.5">{o.itemsSummary}</div>
                {o.address && <div className="text-[12px] text-muted mt-0.5">📍 {o.address}{o.geo ? ` · pin ${o.geo}` : ""}</div>}
                <div className="text-[12px] text-muted mt-0.5">{new Date(o.createdAt).toLocaleString("en-IN")}</div>
              </div>
              <div className="md:text-right">
                <div className="font-bold text-[15px]">{formatINR(o.total)}</div>
                <div className="text-[11px] text-muted">{o.payment_mode}</div>
              </div>
              <div className="md:w-44">
                {f.action ? (
                  <button onClick={() => advance(o)} disabled={busy === o.id}
                    className="w-full rounded-xl bg-brand hover:bg-branddark text-white font-semibold py-2.5 text-[13px] transition disabled:opacity-50">
                    {busy === o.id ? "…" : f.action}
                  </button>
                ) : (
                  <div className="w-full text-center text-basil font-semibold text-[13px] py-2.5">✓ Delivered</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-paper/70 backdrop-blur">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <span className="font-display font-extrabold text-2xl tracking-tight text-brand">SliceMatic</span>
          <Link href="/" className="text-[13px] text-muted hover:text-ink">← Storefront</Link>
        </div>
      </header>
      <div className="max-w-5xl mx-auto px-5 py-8">{children}</div>
    </main>
  );
}
