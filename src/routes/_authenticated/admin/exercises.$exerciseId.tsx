import { createFileRoute } from "@tanstack/react-router";
import { consolePageHead } from "@/lib/page-head";
import {
  ExerciseDetail,
  LibraryError,
  LibrarySkeleton,
  exercisesQuery,
} from "@/components/exercises/exercise-library";
export const Route = createFileRoute("/_authenticated/admin/exercises/$exerciseId")({
  loader: async ({ context, params }) => {
    const exercises = await context.queryClient.ensureQueryData(exercisesQuery);
    return { name: exercises.find((e) => e.id === params.exerciseId)?.name ?? "Exercise unavailable" };
  },
  head: ({ loaderData }) =>
    consolePageHead(
      loaderData?.name ?? "Exercise unavailable",
      "Exercise demonstration, instructions and workout usage in Fit Foundry.",
    ),
  pendingComponent: LibrarySkeleton,
  errorComponent: LibraryError,
  notFoundComponent: () => <p>Exercise not found.</p>,
  component: Detail,
});
function Detail() {
  return (
    <ExerciseDetail
      key={Route.useParams().exerciseId}
      id={Route.useParams().exerciseId}
      search={Route.useSearch()}
    />
  );
}
