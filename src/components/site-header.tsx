import { Link } from "@tanstack/react-router";
import { useAuth } from "@clerk/tanstack-react-start";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const { isSignedIn } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary" />
          <span className="text-base font-semibold tracking-tight">Loomly</span>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
          <a href="/#how" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
        </nav>
        <div className="flex items-center gap-2">
          {isSignedIn ? (
            <Button asChild size="sm"><Link to="/dashboard">Dashboard</Link></Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
              <Button asChild size="sm"><Link to="/pricing">Get started</Link></Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
