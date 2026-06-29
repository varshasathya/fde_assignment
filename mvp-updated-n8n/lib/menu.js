// lib/menu.js — load the menu from Supabase, with a built-in fallback so the
// app is fully usable before any backend is configured.
import { supabase, isSupabaseConfigured } from "./supabaseClient";

export const DEFAULT_MENU = {
  base: [
    { item_code: "B1", name: "Thin Crust", price: 149 },
    { item_code: "B2", name: "Thick Crust", price: 179 },
    { item_code: "B3", name: "Cheese Burst", price: 229 },
    { item_code: "B4", name: "Whole Wheat", price: 159 },
    { item_code: "B5", name: "Multigrain", price: 169 },
  ],
  pizza: [
    { item_code: "P1", name: "Margherita", price: 299 },
    { item_code: "P2", name: "Chicago Deep Dish", price: 349 },
    { item_code: "P3", name: "Greek Mediterranean", price: 329 },
    { item_code: "P4", name: "California Veggie", price: 339 },
    { item_code: "P5", name: "Farm House", price: 319 },
    { item_code: "P6", name: "Pepperoni Classic", price: 369 },
    { item_code: "P7", name: "BBQ Chicken", price: 379 },
    { item_code: "P8", name: "Paneer Tikka", price: 349 },
  ],
  topping: [
    { item_code: "T1", name: "Black Olives", price: 49 },
    { item_code: "T2", name: "Extra Cheese", price: 69 },
    { item_code: "T3", name: "Button Mushrooms", price: 49 },
    { item_code: "T4", name: "Green Peppers", price: 39 },
    { item_code: "T5", name: "Jalapenos", price: 39 },
    { item_code: "T6", name: "Sun-Dried Tomatoes", price: 59 },
    { item_code: "T7", name: "Caramelised Onions", price: 49 },
    { item_code: "T8", name: "Sweet Corn", price: 39 },
    { item_code: "T9", name: "Roasted Garlic", price: 49 },
    { item_code: "T10", name: "Peri-Peri Drizzle", price: 59 },
  ],
};

export async function loadMenu() {
  if (!isSupabaseConfigured) return { menu: DEFAULT_MENU, source: "offline" };
  try {
    const { data, error } = await supabase
      .from("menu_items")
      .select("category,item_code,name,price")
      .eq("is_available", true)
      .order("id", { ascending: true });
    if (error || !data?.length) return { menu: DEFAULT_MENU, source: "fallback" };
    const menu = { base: [], pizza: [], topping: [] };
    for (const row of data) {
      if (menu[row.category]) menu[row.category].push({ ...row, price: Number(row.price) });
    }
    // If any category came back empty, fall back to defaults for that category.
    for (const cat of ["base", "pizza", "topping"])
      if (!menu[cat].length) menu[cat] = DEFAULT_MENU[cat];
    return { menu, source: "supabase" };
  } catch {
    return { menu: DEFAULT_MENU, source: "fallback" };
  }
}

// Persist a completed order to Supabase (orders + order_items). Returns the new id or null.
export async function saveOrder(record) {
  if (!isSupabaseConfigured) return { id: null, persisted: false };
  try {
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        customer_name: record.name,
        phone: record.phone,
        quantity: record.qty,
        subtotal: record.subtotal,
        discount: record.discount,
        gst: record.gst,
        total: record.total,
        payment_mode: record.payment_mode,
      })
      .select("id")
      .single();
    if (error || !order) return { id: null, persisted: false };

    const items = [record.base, record.pizza, record.topping].map((it, i) => ({
      order_id: order.id,
      category: ["base", "pizza", "topping"][i],
      item_code: it.item_code,
      name: it.name,
      unit_price: it.price,
    }));
    await supabase.from("order_items").insert(items);
    return { id: order.id, persisted: true };
  } catch {
    return { id: null, persisted: false };
  }
}
