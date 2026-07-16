// A failed dynamic import() (stale deploy, flaky network) otherwise crashes
// the whole app via AppErrorBoundary with no way to recover but a hard
// reload. Retry a couple of times before giving up.
export function retryImport(importFn, retries = 2, delayMs = 300) {
  return importFn().catch((error) => {
    if (retries <= 0) throw error;
    return new Promise((resolve) => setTimeout(resolve, delayMs)).then(() =>
      retryImport(importFn, retries - 1, delayMs),
    );
  });
}
