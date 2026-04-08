-- Migration: Add Stripe Connect fields to shops
alter table public.shops
  add column stripe_connect_id      text unique,
  add column stripe_charges_enabled boolean not null default false;

comment on column public.shops.stripe_connect_id      is 'Stripe Express account ID (acct_...) for the shop owner.';
comment on column public.shops.stripe_charges_enabled is 'True once the vendor has completed Stripe onboarding and charges are enabled.';
