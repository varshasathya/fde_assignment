"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { formatINR } from "@/lib/pricing";

export default function AdminPage() {
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // filters
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [mode, setMode] = useState("All");

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => { if (session) fetchOrders(); }, [session]);

  async function signIn(e) {
    e.preventDefault();
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
  }

  async function fetchOrders() {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, created_at, customer_name, phone, quantity, subtotal, discount, gst, total, payment_mode, order_items(name, category)")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (!error) setOrders(data || []);
    setLoading(false);
  }

  const filtered = useMemo(() => orders.filter((o) => {
    const d = new Date(o.created_at);
    if (from && d < new Date(from)) return false;
    if (to && d > new Date(to + "T23:59:59")) return false;
    if (mode !== "All" && o.payment_mode !== mode) return false;
    return true;
  }), [orders, from, to, mode]);

  const kpis = useMemo(() => {
    const revenue = filtered.reduce((s, o) => s + Number(o.total), 0);
    const pizzaCounts = {};
    const hourCounts = {};
    for (const o of filtered) {
      for (const it of o.order_items || [])
        if (it.category === "pizza") pizzaCounts[it.name] = (pizzaCounts[it.name] || 0) + 1;
      const h = new Date(o.created_at).getHours();
      hourCounts[h] = (hourCounts[h] || 0) + 1;
    }
    const topPizza = Object.entries(pizzaCounts).sort((a, b) => b[1] - a[1])[0];
    const busiest = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];
    return {
      revenue, count: filtered.length,
      aov: filtered.length ? revenue / filtered.length : 0,
      topPizza: topPizza ? `${topPizza[0]} (${topPizza[1]})` : "—",
      busiest: busiest ? `${String(busiest[0]).padStart(2, "0")}:00 (${busiest[1]})` : "—",
    };
  }, [filtered]);

  function exportCsv() {
    const header = ["id", "created_at", "customer_name", "phone", "quantity", "subtotal", "discount", "gst", "total", "payment_mode"];
    const rows = filtered.map((o) => header.map((k) => JSON.stringify(o[k] ?? "")).join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `slicematic_orders_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (!isSupabaseConfigured) {
    return (
      <Shell>
        <div className="bg-panel border border-line rounded-2xl p-6 max-w-md">
          <h2 className="font-display font-bold text-xl mb-2">Connect Supabase first</h2>
          <p className="text-muted text-[14px]">
            Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your
            environment, run <code>supabase/schema.sql</code>, then create an admin user in the Supabase dashboard.
          </p>
        </div>
      </Shell>
    );
  }

  if (!session) {
    return (
      <Shell>
        <form onSubmit={signIn} className="bg-panel border border-line rounded-2xl p-6 max-w-sm shadow-card">
          <h2 className="font-display font-bold text-xl mb-3">Admin sign in</h2>
          <input className="w-full mb-2 rounded-xl border border-line px-3 py-2.5 text-[14px] outline-none focus:border-brand"
            placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
        <h1 className="font-display font-extrabold text-2xl">Orders dashboard</h1>
        <button onClick={() => supabase.auth.signOut()} className="text-[13px] text-muted hover:text-ink">Sign out</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          ["Revenue", formatINR(kpis.revenue)],
          ["Orders", kpis.count],
          ["Avg order", formatINR(kpis.aov)],
          ["Top pizza", kpis.topPizza],
          ["Busiest hour", kpis.busiest],
        ].map(([k, v]) => (
          <div key={k} className="bg-panel border border-line rounded-2xl p-4 shadow-card">
            <div className="text-[11px] uppercase tracking-wide text-muted">{k}</div>
            <div className="text-[18px] font-bold mt-1 leading-tight">{v}</div>
          </div>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <label className="text-[12px] text-muted">From<br />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="mt-1 rounded-lg border border-line px-2 py-1.5 text-[13px]" /></label>
        <label className="text-[12px] text-muted">To<br />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="mt-1 rounded-lg border border-line px-2 py-1.5 text-[13px]" /></label>
        <label className="text-[12px] text-muted">Payment<br />
          <select value={mode} onChange={(e) => setMode(e.target.value)}
            className="mt-1 rounded-lg border border-line px-2 py-1.5 text-[13px]">
            {["All", "Cash", "Card", "UPI"].map((m) => <option key={m}>{m}</option>)}
          </select></label>
        <button onClick={exportCsv} className="ml-auto rounded-lg bg-ink text-white px-4 py-2 text-[13px] font-semibold">Export CSV</button>
      </div>

      {/* table */}
      <div className="bg-panel border border-line rounded-2xl overflow-hidden shadow-card">
        <table className="w-full text-[13px]">
          <thead className="bg-ink text-white text-left">
            <tr>
              {["#", "Time", "Customer", "Qty", "Total", "Pay"].map((h) => (
                <th key={h} className="px-3 py-2 font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted">No orders match these filters.</td></tr>
            ) : filtered.map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="px-3 py-2">{o.id}</td>
                <td className="px-3 py-2">{new Date(o.created_at).toLocaleString("en-IN")}</td>
                <td className="px-3 py-2">{o.customer_name}<span className="text-muted"> · {o.phone}</span></td>
                <td className="px-3 py-2">{o.quantity}</td>
                <td className="px-3 py-2 font-semibold">{formatINR(o.total)}</td>
                <td className="px-3 py-2">{o.payment_mode}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
