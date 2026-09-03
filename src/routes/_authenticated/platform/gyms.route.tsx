import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Layout for /platform/gyms — the table lives in gyms.index.tsx and the
 *  detail page renders here through <Outlet />. */
export const Route = createFileRoute("/_authenticated/platform/gyms")({
  component: () => <Outlet />,
});
