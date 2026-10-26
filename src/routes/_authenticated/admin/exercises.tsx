import { createFileRoute } from "@tanstack/react-router";
import { consolePageHead } from "@/lib/page-head";
import { librarySearch } from "@/lib/exercise-library";
import { ExerciseLibrary, exercisesQuery, libraryPlansQuery, LibrarySkeleton, LibraryError } from "@/components/exercises/exercise-library";
export const Route = createFileRoute("/_authenticated/admin/exercises")({
  validateSearch: librarySearch,
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(exercisesQuery), context.queryClient.ensureQueryData(libraryPlansQuery)]); },
  head: () => consolePageHead("Exercise library", "Browse exercises and workout templates in your Fit Foundry gym."),
  pendingComponent: LibrarySkeleton,
  errorComponent: LibraryError,
  notFoundComponent: () => <p>Exercise library unavailable.</p>,
  component: LibraryPage,
});
function LibraryPage() { return <ExerciseLibrary search={Route.useSearch()} />; }
