import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  useUser,
  useClerk,
  useOrganization,
  useOrganizationList,
} from "@clerk/tanstack-react-start";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Camera,
  Loader2,
  User as UserIcon,
  Building2,
  CreditCard,
  LogOut,
  Trash2,
  Mail,
  X,
  Pencil,
  Key,
  Copy,
  Check,
} from "lucide-react";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { inviteOrgMember } from "@/lib/organization.functions";
import { getMySubscription } from "@/lib/accounts.functions";
import { listApiKeys, createApiKey, revokeApiKey } from "@/lib/api-keys.functions";
import { cn } from "@/lib/utils";

export type SettingsTab = "account" | "workspace" | "billing" | "api";

interface SettingsPanelProps {
  initialTab?: SettingsTab;
  onRequestClose?: () => void;
}

export function SettingsPanel({ initialTab = "account", onRequestClose }: SettingsPanelProps = {}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  return (
    <div className="flex h-[min(85vh,700px)] w-full flex-col overflow-hidden md:flex-row">
      {/* Sidebar */}
      <aside className="shrink-0 border-b border-hairline bg-muted/30 p-3 md:w-56 md:border-b-0 md:border-r md:p-4">
        <div className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Settings
        </div>
        <nav className="flex gap-1 md:flex-col">
          <TabButton
            active={tab === "account"}
            onClick={() => setTab("account")}
            icon={<UserIcon className="h-4 w-4" />}
            label="Account"
          />
          <TabButton
            active={tab === "workspace"}
            onClick={() => setTab("workspace")}
            icon={<Building2 className="h-4 w-4" />}
            label="Workspace"
          />
          <TabButton
            active={tab === "billing"}
            onClick={() => setTab("billing")}
            icon={<CreditCard className="h-4 w-4" />}
            label="Billing"
          />
          <TabButton
            active={tab === "api"}
            onClick={() => setTab("api")}
            icon={<Key className="h-4 w-4" />}
            label="API keys"
          />
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "account" ? (
          <AccountTab />
        ) : tab === "workspace" ? (
          <WorkspaceTab onClosed={onRequestClose} />
        ) : tab === "billing" ? (
          <BillingTab />
        ) : (
          <ApiKeysTab />
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition md:flex-none",
        active
          ? "bg-background text-foreground shadow-sm ring-1 ring-hairline"
          : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/* ============================ ACCOUNT TAB ============================ */

function AccountTab() {
  const { user } = useUser();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const getProfileFn = useServerFn(getMyProfile);
  const updateProfileFn = useServerFn(updateMyProfile);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";
  const username = user?.username ?? "";
  const createdAt = user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "";
  const imageUrl = user?.imageUrl ?? "";

  useEffect(() => {
    getProfileFn().then((p) => setFullName(p?.full_name ?? "")).catch(() => {});
  }, [getProfileFn]);

  async function save() {
    setSaving(true);
    try {
      await updateProfileFn({ data: { full_name: fullName } });
      if (user && fullName) {
        const [first, ...rest] = fullName.trim().split(/\s+/);
        await user.update({ firstName: first ?? "", lastName: rest.join(" ") });
      }
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return toast.error("Please pick an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setUploading(true);
    try {
      await user.setProfileImage({ file });
      await user.reload();
      toast.success("Profile image updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const initials = (fullName || email || "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Account</h2>
        <p className="text-sm text-muted-foreground">Manage your personal profile.</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="h-20 w-20">
            <AvatarImage src={imageUrl} alt={fullName || email} />
            <AvatarFallback>{initials || "U"}</AvatarFallback>
          </Avatar>
          {uploading && (
            <div className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            <Camera className="mr-2 h-4 w-4" />
            {uploading ? "Uploading…" : "Change photo"}
          </Button>
          <p className="text-xs text-muted-foreground">PNG or JPG. Max 5 MB.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickImage}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label>Email</Label>
          <Input value={email} disabled className="mt-1.5" />
        </div>
        <div>
          <Label>Full name</Label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            className="mt-1.5"
          />
        </div>
        {username && (
          <div>
            <Label>Username</Label>
            <Input value={username} disabled className="mt-1.5" />
          </div>
        )}
        {createdAt && (
          <div className="text-xs text-muted-foreground">Member since {createdAt}</div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

/* ============================ WORKSPACE TAB ============================ */

function WorkspaceTab({ onClosed }: { onClosed?: () => void }) {
  const { organization, membership, memberships, isLoaded } = useOrganization({
    memberships: { infinite: true, keepPreviousData: true },
    invitations: { infinite: true, keepPreviousData: true },
  });
  const { setActive } = useOrganizationList();
  const clerk = useClerk();

  const isAdmin = membership?.role === "org:admin";
  const logoRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(organization?.name ?? "");
    setEditingName(false);
  }, [organization?.id, organization?.name]);

  if (!isLoaded) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (!organization) {
    return (
      <div className="grid h-64 place-items-center text-center text-sm text-muted-foreground">
        <div>
          <p>No active workspace.</p>
          <Button
            className="mt-3"
            variant="outline"
            size="sm"
            onClick={() => clerk.openCreateOrganization?.()}
          >
            Create workspace
          </Button>
        </div>
      </div>
    );
  }

  async function saveName() {
    if (!organization || !name.trim() || name === organization.name) {
      setEditingName(false);
      setName(organization?.name ?? "");
      return;
    }
    setSavingName(true);
    try {
      await organization.update({ name: name.trim() });
      toast.success("Workspace updated");
      setEditingName(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSavingName(false);
    }
  }

  async function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !organization) return;
    if (!file.type.startsWith("image/")) return toast.error("Please pick an image file");
    if (file.size > 5 * 1024 * 1024) return toast.error("Image must be under 5 MB");
    setUploadingLogo(true);
    try {
      await organization.setLogo({ file });
      await organization.reload();
      toast.success("Logo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function leave() {
    if (!organization || !membership) return;
    try {
      await membership.destroy();
      toast.success("Left workspace");
      onClosed?.();
      if (setActive) await setActive({ organization: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to leave");
    }
  }

  async function destroy() {
    if (!organization) return;
    try {
      await organization.destroy();
      toast.success("Workspace deleted");
      onClosed?.();
      if (setActive) await setActive({ organization: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  const initial = (organization.name || "?").charAt(0).toUpperCase();

  return (
    <div className="space-y-8">
      {/* Header card */}
      <div className="flex items-center gap-4 rounded-xl border border-hairline bg-muted/30 p-4">
        <button
          type="button"
          onClick={() => isAdmin && logoRef.current?.click()}
          disabled={!isAdmin || uploadingLogo}
          className="group relative shrink-0 disabled:cursor-default"
          title={isAdmin ? "Change logo" : undefined}
        >
          <Avatar className="h-14 w-14 rounded-xl">
            <AvatarImage src={organization.imageUrl} alt={organization.name} />
            <AvatarFallback className="rounded-xl gradient-accent text-background">
              {initial}
            </AvatarFallback>
          </Avatar>
          {isAdmin && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-xl bg-background/60 opacity-0 transition group-hover:opacity-100">
              <Camera className="h-5 w-5" />
            </div>
          )}
          {uploadingLogo && (
            <div className="absolute inset-0 grid place-items-center rounded-xl bg-background/70">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
        </button>
        {isAdmin && (
          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickLogo}
          />
        )}

        <div className="min-w-0 flex-1">
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    setEditingName(false);
                    setName(organization.name ?? "");
                  }
                }}
                className="h-8"
              />
              <Button size="sm" onClick={saveName} disabled={savingName}>
                {savingName ? "…" : "Save"}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="truncate text-base font-semibold">{organization.name}</div>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setEditingName(true)}
                  title="Edit name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            {organization.membersCount ?? memberships?.data?.length ?? 0} member
            {(organization.membersCount ?? 1) === 1 ? "" : "s"} · You are{" "}
            {isAdmin ? "an admin" : "a member"}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setConfirmLeave(true)}>
              <LogOut className="mr-2 h-4 w-4" /> Leave
            </Button>
          )}
        </div>
      </div>

      {/* Members */}
      <Section
        title="Members"
        description={isAdmin ? "Invite teammates and manage roles." : "People in this workspace."}
      >
        {isAdmin && <InviteRow organizationId={organization.id} />}
        <MembersList canManage={isAdmin} />
        {isAdmin && <InvitationsList />}
      </Section>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {organization.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You will lose access to this workspace. An admin will need to re-invite you.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={leave}>Leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {organization.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. All members will lose access and workspace data will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={destroy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function InviteRow({ organizationId }: { organizationId: string }) {
  const invite = useServerFn(inviteOrgMember);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"org:admin" | "org:member">("org:member");
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    try {
      await invite({ data: { organizationId, emailAddress: email, role } });
      toast.success(`Invitation sent to ${email}`);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="email"
          required
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="pl-9"
        />
      </div>
      <select
        value={role}
        onChange={(e) => setRole(e.target.value as "org:admin" | "org:member")}
        className="h-10 rounded-md border border-hairline bg-background px-3 text-sm"
      >
        <option value="org:member">Member</option>
        <option value="org:admin">Admin</option>
      </select>
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Invite"}
      </Button>
    </form>
  );
}

function MembersList({ canManage }: { canManage: boolean }) {
  const { memberships, membership: myMembership } = useOrganization({
    memberships: { infinite: true, keepPreviousData: true },
  });
  const items = memberships?.data ?? [];

  if (!items.length) {
    return <div className="text-sm text-muted-foreground">No members yet.</div>;
  }

  return (
    <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
      {items.map((m) => {
        const isSelf = m.publicUserData?.userId === myMembership?.publicUserData?.userId;
        const name =
          [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(" ") ||
          m.publicUserData?.identifier ||
          "Member";
        return (
          <div key={m.id} className="flex items-center gap-3 bg-background p-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src={m.publicUserData?.imageUrl} alt={name} />
              <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">
                {name} {isSelf && <span className="text-muted-foreground">(you)</span>}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {m.publicUserData?.identifier}
              </div>
            </div>
            <MemberRoleControl membership={m} canManage={canManage && !isSelf} />
            {canManage && !isSelf && (
              <Button
                variant="ghost"
                size="icon"
                title="Remove member"
                onClick={async () => {
                  try {
                    await m.destroy();
                    toast.success("Member removed");
                    await memberships?.revalidate?.();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed to remove");
                  }
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}
      {memberships?.hasNextPage && (
        <div className="bg-background p-2 text-center">
          <Button variant="ghost" size="sm" onClick={() => memberships.fetchNext?.()}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}

function MemberRoleControl({
  membership,
  canManage,
}: {
  membership: any;
  canManage: boolean;
}) {
  const [role, setRole] = useState<string>(membership.role);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRole(membership.role);
  }, [membership.role]);

  if (!canManage) {
    return (
      <span className="rounded-md bg-secondary px-2 py-1 text-xs font-medium text-muted-foreground">
        {membership.role === "org:admin" ? "Admin" : "Member"}
      </span>
    );
  }

  return (
    <select
      value={role}
      disabled={saving}
      onChange={async (e) => {
        const next = e.target.value;
        setSaving(true);
        try {
          await membership.update({ role: next });
          setRole(next);
          toast.success("Role updated");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to update role");
        } finally {
          setSaving(false);
        }
      }}
      className="h-8 rounded-md border border-hairline bg-background px-2 text-xs"
    >
      <option value="org:member">Member</option>
      <option value="org:admin">Admin</option>
    </select>
  );
}

function InvitationsList() {
  const { invitations } = useOrganization({
    invitations: { infinite: true, keepPreviousData: true },
  });
  const items = useMemo(
    () => (invitations?.data ?? []).filter((i) => i.status === "pending"),
    [invitations?.data],
  );

  if (!items.length) return null;

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">Pending invitations</div>
      <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
        {items.map((inv) => (
          <div key={inv.id} className="flex items-center gap-3 bg-background p-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{inv.emailAddress}</div>
              <div className="text-xs text-muted-foreground">
                {inv.role === "org:admin" ? "Admin" : "Member"} · Pending
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              title="Revoke invitation"
              onClick={async () => {
                try {
                  await inv.revoke();
                  toast.success("Invitation revoked");
                  await invitations?.revalidate?.();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to revoke");
                }
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================ BILLING TAB ============================ */

function BillingTab() {
  const { organization, membership, isLoaded } = useOrganization();
  const isAdmin = membership?.role === "org:admin";
  const getSubFn = useServerFn(getMySubscription);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<Awaited<ReturnType<typeof getMySubscription>> | null>(null);

  useEffect(() => {
    if (!organization) return;
    setLoading(true);
    getSubFn()
      .then((s) => setSub(s))
      .catch(() => setSub(null))
      .finally(() => setLoading(false));
  }, [getSubFn, organization?.id]);

  if (!isLoaded || loading) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="grid h-64 place-items-center text-center text-sm text-muted-foreground">
        No active workspace.
      </div>
    );
  }

  const quantity = sub?.quantity ?? 0;
  const total = quantity * 49;
  const status = sub?.status ?? "inactive";
  const renews = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString()
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Billing</h2>
        <p className="text-sm text-muted-foreground">
          Manage your subscription for {organization.name}.
        </p>
      </div>

      {sub ? (
        <div className="rounded-xl border border-hairline bg-muted/30 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Current plan
              </div>
              <div className="mt-1 text-2xl font-semibold tracking-tight">
                ${total}
                <span className="ml-1 text-sm font-normal text-muted-foreground">/month</span>
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {quantity} Instagram {quantity === 1 ? "account" : "accounts"} × $49
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Status</div>
              <div
                className={cn(
                  "mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                  status === "active"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : "bg-muted text-muted-foreground",
                )}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {status}
              </div>
              {renews && (
                <div className="mt-2 text-xs text-muted-foreground">Renews {renews}</div>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-hairline pt-4">
              <Button variant="outline" size="sm" asChild>
                <a href="https://whop.com/orders" target="_blank" rel="noreferrer">
                  Manage in Whop →
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href="/pricing">Change plan</a>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-hairline bg-muted/30 p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-background ring-1 ring-hairline">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="mt-3 text-base font-medium">No active subscription</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Subscribe to start scheduling posts on Instagram accounts.
          </p>
          {isAdmin && (
            <Button className="mt-4" asChild>
              <a href="/pricing">Choose a plan</a>
            </Button>
          )}
        </div>
      )}

      {!isAdmin && (
        <p className="text-xs text-muted-foreground">
          Only workspace admins can change billing.
        </p>
      )}
    </div>
  );
}

/* ============================ API KEYS TAB ============================ */

function ApiKeysTab() {
  const { organization, membership, isLoaded } = useOrganization();
  const listFn = useServerFn(listApiKeys);
  const createFn = useServerFn(createApiKey);
  const revokeFn = useServerFn(revokeApiKey);

  const isAdmin = !organization || membership?.role === "org:admin";
  const [keys, setKeys] = useState<
    Array<{
      id: string;
      label: string;
      prefix: string;
      created_at: string;
      last_used_at: string | null;
      revoked_at: string | null;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const rows = await listFn();
      setKeys(rows as typeof keys);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load keys");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization?.id, isAdmin]);

  async function create() {
    if (!label.trim()) return;
    setCreating(true);
    try {
      const created = await createFn({ data: { label: label.trim() } });
      setNewKey(created.key);
      setLabel("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    try {
      await revokeFn({ data: { id } });
      toast.success("Key revoked");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke");
    }
  }

  async function copy() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isLoaded || loading) {
    return (
      <div className="grid h-64 place-items-center text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="grid h-64 place-items-center text-center text-sm text-muted-foreground">
        Only workspace admins can manage API keys.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">API keys</h2>
        <p className="text-sm text-muted-foreground">
          Use these keys to let AI agents, scripts, or integrations create and manage
          orders in this workspace. Every request is scoped to{" "}
          {organization?.name ?? "your workspace"} — the same as if you clicked it in the
          dashboard.
        </p>
      </div>

      <div className="rounded-xl border border-hairline bg-muted/30 p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          Endpoint
        </div>
        <div className="mt-1 font-mono text-sm">
          {typeof window !== "undefined" ? window.location.origin : ""}/api/public/v1
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          Send <span className="font-mono">Authorization: Bearer sk_live_…</span> on every request. See{" "}
          <a className="underline" href="/api/public/v1/openapi" target="_blank" rel="noreferrer">
            /api/public/v1/openapi
          </a>{" "}
          for the full spec.
        </div>
      </div>

      {newKey && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4">
          <div className="text-sm font-medium">New key created</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Copy it now — you won't see it again.
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-hairline bg-background px-3 py-2 font-mono text-xs">
            <span className="truncate">{newKey}</span>
            <Button variant="ghost" size="icon" onClick={copy} className="h-7 w-7 shrink-0">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => setNewKey(null)}
          >
            Done
          </Button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create();
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Key label (e.g. Claude, Zapier, CLI)"
          className="min-w-[220px] flex-1"
        />
        <Button type="submit" disabled={creating || !label.trim()}>
          {creating ? "Creating…" : "Create key"}
        </Button>
      </form>

      <div className="divide-y divide-hairline overflow-hidden rounded-xl border border-hairline">
        {keys.length === 0 ? (
          <div className="bg-background p-6 text-center text-sm text-muted-foreground">
            No API keys yet.
          </div>
        ) : (
          keys.map((k) => {
            const revoked = !!k.revoked_at;
            return (
              <div key={k.id} className="flex items-center gap-3 bg-background p-3">
                <Key className="h-4 w-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {k.label}{" "}
                    {revoked && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (revoked)
                      </span>
                    )}
                  </div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    {k.prefix}…{"  "}·{"  "}
                    {k.last_used_at
                      ? `used ${new Date(k.last_used_at).toLocaleDateString()}`
                      : "never used"}
                  </div>
                </div>
                {!revoked && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => revoke(k.id)}
                  >
                    Revoke
                  </Button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
