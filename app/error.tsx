"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-sm text-inkSoft">{error.message || "Something went wrong"}</p>
      <button
        type="button"
        onClick={reset}
        className="text-sm font-medium text-teal hover:text-tealDark"
      >
        Try again
      </button>
    </main>
  );
}
