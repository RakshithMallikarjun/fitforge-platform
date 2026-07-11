ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS billing_cycle text
    CHECK (billing_cycle IN ('monthly','quarterly','half_year','annual')),
  ADD COLUMN IF NOT EXISTS last_payment_amount numeric,
  ADD COLUMN IF NOT EXISTS last_payment_date date,
  ADD COLUMN IF NOT EXISTS payment_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payment_notes text;