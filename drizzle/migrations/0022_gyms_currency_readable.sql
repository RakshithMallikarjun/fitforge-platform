-- Billing functions read the gym's display currency; it was never column-granted,
-- so every gym lookup that included it failed and surfaced as "Forbidden".
GRANT SELECT (currency) ON public.gyms TO authenticated;
