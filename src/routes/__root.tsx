import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { ClerkProvider, useAuth } from "@clerk/tanstack-react-start";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { getClerkPublishableKey } from "@/integrations/clerk/config.functions";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong on our end.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Try again</button>
          <a href="/" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Loomly — Instagram accounts + scheduling for founders" },
      { name: "description", content: "Loomly creates warmed-up Instagram accounts for B2C SaaS and app founders, and lets you schedule posts in one clean dashboard." },
      { property: "og:title", content: "Loomly — Instagram accounts + scheduling for founders" },
      { property: "og:description", content: "Loomly creates warmed-up Instagram accounts for B2C SaaS and app founders, and lets you schedule posts in one clean dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Loomly — Instagram accounts + scheduling for founders" },
      { name: "twitter:description", content: "Loomly creates warmed-up Instagram accounts for B2C SaaS and app founders, and lets you schedule posts in one clean dashboard." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0c0fe573-364f-430b-b934-13c09b25a660/id-preview-40be695d--190b66d0-cf30-4890-bfc6-0adc64a23313.lovable.app-1783000759436.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/0c0fe573-364f-430b-b934-13c09b25a660/id-preview-40be695d--190b66d0-cf30-4890-bfc6-0adc64a23313.lovable.app-1783000759436.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  loader: () => getClerkPublishableKey(),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { publishableKey } = Route.useLoaderData();
  const [pageRestoreKey, setPageRestoreKey] = useState(0);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setPageRestoreKey((key) => key + 1);
    };

    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  return (
    <ClerkProvider publishableKey={publishableKey} localization={workspaceLocalization}>
      <QueryClientProvider client={queryClient}>
        <ClerkAuthSync />
        <Outlet key={pageRestoreKey} />
        <Toaster position="top-right" />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

// Relabel Clerk's "Organization" surfaces as "Workspace" so the term never
// leaks into the UI. Clerk Organizations remain the backend for members,
// invitations, roles, and switching.
const workspaceLocalization = {
  organizationSwitcher: {
    action__createOrganization: "Create workspace",
    action__manageOrganization: "Manage workspace",
    action__invitationAccept: "Join",
    action__suggestionsAccept: "Request to join",
    notSelected: "No workspace selected",
    personalWorkspace: "Personal workspace",
    suggestionsAcceptedLabel: "Pending approval",
  },
  createOrganization: {
    title: "Create workspace",
    formButtonSubmit: "Create workspace",
    invitePage: {
      formButtonReset: "Skip",
    },
  },
  organizationProfile: {
    navbar: {
      title: "Workspace",
      description: "Manage your workspace.",
      general: "General",
      members: "Members",
    },
    start: {
      headerTitle__members: "Members",
      headerTitle__general: "General",
      profileSection: { title: "Workspace profile", primaryButton: "Update workspace" },
    },
    profilePage: {
      title: "Update workspace",
      subtitle: "Update your workspace profile.",
      successMessage: "The workspace has been updated.",
    },
    membersPage: {
      requestsTab: { autoSuggestions: { headerTitle: "Invitations", headerSubtitle: "" } },
      action__invite: "Invite",
      start: { headerTitle__members: "Members", headerTitle__invitations: "Invitations" },
    },
    dangerSection: {
      leaveOrganization: {
        title: "Leave workspace",
        messageLine1: "Are you sure you want to leave this workspace? You will lose access to it and its resources.",
        messageLine2: "This action is permanent and irreversible.",
        successMessage: "You've left the workspace.",
        actionDescription: "Type {{organizationName}} below to continue.",
      },
      deleteOrganization: {
        title: "Delete workspace",
        messageLine1: "Are you sure you want to delete this workspace?",
        messageLine2: "This action is permanent and irreversible.",
        successMessage: "You've deleted the workspace.",
        actionDescription: "Type {{organizationName}} below to continue.",
      },
    },
  },
  organizationList: {
    createOrganization: "Create workspace",
    title: "Choose a workspace",
    titleWithoutPersonal: "Choose a workspace",
    subtitle: "to continue to {{applicationName}}",
    action__createOrganization: "Create workspace",
    action__invitationAccept: "Join",
    action__suggestionsAccept: "Request to join",
    invitationAcceptedLabel: "Joined",
    suggestionsAcceptedLabel: "Pending approval",
  },
} as const;


// Refetches loader/queries when auth state changes so protected routes react.
function ClerkAuthSync() {
  const router = useRouter();
  const { queryClient } = Route.useRouteContext();
  const { isLoaded, isSignedIn, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    router.invalidate();
    if (isSignedIn) queryClient.invalidateQueries();
    else queryClient.clear();
  }, [isLoaded, isSignedIn, userId, router, queryClient]);

  return null;
}
