"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Receipt from "@/components/Receipt";
import { loadMenu, saveOrder } from "@/lib/menu";
import {
  computeBill, validateName, validatePhone, validateQuantity, validateSelection,
  paymentConfirmation, PAYMENT_MODES, RULES, formatINR,
} from "@/lib/pricing";

function Chip({ active, onClick, children, sub }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "text-left rounded-xl border px-3 py-2.5 transition " +
        (active
          ? "border-brand bg-brand/5 ring-1 ring-brand shadow-card"
          : "border-line bg-panel hover:border-crust")
      }
    >
      <div className="text-[13px] font-semibold leading-tight">{children}</div>
      <div className="text-[12px] text-muted">{sub}</div>
    </button>
  );
}

function Field({ label, error, children, hint }) {
  return (
    <label className="block mb-3">
      <span className="text-[12px] font-semibold text-ink/80">{label}</span>
      {children}
      {error ? (
        <span className="block text-[12px] text-brand mt-1">{error}</span>
      ) : hint ? (
        <span className="block text-[12px] text-muted mt-1">{hint}</span>
      ) : null}
    </label>
  );
}

export default function OrderPage() {
  const [menu, setMenu] = useState(null);
  const [source, setSource] = useState("");
  const [step, setStep] = useState("intake"); // intake | build | done

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState({});

  const [base, setBase] = useState(null);
  const [pizza, setPizza] = useState(null);
  const [topping, setTopping] = useState(null);
  const [qtyRaw, setQtyRaw] = useState("1");
  const [payment, setPayment] = useState("");

  const [rec, setRec] = useState({ loading: false, text: "", model: "" });
  const [confirm, setConfirm] = useState(null);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    loadMenu().then(({ menu, source }) => { setMenu(menu); setSource(source); });
  }, []);

  const nameErr = validateName(name);
  const phoneErr = validatePhone(phone);
  const qtyErr = validateQuantity(qtyRaw);
  const selection = { base, pizza, topping };
  const bill = useMemo(() => computeBill(selection, qtyErr ? 1 : parseInt(qtyRaw, 10)), [base, pizza, topping, qtyRaw, qtyErr]);

  async function goToBuild() {
    setTouched({ name: true, phone: true });
    if (nameErr || phoneErr) return;
    setStep("build");
    // Fire the AI recommendation (non-blocking).
    setRec({ loading: true, text: "", model: "" });
    try {
      const r = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, name }),
      });
      const data = await r.json();
      setRec({ loading: false, text: data.recommendation || "", model: data.model || "" });
    } catch {
      setRec({ loading: false, text: "", model: "" });
    }
  }

  async function placeOrder() {
    setSubmitError("");
    const errs = [
      validateSelection(base, "crust"),
      validateSelection(pizza, "pizza"),
      validateSelection(topping, "topping"),
      qtyErr,
      payment ? null : "Choose a payment mode.",
    ].filter(Boolean);
    if (errs.length) { setSubmitError(errs[0]); return; }

    const finalBill = computeBill(selection, parseInt(qtyRaw, 10));
    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const { id, persisted } = await saveOrder({
      name: name.trim(), phone: phone.trim(), qty: finalBill.qty,
      subtotal: finalBill.subtotal, discount: finalBill.discount, gst: finalBill.gst,
      total: finalBill.total, payment_mode: payment, base, pizza, topping,
    });
    setConfirm({ id, persisted, bill: finalBill, timestamp });
    setStep("done");

    // Notify n8n (WhatsApp to customer + owner). Best-effort, non-blocking.
    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: id,
        name: name.trim(),
        phone: phone.trim(),
        items: { base: base.name, pizza: pizza.name, topping: topping.name },
        quantity: finalBill.qty,
        subtotal: finalBill.subtotal,
        discount: finalBill.discount,
        gst: finalBill.gst,
        total: finalBill.total,
        payment_mode: payment,
      }),
    }).catch(() => {});
  }

  function reset() {
    setStep("intake"); setName(""); setPhone(""); setTouched({});
    setBase(null); setPizza(null); setTopping(null); setQtyRaw("1");
    setPayment(""); setRec({ loading: false, text: "", model: "" });
    setConfirm(null); setSubmitError("");
  }

  const steps = ["Details", "Build", "Pay"];
  const activeIdx = step === "intake" ? 0 : step === "done" ? 2 : 1;

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b border-line bg-paper/70 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-extrabold text-2xl tracking-tight text-brand">SliceMatic</span>
            <span className="text-[12px] text-muted hidden sm:inline">30-min delivery · New Ashok Nagar</span>
          </div>
          <Link href="/admin" className="text-[13px] text-muted hover:text-ink">Admin →</Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-8 grid lg:grid-cols-[1.3fr_1fr] gap-8">
        {/* LEFT: flow */}
        <section>
          {/* hero */}
          <h1 className="font-display font-extrabold text-[34px] leading-[1.05] tracking-tight">
            Build a pizza.<br /><span className="text-brand">Skip the phone call.</span>
          </h1>
          <p className="text-muted mt-2 mb-6 text-[15px]">
            Customise it, see the bill update live, pay how you like.
          </p>

          {/* step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className={"step-dot grid place-items-center w-6 h-6 rounded-full text-[11px] font-bold " +
                  (i <= activeIdx ? "bg-brand text-white" : "bg-line text-muted")}>{i + 1}</span>
                <span className={"text-[12px] " + (i <= activeIdx ? "text-ink font-semibold" : "text-muted")}>{s}</span>
                {i < steps.length - 1 && <span className="w-6 h-px bg-line" />}
              </div>
            ))}
          </div>

          {!menu ? (
            <div className="text-muted text-sm">Loading menu…</div>
          ) : step === "intake" ? (
            <div className="bg-panel border border-line rounded-2xl p-5 shadow-card max-w-md">
              <Field label="Your name" error={touched.name ? nameErr : null}>
                <input
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-[14px] focus:border-brand outline-none"
                  placeholder="e.g. Rajan Sharma" value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                />
              </Field>
              <Field label="Mobile number" error={touched.phone ? phoneErr : null}
                hint="We'll send order updates here.">
                <input
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-line px-3 py-2.5 text-[14px] focus:border-brand outline-none"
                  placeholder="10-digit number" value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                />
              </Field>
              <button onClick={goToBuild}
                className="w-full mt-2 rounded-xl bg-brand hover:bg-branddark text-white font-semibold py-3 transition">
                Continue to the menu
              </button>
            </div>
          ) : step === "build" ? (
            <div className="space-y-6 max-w-xl">
              {/* AI recommendation */}
              {(rec.loading || rec.text) && (
                <div className="rounded-2xl border border-crust/60 bg-crust/10 p-4">
                  <div className="flex items-center gap-2 text-[12px] font-bold text-branddark uppercase tracking-wide mb-1">
                    <span>✦ Picked for you</span>
                    {rec.model && <span className="text-muted font-normal normal-case">· {rec.model}</span>}
                  </div>
                  <p className="text-[14px] text-ink/90">
                    {rec.loading ? "Looking at what regulars near you love…" : rec.text}
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-display font-bold text-lg mb-2">1 · Crust</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {menu.base.map((b) => (
                    <Chip key={b.item_code} active={base?.item_code === b.item_code}
                      onClick={() => setBase(b)} sub={formatINR(b.price)}>{b.name}</Chip>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-display font-bold text-lg mb-2">2 · Pizza</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {menu.pizza.map((p) => (
                    <Chip key={p.item_code} active={pizza?.item_code === p.item_code}
                      onClick={() => setPizza(p)} sub={formatINR(p.price)}>{p.name}</Chip>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-display font-bold text-lg mb-2">3 · Topping</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {menu.topping.map((t) => (
                    <Chip key={t.item_code} active={topping?.item_code === t.item_code}
                      onClick={() => setTopping(t)} sub={formatINR(t.price)}>{t.name}</Chip>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-display font-bold text-lg mb-2">4 · How many?</h3>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center rounded-xl border border-line overflow-hidden">
                    <button className="px-3 py-2 text-lg hover:bg-paper"
                      onClick={() => setQtyRaw(String(Math.max(1, (parseInt(qtyRaw, 10) || 1) - 1)))}>−</button>
                    <input value={qtyRaw} onChange={(e) => setQtyRaw(e.target.value)}
                      className="w-14 text-center py-2 outline-none text-[15px] font-semibold"
                      inputMode="numeric" aria-label="Quantity" />
                    <button className="px-3 py-2 text-lg hover:bg-paper"
                      onClick={() => setQtyRaw(String(Math.min(RULES.MAX_QTY, (parseInt(qtyRaw, 10) || 1) + 1)))}>+</button>
                  </div>
                  <span className="text-[12px] text-muted">
                    {qtyErr ? <span className="text-brand">{qtyErr}</span>
                      : (parseInt(qtyRaw, 10) >= RULES.DISCOUNT_THRESHOLD
                        ? "Nice — 10% off applied for 5+ pizzas."
                        : `Order ${RULES.DISCOUNT_THRESHOLD}+ to unlock 10% off.`)}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="font-display font-bold text-lg mb-2">5 · Payment</h3>
                <div className="flex gap-2">
                  {PAYMENT_MODES.map((m) => (
                    <button key={m} onClick={() => setPayment(m)}
                      className={"flex-1 rounded-xl border py-2.5 text-[14px] font-semibold transition " +
                        (payment === m ? "border-brand bg-brand text-white" : "border-line bg-panel hover:border-crust")}>
                      {m}
                    </button>
                  ))}
                </div>
                {payment && <p className="text-[12px] text-muted mt-2">{paymentConfirmation(payment, bill.total)}</p>}
              </div>

              {submitError && <div className="text-[13px] text-brand">{submitError}</div>}

              <button onClick={placeOrder}
                className="w-full rounded-xl bg-ink hover:bg-black text-white font-semibold py-3.5 transition">
                Place order · {formatINR(bill.total)}
              </button>
            </div>
          ) : (
            // DONE
            <div className="bg-panel border border-line rounded-2xl p-6 shadow-card max-w-md">
              <div className="w-12 h-12 rounded-full bg-basil/15 text-basil grid place-items-center text-2xl mb-3">✓</div>
              <h2 className="font-display font-extrabold text-2xl">Order placed</h2>
              <p className="text-muted text-[14px] mt-1">
                {paymentConfirmation(payment, confirm.bill.total)}
              </p>
              <p className="text-[13px] mt-3">
                {confirm.persisted
                  ? <>Saved to your order history{confirm.id ? ` (#${confirm.id})` : ""}. We'll start prepping it now.</>
                  : <span className="text-muted">Demo mode — connect Supabase to persist this order. The bill is shown on the right.</span>}
              </p>
              <button onClick={reset}
                className="w-full mt-5 rounded-xl bg-brand hover:bg-branddark text-white font-semibold py-3 transition">
                Start a new order
              </button>
            </div>
          )}

          {source === "offline" && step !== "done" && (
            <p className="text-[11px] text-muted mt-6">
              Running in offline demo mode (menu from local fallback). Add Supabase keys to go live.
            </p>
          )}
        </section>

        {/* RIGHT: live receipt */}
        <aside className="lg:pt-2">
          <div className="lg:sticky lg:top-24">
            <Receipt
              customer={name.trim()} phone={phone.trim()}
              selection={selection} bill={confirm ? confirm.bill : bill}
              paymentMode={payment}
              orderId={confirm?.id}
              timestamp={confirm?.timestamp}
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
