-- Schema for SliceMatic database setup (Supabase / PostgreSQL)

-- 1. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  createdAt TIMESTAMPTZ DEFAULT NOW(),
  updatedAt TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PLACED',
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  pincode TEXT,
  geo TEXT,
  items JSONB NOT NULL,
  itemsSummary TEXT,
  quantity INTEGER NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) NOT NULL,
  gst NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL,
  payment_mode TEXT NOT NULL
);

-- 2. Funnel Events Table (for Funnel State Management)
CREATE TABLE IF NOT EXISTS funnel_events (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  phone TEXT,
  stage TEXT NOT NULL,          -- 'TOFU', 'MOFU', 'BOFU'
  event_name TEXT NOT NULL,     -- 'SESSION_START', 'INTAKE_COMPLETE', 'RECOMMENDATION_SHOWN', 'RECOMMENDATION_ACCEPTED', 'PAYMENT_SELECTED', 'ORDER_COMPLETED', 'VALIDATION_ERROR'
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes to optimise visual reports on admin dashboards
CREATE INDEX IF NOT EXISTS idx_funnel_events_session ON funnel_events(session_id);
CREATE INDEX IF NOT EXISTS idx_funnel_events_stage ON funnel_events(stage);
CREATE INDEX IF NOT EXISTS idx_funnel_events_created ON funnel_events(created_at);
