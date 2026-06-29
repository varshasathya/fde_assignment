"use client";
import { formatINR } from "@/lib/pricing";

function Line({ label, value, accent, strong }) {
  return (
    <div className="flex justify-between text-[13px]" style={{ marginBottom: 4 }}>
      <span className={accent ? "text-brand" : strong ? "font-bold" : ""}>{label}</span>
      <span className={(accent ? "text-brand " : "") + (strong ? "font-bold" : "")}>{value}</span>
    </div>
  );
}

export default function Receipt({ customer, phone, selection, bill, paymentMode, orderId, timestamp }) {
  const has = selection?.base && selection?.pizza && selection?.topping;
  return (
    <div className="receipt rounded-2xl px-6 py-7 font-mono text-ink max-w-[360px] w-full mx-auto">
      <div className="text-center mb-4">
        <div className="font-display font-extrabold tracking-tight text-2xl text-brand leading-none">
          SLICEMATIC
        </div>
        <div className="text-[10px] text-muted mt-1 tracking-widest uppercase">
          New Ashok Nagar · Delhi
        </div>
      </div>

      <div className="flex justify-between text-[11px] text-muted">
        <span>{timestamp || "—"}</span>
        <span>{orderId ? `#${orderId}` : "Preview"}</span>
      </div>
      <div className="text-[11px] text-muted mb-3">
        {customer ? `${customer}${phone ? " · " + phone : ""}` : "Guest order"}
      </div>

      <div className="dashed my-3" />

      {!has ? (
        <div className="text-center text-muted text-[12px] py-6">
          Build your pizza and the bill will appear here, line by line.
        </div>
      ) : (
        <>
          <div className="text-[11px] font-bold text-brand uppercase tracking-wider mb-1">
            Your pizza
          </div>
          <Line label={selection.base.name} value={formatINR(selection.base.price)} />
          <Line label={selection.pizza.name} value={formatINR(selection.pizza.price)} />
          <Line label={selection.topping.name} value={formatINR(selection.topping.price)} />
          <div className="text-right text-[11px] text-muted">
            unit {formatINR(bill.unitPrice)} × {bill.qty}
          </div>

          <div className="dashed my-3" />

          <Line label={`Subtotal (${bill.qty})`} value={formatINR(bill.subtotal)} />
          {bill.discount > 0 && (
            <Line label="Discount (10%, 5+)" value={"−" + formatINR(bill.discount)} accent />
          )}
          <Line label="GST (18%)" value={formatINR(bill.gst)} />

          <div className="my-3" style={{ borderTop: "3px double #d9cdbe" }} />

          <Line label="TOTAL PAYABLE" value={formatINR(bill.total)} strong />

          {paymentMode && (
            <>
              <div className="dashed my-3" />
              <Line label="Pay by" value={paymentMode} />
            </>
          )}
        </>
      )}

      <div className="text-center text-[10px] text-muted italic mt-5">
        {orderId ? "Order confirmed — thank you!" : "Live preview"}
      </div>
    </div>
  );
}
