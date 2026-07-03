import { createServerFn } from "@tanstack/react-start";

// Exposes the Clerk publishable key to the browser.
// (We can't use a VITE_ env var — that prefix is reserved on this platform —
// so we ship the key via a root loader instead.)
export const getClerkPublishableKey = createServerFn({ method: "GET" }).handler(async () => {
  const key = process.env.CLERK_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "CLERK_PUBLISHABLE_KEY is not configured. Add it in the project secrets.",
    );
  }
  return { publishableKey: key };
});
