import { Spinner } from "@/components/custom/spinner";
import { Button } from "@/components/ui/button";

export function LoadingScreen({ error }: { error?: string }) {
  return (
    <div
      aria-label={error ? "Unable to load application" : "Loading"}
      aria-live="polite"
      className="fixed inset-0 z-[9999] flex h-dvh w-screen flex-col items-center justify-center gap-4 overflow-hidden bg-background text-foreground"
      role={error ? "alert" : "status"}
    >
      {error ? (
        <>
          <p className="max-w-md px-6 text-center text-sm">{error}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </>
      ) : (
        <>
          <Spinner aria-hidden="true" size={32} variant="infinite" />
          <span className="sr-only">Loading...</span>
        </>
      )}
    </div>
  );
}
