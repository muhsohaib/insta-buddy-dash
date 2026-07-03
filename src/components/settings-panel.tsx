import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useUser } from "@clerk/tanstack-react-start";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";

export function SettingsPanel() {
  const { user } = useUser();
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const getProfileFn = useServerFn(getMyProfile);
  const updateProfileFn = useServerFn(updateMyProfile);

  const email = user?.primaryEmailAddress?.emailAddress ?? "";

  useEffect(() => {
    getProfileFn().then((p) => setFullName(p?.full_name ?? "")).catch(() => {});
  }, [getProfileFn]);

  async function save() {
    setSaving(true);
    try {
      await updateProfileFn({ data: { full_name: fullName } });
      toast.success("Saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Email</Label>
        <Input value={email} disabled className="mt-1.5" />
      </div>
      <div>
        <Label>Full name</Label>
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} className="mt-1.5" />
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
