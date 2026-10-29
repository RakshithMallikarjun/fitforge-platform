# Gym subdomain activation

Gym URLs are generated from the existing, platform-assigned slug. For example,
`ironworks` uses `https://ironworks.fitfoundry.in/auth`. Settings is read-only for
the address; saving operations only updates timezone. Existing custom_domain
values are preserved but no longer used for gym sign-up or invitation links.

## Hosting requirements

Application code cannot provision DNS, hosting bindings or SSL certificates.
The documented Lovable connection flow supports individual hostnames; wildcard
hosting/SSL support is not verified. A wildcard DNS record alone is insufficient.

1. In Project Settings → Domains, unset fitfoundry.in as primary. Otherwise
   connected gym subdomains redirect back to the root before the app can resolve them.
2. Connect each gym hostname to this project and complete its shown DNS
   verification. Fit Foundry operates this step; gym owners do not configure DNS.
   Use a wildcard only after wildcard hosting and SSL support are established.
3. In More → Users → Auth settings → Advanced, keep Site URL as
   `https://fitfoundry.in` and add `https://*.fitfoundry.in/**` to Redirect URLs.
   Preserve the existing preview/published entries.
4. Publish changes, then verify a real gym's invitation, password reset, sign-in
   and reload on its connected hostname. Confirm another gym's account is rejected.

## Session boundaries

Sessions remain origin-scoped. Login on the root resolves the account's gym under
RLS and opens the gym sign-in page, requiring a second sign-in. No access token,
refresh token, password or callback query/hash crosses hosts. Direct gym sign-in
stays on that host. The protected route guard also checks the authoritative gym
before rendering; hostname never replaces RLS authorization.