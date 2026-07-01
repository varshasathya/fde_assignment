import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Use a Proxy fallback if environmental keys are missing to prevent build-time crashes.
// This allows the Next.js static compiler to import this module safely.
export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey)
  : new Proxy({}, {
      get(target, prop) {
        return () => {
          throw new Error("Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY environment variables.");
        };
      }
    });