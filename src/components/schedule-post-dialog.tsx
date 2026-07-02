import { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createBunnyUpload } from "@/lib/bunny.functions";
import { createScheduledPost } from "@/lib/posts.functions";
import { UploadCloud, Film, X } from "lucide-react";

export type ReadyAccount = { id: string; username: string; label?: string | null };

export function SchedulePostDialog({
  open,
  initialDate,
  accounts,
  defaultAccountId,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialDate: Date | null;
  accounts: ReadyAccount[];
  defaultAccountId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [accountId, setAccountId] = useState<string>(defaultAccountId ?? accounts[0]?.id ?? "");
  const [caption, setCaption] = useState("");
  const [datetime, setDatetime] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const uploadRef = useRef<tus.Upload | null>(null);

  const createBunnyFn = useServerFn(createBunnyUpload);
  const createPostFn = useServerFn(createScheduledPost);

  useEffect(() => {
    if (open) {
      const d = initialDate ?? new Date();
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
      if (d.getHours() === 0 && d.getMinutes() === 0) local.setHours(new Date().getHours() + 1, 0, 0, 0);
      setDatetime(format(local, "yyyy-MM-dd'T'HH:mm"));
      setCaption("");
      setFile(null);
      setPreview(null);
      setUploadPct(null);
      setAccountId(defaultAccountId ?? accounts[0]?.id ?? "");
    } else {
      uploadRef.current?.abort();
      uploadRef.current = null;
      if (preview) URL.revokeObjectURL(preview);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDate, defaultAccountId]);

  function pickFile(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function onSave() {
    if (!accountId) { toast.error("Pick an account"); return; }
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
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-base">Schedule a new post</DialogTitle>
          </DialogHeader>
        </div>

        <div className="grid gap-0 md:grid-cols-2">
          {/* Left — media */}
          <div className="border-b border-hairline p-6 md:border-b-0 md:border-r">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Video</Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f && f.type.startsWith("video/")) pickFile(f);
              }}
              className={`mt-2 relative aspect-[9/16] max-h-[420px] w-full overflow-hidden rounded-2xl border-2 border-dashed transition ${
                dragOver ? "border-[var(--color-cyan-accent)] bg-cyan-accent/5" : "border-hairline bg-surface"
              }`}
            >
              {preview ? (
                <>
                  <video src={preview} className="h-full w-full object-cover" controls />
                  <button
                    type="button"
                    onClick={() => pickFile(null)}
                    className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-background/90 text-foreground shadow-soft hover:bg-background"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-center">
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="grid h-14 w-14 place-items-center rounded-full gradient-accent text-background shadow-[0_10px_30px_-6px_var(--color-cyan-accent)]"
                  >
                    <UploadCloud className="h-6 w-6" />
                  </motion.div>
                  <div className="text-sm font-medium">Drag & drop a video</div>
                  <div className="text-xs text-muted-foreground">or click to browse — MP4 up to 4K</div>
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              )}
            </div>
            {file && (
              <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Film className="h-3 w-3" /> {file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
            )}
          </div>

          {/* Right — meta */}
          <div className="space-y-4 p-6">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Account</Label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="mt-2 h-10 w-full rounded-xl border border-hairline bg-background px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/40"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.username ? `@${a.username}` : (a.label ?? "Account")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Caption</Label>
              <Textarea
                className="mt-2 rounded-xl"
                rows={6}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write your caption… use #hashtags freely"
                maxLength={2200}
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground">{caption.length}/2200</div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Publish at</Label>
              <Input
                type="datetime-local"
                className="mt-2 rounded-xl"
                value={datetime}
                onChange={(e) => setDatetime(e.target.value)}
              />
            </div>

            {uploadPct !== null && (
              <div>
                <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                  <span>Uploading video</span>
                  <span>{uploadPct}%</span>
                </div>
                <Progress value={uploadPct} />
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-hairline bg-surface-2/40 px-6 py-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={onSave}
            disabled={saving}
            className="gradient-accent text-background shadow-[0_8px_24px_-8px_var(--color-cyan-accent)]"
          >
            {saving ? "Uploading…" : "Schedule post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
