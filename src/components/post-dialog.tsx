import { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createBunnyUpload } from "@/lib/bunny.functions";
import { createScheduledPost } from "@/lib/posts.functions";

export function PostDialog({
  accountId,
  open,
  initialDate,
  onClose,
  onCreated,
}: {
  accountId: string;
  open: boolean;
  initialDate: Date | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [caption, setCaption] = useState("");
  const [datetime, setDatetime] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const uploadRef = useRef<tus.Upload | null>(null);

  const createBunnyFn = useServerFn(createBunnyUpload);
  const createPostFn = useServerFn(createScheduledPost);

  useEffect(() => {
    if (open) {
      const d = initialDate ?? new Date();
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
      // if the initialDate has no time (midnight), default to next hour
      if (d.getHours() === 0 && d.getMinutes() === 0) local.setHours(new Date().getHours() + 1, 0, 0, 0);
      setDatetime(format(local, "yyyy-MM-dd'T'HH:mm"));
      setCaption("");
      setFile(null);
      setUploadPct(null);
    } else {
      uploadRef.current?.abort();
      uploadRef.current = null;
    }
  }, [open, initialDate]);

  async function onSave() {
    if (!file) { toast.error("Pick a video first"); return; }
    if (!datetime) { toast.error("Pick a date and time"); return; }
    setSaving(true);
    try {
      const bunny = await createBunnyFn({ data: { title: file.name } });
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: bunny.tusEndpoint,
          retryDelays: [0, 1000, 3000, 5000],
          headers: {
            AuthorizationSignature: bunny.authorizationSignature,
            AuthorizationExpire: String(bunny.expiration),
            VideoId: bunny.videoId,
            LibraryId: bunny.libraryId,
          },
          metadata: { filetype: file.type, title: file.name },
          onError: (err) => reject(err),
          onProgress: (sent, total) => setUploadPct(Math.round((sent / total) * 100)),
          onSuccess: () => resolve(),
        });
        uploadRef.current = upload;
        upload.start();
      });

      await createPostFn({
        data: {
          account_id: accountId,
          caption,
          scheduled_at: new Date(datetime).toISOString(),
          bunny_video_id: bunny.videoId,
          bunny_library_id: bunny.libraryId,
          thumbnail_url: bunny.thumbnailUrl,
        },
      });
      toast.success("Post scheduled");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule a post</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Video</Label>
            <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1.5" />
            {file && <p className="mt-1 text-xs text-muted-foreground">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
          </div>
          <div>
            <Label>Caption</Label>
            <Textarea className="mt-1.5" rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Write your caption…" maxLength={2200} />
          </div>
          <div>
            <Label>Publish at</Label>
            <Input type="datetime-local" className="mt-1.5" value={datetime} onChange={(e) => setDatetime(e.target.value)} />
          </div>
          {uploadPct !== null && (
            <div>
              <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Uploading video</span><span>{uploadPct}%</span></div>
              <Progress value={uploadPct} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "Uploading…" : "Schedule post"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
