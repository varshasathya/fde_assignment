// lib/pricing.js
// Single source of truth for all business rules (Stage 2 logic preserved).
// Imported by the ordering UI, the admin view, and the unit test.

export const RULES = {
  DISCOUNT_THRESHOLD: 5, // qty >= this gets a discount  (change to 3 for the live demo)
  DISCOUNT_RATE: 0.10, // 10%
  GST_RATE: 0.18, // 18%
  MIN_QTY: 1,
  MAX_QTY: 10,
};

export const PAYMENT_MODES = ["Cash", "Card", "UPI"];

// ---- Validation (returns an error string, or null when valid) ----
export function validateName(raw) {
  const name = (raw ?? "").trim();
  if (!name) return "Enter a name to continue.";
  if (!/^[A-Za-z ]{2,40}$/.test(name))
    return "Name must be 2–40 letters and spaces only — no numbers.";
  return null;
}

export function validatePhone(raw) {
  const phone = (raw ?? "").trim();
  if (!phone) return "Enter a phone number to continue.";
  if (!/^[6-9][0-9]{9}$/.test(phone))
    return "Enter a 10-digit Indian mobile starting with 6, 7, 8 or 9.";
  return null;
}

export function validateQuantity(raw) {
  if (raw === "" || raw === null || raw === undefined)
    return "Enter a quantity from 1 to 10.";
  // Reject floats, words, and anything non-integer.
  if (!/^-?\d+$/.test(String(raw).trim()))
    return "Quantity must be a whole number from 1 to 10.";
  const q = parseInt(raw, 10);
  if (q > RULES.MAX_QTY) return `Maximum ${RULES.MAX_QTY} pizzas per order.`;
  if (q < RULES.MIN_QTY) return "Quantity must be at least 1.";
  return null;
}

export function validateSelection(item, label) {
  if (!item) return `Choose a ${label} to continue.`;
  return null;
}

// ---- Money helpers ----
export const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
export const formatINR = (n) =>
  "₹" + round2(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---- The bill engine ----
// selection = { base, pizza, topping }  (each = {name, price, item_code, category})
export function computeBill(selection, quantity) {
  const { base, pizza, topping } = selection;
  const unitPrice = (base?.price || 0) + (pizza?.price || 0) + (topping?.price || 0);
  const qty = parseInt(quantity, 10) || 0;
  const subtotal = round2(unitPrice * qty);

  const discountApplies = qty >= RULES.DISCOUNT_THRESHOLD;
  const discount = discountApplies ? round2(subtotal * RULES.DISCOUNT_RATE) : 0;

  const postDiscount = round2(subtotal - discount);
  const gst = round2(postDiscount * RULES.GST_RATE); // GST on post-discount total
  const total = round2(postDiscount + gst);

  return { unitPrice, qty, subtotal, discountApplies, discount, postDiscount, gst, total };
}

// ---- Per-mode payment confirmation (fixes the generic-message gap) ----
export function paymentConfirmation(mode, total) {
  const amount = formatINR(total);
  switch (mode) {
    case "Cash":
      return `Cash selected — please keep ${amount} ready for the delivery rider.`;
    case "Card":
      return `Card selected — ${amount} will be collected on a card machine at your door.`;
    case "UPI":
      return `UPI selected — a payment request for ${amount} will be sent to your number. Approve it in your UPI app.`;
    default:
      return "Choose a payment mode to continue.";
  }
}
