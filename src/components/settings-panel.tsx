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
  LogOut,
  Trash2,
  Mail,
  X,
} from "lucide-react";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { inviteOrgMember } from "@/lib/organization.functions";
import { cn } from "@/lib/utils";

export type SettingsTab = "account" | "workspace";

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
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "account" ? <AccountTab /> : <WorkspaceTab onClosed={onRequestClose} />}
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
  const { organization, membership, memberships, invitations, isLoaded } = useOrganization({
    memberships: { infinite: true, keepPreviousData: true },
    invitations: { infinite: true, keepPreviousData: true },
  });
  const { setActive } = useOrganizationList();
  const clerk = useClerk();

  const isAdmin = membership?.role === "org:admin";
  const logoRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(organization?.name ?? "");
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
    if (!organization || !name.trim() || name === organization.name) return;
    setSavingName(true);
    try {
      await organization.update({ name: name.trim() });
      toast.success("Workspace updated");
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
      {/* Header */}
      <div className="flex items-center gap-4 rounded-xl border border-hairline bg-muted/30 p-4">
        <div className="relative">
          <Avatar className="h-14 w-14 rounded-xl">
            <AvatarImage src={organization.imageUrl} alt={organization.name} />
            <AvatarFallback className="rounded-xl gradient-accent text-background">
              {initial}
            </AvatarFallback>
          </Avatar>
          {uploadingLogo && (
            <div className="absolute inset-0 grid place-items-center rounded-xl bg-background/70">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{organization.name}</div>
          <div className="text-xs text-muted-foreground">
            {organization.membersCount ?? memberships?.data?.length ?? 0} member
            {(organization.membersCount ?? 1) === 1 ? "" : "s"} · You are{" "}
            {isAdmin ? "an admin" : "a member"}
          </div>
        </div>
        {isAdmin && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => logoRef.current?.click()}
              disabled={uploadingLogo}
            >
              <Camera className="mr-2 h-4 w-4" />
              Logo
            </Button>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickLogo}
            />
          </>
        )}
      </div>

      {/* General */}
      <Section title="General" description="Workspace profile shown to your team.">
        <div className="space-y-4">
          <div>
            <Label>Workspace name</Label>
            <div className="mt-1.5 flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
                placeholder="Workspace name"
              />
              {isAdmin && (
                <Button
                  onClick={saveName}
                  disabled={savingName || !name.trim() || name === organization.name}
                >
                  {savingName ? "Saving…" : "Save"}
                </Button>
              )}
            </div>
          </div>
          {organization.slug && (
            <div>
              <Label>Slug</Label>
              <Input value={organization.slug} disabled className="mt-1.5" />
            </div>
          )}
        </div>
      </Section>

      {/* Members */}
      <Section
        title="Members"
        description={isAdmin ? "Invite teammates and manage roles." : "People in this workspace."}
      >
        {isAdmin && <InviteRow organizationId={organization.id} />}
        <MembersList canManage={isAdmin} />
        {isAdmin && <InvitationsList />}
      </Section>

      {/* Danger */}
      <Section title="Danger zone" description="Irreversible actions.">
        <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium">Leave workspace</div>
              <div className="text-xs text-muted-foreground">
                Remove yourself from this workspace.
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setConfirmLeave(true)}>
              <LogOut className="mr-2 h-4 w-4" /> Leave
            </Button>
          </div>
          {isAdmin && (
            <div className="flex items-center justify-between gap-4 border-t border-destructive/20 pt-3">
              <div>
                <div className="text-sm font-medium">Delete workspace</div>
                <div className="text-xs text-muted-foreground">
                  Permanently delete this workspace and its data.
                </div>
              </div>
              <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          )}
        </div>
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
