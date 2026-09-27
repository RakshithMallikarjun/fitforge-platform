-- Billing reads the gym's display currency; it was never column-granted, so every gym lookup including it failed and surfaced as "Forbidden".
GRANT SELECT (currency) ON public.gyms TO authenticated;