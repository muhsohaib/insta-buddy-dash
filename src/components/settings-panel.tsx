import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useUser } from "@clerk/tanstack-react-start";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";

export function SettingsPanel() {
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
    if (!file.type.startsWith("image/")) {
      toast.error("Please pick an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
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
      {/* Avatar */}
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
