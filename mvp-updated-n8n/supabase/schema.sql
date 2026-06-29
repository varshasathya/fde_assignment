-- supabase/schema.sql
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query → Run).
-- Creates the three tables, seeds the menu, and sets row-level security.

-- ──────────────── TABLES ────────────────
create table if not exists menu_items (
  id           bigint generated always as identity primary key,
  category     text not null check (category in ('base','pizza','topping')),
  item_code    text not null,
  name         text not null,
  price        numeric(10,2) not null,
  is_available boolean not null default true
);

create table if not exists orders (
  id            bigint generated always as identity primary key,
  created_at    timestamptz not null default now(),
  customer_name text not null,
  phone         text not null,
  quantity      int  not null,
  subtotal      numeric(10,2) not null,
  discount      numeric(10,2) not null,
  gst           numeric(10,2) not null,
  total         numeric(10,2) not null,
  payment_mode  text not null check (payment_mode in ('Cash','Card','UPI'))
);

create table if not exists order_items (
  id         bigint generated always as identity primary key,
  order_id   bigint not null references orders(id) on delete cascade,
  category   text not null,
  item_code  text,
  name       text not null,
  unit_price numeric(10,2) not null
);

-- ──────────────── SEED MENU ────────────────
truncate menu_items restart identity;
insert into menu_items (category, item_code, name, price) values
  ('base','B1','Thin Crust',149),('base','B2','Thick Crust',179),
  ('base','B3','Cheese Burst',229),('base','B4','Whole Wheat',159),
  ('base','B5','Multigrain',169),
  ('pizza','P1','Margherita',299),('pizza','P2','Chicago Deep Dish',349),
  ('pizza','P3','Greek Mediterranean',329),('pizza','P4','California Veggie',339),
  ('pizza','P5','Farm House',319),('pizza','P6','Pepperoni Classic',369),
  ('pizza','P7','BBQ Chicken',379),('pizza','P8','Paneer Tikka',349),
  ('topping','T1','Black Olives',49),('topping','T2','Extra Cheese',69),
  ('topping','T3','Button Mushrooms',49),('topping','T4','Green Peppers',39),
  ('topping','T5','Jalapenos',39),('topping','T6','Sun-Dried Tomatoes',59),
  ('topping','T7','Caramelised Onions',49),('topping','T8','Sweet Corn',39),
  ('topping','T9','Roasted Garlic',49),('topping','T10','Peri-Peri Drizzle',59);

-- ──────────────── ROW-LEVEL SECURITY ────────────────
alter table menu_items  enable row level security;
alter table orders      enable row level security;
alter table order_items enable row level security;

-- Anyone (anon) can read the menu.
create policy "menu_public_read" on menu_items for select using (true);

-- Anyone (anon) can place an order (insert), but only signed-in admins can read them.
create policy "orders_anon_insert"      on orders      for insert with check (true);
create policy "orders_admin_read"       on orders      for select using (auth.role() = 'authenticated');
create policy "order_items_anon_insert" on order_items for insert with check (true);
create policy "order_items_admin_read"  on order_items for select using (auth.role() = 'authenticated');

-- ──────────────── ADMIN USER ────────────────
-- Create your admin login in Dashboard → Authentication → Users → Add user
-- (email + password). That account logs into /admin.
