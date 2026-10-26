import { createFileRoute } from "@tanstack/react-router";
import { consolePageHead } from "@/lib/page-head";
import { ExerciseDetail, LibraryError, LibrarySkeleton } from "@/components/exercises/exercise-library";
export const Route = createFileRoute("/_authenticated/admin/exercises/$exerciseId")({
  head: ({ params }) => consolePageHead(`Exercise ${params.exerciseId}`, "Exercise demonstration, instructions and workout usage in Fit Foundry."),
  pendingComponent: LibrarySkeleton,
  errorComponent: LibraryError,
  notFoundComponent: () => <p>Exercise not found.</p>,
  component: Detail,
});
function Detail() { return <ExerciseDetail key={Route.useParams().exerciseId} id={Route.useParams().exerciseId} search={Route.useSearch()} />; }
