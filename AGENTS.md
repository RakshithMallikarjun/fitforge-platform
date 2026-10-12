<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Use src/lib/copy.ts for counted labels and segment-aware navigation matching so plural forms and active links stay consistent.
- Protected console pending states use public-safe ConsoleLoading chrome, then real shells with content skeletons until access checks finish; never render protected content before authorization.
- The shared Sonner wrapper enforces wall-clock expiry for long error notifications so hovering cannot keep them indefinitely.
