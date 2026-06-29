// lib/supabaseClient.js — browser-side client (anon key).
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// Configured only when both env vars are present. Until then the app runs
// in "offline demo" mode: menu falls back to defaults, orders aren't persisted.
export const isSupabaseConfigured = Boolean(url && anon);

// createClient never throws on construction; calls just fail if unconfigured.
export const supabase = createClient(url || "http://localhost", anon || "anon");
