import { useEffect, useMemo, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { createBunnyUpload } from "@/lib/bunny.functions";
import { createPublication } from "@/lib/publications.functions";

import {
  UploadCloud,
  Film,
  X,
  ArrowLeft,
  ArrowRight,
  Instagram,
  Check,
  AlertTriangle,
  RotateCw,
  Loader2,
} from "lucide-react";

export type PickerAccount = {
  id: string;
  username: string | null;
  label?: string | null;
  photo?: string | null;
};

type UploadState =
  | { kind: "idle" }
  | { kind: "uploading"; pct: number }
  | {
      kind: "done";
      videoId: string;
      libraryId: string;
      thumbnailUrl: string | null;
    }
  | { kind: "error"; message: string };

type Step = 1 | 2 | 3 | 4;

export function CreatePostDialog({
  open,
  initialDate,
  accounts,
  defaultAccountId,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialDate: Date | null;
  accounts: PickerAccount[];
  defaultAccountId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const createBunnyFn = useServerFn(createBunnyUpload);
  const createPostFn = useServerFn(createPublication);


  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [upload, setUpload] = useState<UploadState>({ kind: "idle" });
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    defaultAccountId ? [defaultAccountId] : []
  );
  const [caption, setCaption] = useState("");
  const [datetime, setDatetime] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  const uploadRef = useRef<tus.Upload | null>(null);
  const previewRef = useRef<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setFile(null);
    setUpload({ kind: "idle" });
    setSelectedIds(defaultAccountId ? [defaultAccountId] : []);
    setCaption("");
    const d = initialDate ?? new Date();
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    if (d.getHours() === 0 && d.getMinutes() === 0)
      local.setHours(new Date().getHours() + 1, 0, 0, 0);
    setDatetime(format(local, "yyyy-MM-dd'T'HH:mm"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Cleanup blob previews when replaced/closed
  useEffect(() => {
    previewRef.current = preview;
  }, [preview]);
  useEffect(() => {
    if (!open) {
      uploadRef.current?.abort();
      uploadRef.current = null;
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      setPreview(null);
    }
  }, [open]);

  function startUpload(f: File) {
    setUpload({ kind: "uploading", pct: 0 });
    (async () => {
      try {
        const bunny = await createBunnyFn({ data: { title: f.name } });
        await new Promise<void>((resolve, reject) => {
          const up = new tus.Upload(f, {
            endpoint: bunny.tusEndpoint,
            retryDelays: [0, 1000, 3000, 5000],
            headers: {
              AuthorizationSignature: bunny.authorizationSignature,
              AuthorizationExpire: String(bunny.expiration),
              VideoId: bunny.videoId,
              LibraryId: bunny.libraryId,
            },
            metadata: { filetype: f.type, title: f.name },
            onError: (err) => reject(err),
            onProgress: (sent, total) =>
              setUpload({
                kind: "uploading",
                pct: Math.round((sent / total) * 100),
              }),
            onSuccess: () => resolve(),
          });
          uploadRef.current = up;
          up.start();
        });
        setUpload({
          kind: "done",
          videoId: bunny.videoId,
          libraryId: bunny.libraryId,
          thumbnailUrl: bunny.thumbnailUrl ?? null,
        });
      } catch (err) {
        setUpload({
          kind: "error",
          message: err instanceof Error ? err.message : "Upload failed",
        });
      }
    })();
  }

  function pickFile(f: File | null) {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
    if (f) {
      startUpload(f);
      // Auto-advance to next step immediately
      setStep(2);
    }
  }

  function retryUpload() {
    if (!file) return;
    uploadRef.current?.abort();
    uploadRef.current = null;
    startUpload(file);
  }

  function toggleAccount(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onSchedule() {
    if (upload.kind !== "done") return;
    if (selectedIds.length === 0) {
      toast.error("Pick at least one account");
      return;
    }
    if (!datetime) {
      toast.error("Pick a date and time");
      return;
    }
    setScheduling(true);
    try {
      const iso = new Date(datetime).toISOString();
      await Promise.all(
        selectedIds.map((accountId) =>
          createPostFn({
            data: {
              account_id: accountId,
              type: "reel",
              caption,
              scheduled_at: iso,
              status: "scheduled",
              media: [
                {
                  kind: "video",
                  bunny_video_id: upload.videoId,
                  bunny_library_id: upload.libraryId,
                  thumbnail_url: upload.thumbnailUrl,
                },
              ],
            },
          })
        )
      );

      toast.success(
        selectedIds.length > 1
          ? `Scheduled to ${selectedIds.length} accounts`
          : "Post scheduled"
      );
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not schedule");
    } finally {
      setScheduling(false);
    }
  }

  const canNext = useMemo(() => {
    if (step === 1) return !!file;
    if (step === 2) return selectedIds.length > 0;
    if (step === 3) return true;
    return false;
  }, [step, file, selectedIds]);

  const stepLabel = { 1: "Upload", 2: "Accounts", 3: "Details", 4: "Schedule" }[step];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl overflow-hidden p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
                className="grid h-8 w-8 place-items-center rounded-full hover:bg-surface-2"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <DialogHeader className="space-y-0">
              <DialogTitle className="text-base">
                New post · {stepLabel}
              </DialogTitle>
            </DialogHeader>
          </div>
          <StepDots step={step} />
        </div>

        {/* Persistent upload strip (visible after step 1) */}
        {step > 1 && <UploadStrip upload={upload} onRetry={retryUpload} />}

        {/* Body */}
        <div className="min-h-[420px]">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="p-6"
              >
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const f = e.dataTransfer.files?.[0];
                    if (f && f.type.startsWith("video/")) pickFile(f);
                  }}
                  className={`relative flex aspect-[16/10] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed text-center transition ${
                    dragOver
                      ? "border-[var(--color-cyan-accent)] bg-cyan-accent/5"
                      : "border-hairline bg-surface"
                  }`}
                >
                  <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="grid h-16 w-16 place-items-center rounded-full gradient-accent text-background shadow-[0_10px_30px_-6px_var(--color-cyan-accent)]"
                  >
                    <UploadCloud className="h-7 w-7" />
                  </motion.div>
                  <div className="text-base font-semibold">
                    Drag a video here
                  </div>
                  <div className="text-xs text-muted-foreground">
                    MP4, MOV, WebM · up to 4K · uploads start immediately
                  </div>
                  <label className="mt-2">
                    <span className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90">
                      <Film className="h-4 w-4" />
                      Choose video
                    </span>
                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button variant="ghost" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="p-6"
              >
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Post to
                </Label>
                <div className="mt-2 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {accounts.length === 0 && (
                    <div className="rounded-xl border border-hairline bg-surface p-6 text-center text-sm text-muted-foreground">
                      No ready accounts yet.
                    </div>
                  )}
                  {accounts.map((a) => {
                    const checked = selectedIds.includes(a.id);
                    const display = a.username
                      ? `@${a.username}`
                      : a.label ?? "Instagram account";
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleAccount(a.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                          checked
                            ? "border-[var(--color-cyan-accent)] bg-cyan-accent/5"
                            : "border-hairline hover:bg-surface-2/60"
                        }`}
                      >
                        <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full gradient-accent text-background ring-2 ring-hairline">
                          {a.photo ? (
                            <img
                              src={a.photo}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Instagram className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">
                            {display}
                          </div>
                          {a.label && a.username && (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {a.label}
                            </div>
                          )}
                        </div>
                        <Checkbox checked={checked} tabIndex={-1} />
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="grid gap-0 md:grid-cols-2"
              >
                <div className="border-b border-hairline p-6 md:border-b-0 md:border-r">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                    Preview
                  </Label>
                  <div className="mt-2 aspect-[9/16] max-h-[380px] w-full overflow-hidden rounded-2xl border border-hairline bg-surface">
                    {preview ? (
                      <video
                        src={preview}
                        className="h-full w-full object-cover"
                        controls
                      />
                    ) : null}
                  </div>
                </div>
                <div className="space-y-4 p-6">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Caption
                    </Label>
                    <Textarea
                      className="mt-2 rounded-xl"
                      rows={10}
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Write your caption… use #hashtags freely"
                      maxLength={2200}
                    />
                    <div className="mt-1 text-right text-[11px] text-muted-foreground">
                      {caption.length}/2200
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="s4"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                className="p-6"
              >
                <div className="mx-auto max-w-md space-y-4">
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Publish at
                    </Label>
                    <Input
                      type="datetime-local"
                      className="mt-2 rounded-xl"
                      value={datetime}
                      onChange={(e) => setDatetime(e.target.value)}
                    />
                  </div>
                  <div className="rounded-xl border border-hairline bg-surface-2/40 p-4 text-sm">
                    <div className="font-medium">Ready to schedule</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {selectedIds.length} account
                      {selectedIds.length === 1 ? "" : "s"} ·{" "}
                      {caption.length > 0
                        ? `${caption.length} chars caption`
                        : "no caption"}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {step > 1 && (
          <div className="flex items-center justify-between gap-2 border-t border-hairline bg-surface-2/40 px-6 py-4">
            <Button variant="ghost" onClick={onClose} disabled={scheduling}>
              Cancel
            </Button>
            {step < 4 ? (
              <Button
                onClick={() => canNext && setStep(((step + 1) as Step))}
                disabled={!canNext}
                className="gradient-accent text-background shadow-[0_8px_24px_-8px_var(--color-cyan-accent)]"
              >
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={onSchedule}
                disabled={
                  scheduling ||
                  upload.kind !== "done" ||
                  selectedIds.length === 0
                }
                className="gradient-accent text-background shadow-[0_8px_24px_-8px_var(--color-cyan-accent)]"
              >
                {scheduling ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Scheduling…
                  </>
                ) : upload.kind === "done" ? (
                  <>
                    <Check className="mr-1 h-4 w-4" />
                    Schedule post
                  </>
                ) : upload.kind === "error" ? (
                  "Fix upload to continue"
                ) : (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    Finishing upload…
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepDots({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`h-1.5 rounded-full transition-all ${
            n === step
              ? "w-6 bg-foreground"
              : n < step
              ? "w-1.5 bg-foreground/60"
              : "w-1.5 bg-foreground/20"
          }`}
        />
      ))}
    </div>
  );
}

function UploadStrip({
  upload,
  onRetry,
}: {
  upload: UploadState;
  onRetry: () => void;
}) {
  if (upload.kind === "idle") return null;
  return (
    <div className="border-b border-hairline bg-surface-2/40 px-6 py-2.5">
      {upload.kind === "uploading" && (
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" />
              Uploading video…
            </span>
            <span>{upload.pct}%</span>
          </div>
          <Progress value={upload.pct} className="h-1.5" />
        </div>
      )}
      {upload.kind === "done" && (
        <div className="flex items-center gap-2 text-[11px] text-success">
          <Check className="h-3.5 w-3.5" /> Video uploaded — ready to schedule
        </div>
      )}
      {upload.kind === "error" && (
        <div className="flex items-center justify-between gap-2 text-[11px] text-destructive">
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Upload failed: {upload.message}
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-md border border-hairline bg-background px-2 py-1 text-foreground hover:bg-surface-2"
          >
            <RotateCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}
    </div>
  );
}


