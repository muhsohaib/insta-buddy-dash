import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Film } from "lucide-react";
import { deletePublication, updatePublication } from "@/lib/publications.functions";

export type EditablePost = {
  id: string;
  caption: string;
  scheduled_at: string;
  bunny_video_id?: string | null;
  bunny_library_id?: string | null;
  thumbnail_url?: string | null;
  account_label?: string | null;
};

export function EditPostDialog({
  post,
  onClose,
  onChanged,
}: {
  post: EditablePost | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const open = post !== null;
  const [caption, setCaption] = useState("");
  const [datetime, setDatetime] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const updateFn = useServerFn(updatePublication);
  const deleteFn = useServerFn(deletePublication);


  useEffect(() => {
    if (!post) return;
    setCaption(post.caption ?? "");
    const d = new Date(post.scheduled_at);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
    setDatetime(format(local, "yyyy-MM-dd'T'HH:mm"));
  }, [post]);

  if (!post) return null;

  const embed =
    post.bunny_library_id && post.bunny_video_id
      ? `https://iframe.mediadelivery.net/embed/${post.bunny_library_id}/${post.bunny_video_id}?autoplay=false`
      : null;

  async function onSave() {
    if (!post) return;
    setSaving(true);
    try {
      await updateFn({
        data: {
          id: post.id,
          patch: {
            caption,
            scheduled_at: new Date(datetime).toISOString(),
          },
        },
      });

      toast.success("Post updated");
      onChanged();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!post) return;
    setDeleting(true);
    try {
      await deleteFn({ data: { id: post.id } });
      toast.success("Post deleted");
      onChanged();
      setConfirmDelete(false);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
            <DialogHeader className="space-y-0">
              <DialogTitle className="text-base">Edit scheduled post</DialogTitle>
            </DialogHeader>
            {post.account_label && (
              <span className="text-xs text-muted-foreground">@{post.account_label}</span>
            )}
          </div>

          <div className="grid gap-0 md:grid-cols-2">
            {/* Left — video preview */}
            <div className="border-b border-hairline p-6 md:border-b-0 md:border-r">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Video
              </Label>
              <div className="mt-2 relative aspect-[9/16] max-h-[420px] w-full overflow-hidden rounded-2xl border border-hairline bg-black">
                {embed ? (
                  <iframe
                    src={embed}
                    className="h-full w-full"
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                ) : post.thumbnail_url ? (
                  <img
                    src={post.thumbnail_url}
                    alt="Post thumbnail"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-muted-foreground">
                    <Film className="h-8 w-8" />
                  </div>
                )}
              </div>
            </div>

            {/* Right — meta */}
            <div className="space-y-4 p-6">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Caption
                </Label>
                <Textarea
                  className="mt-2 rounded-xl"
                  rows={8}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write your caption…"
                  maxLength={2200}
                />
                <div className="mt-1 text-right text-[11px] text-muted-foreground">
                  {caption.length}/2200
                </div>
              </div>

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
            </div>
          </div>

          <DialogFooter className="flex-row items-center justify-between border-t border-hairline bg-surface-2/40 px-6 py-4 sm:justify-between">
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              disabled={saving || deleting}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Delete post
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={saving || deleting}>
                Cancel
              </Button>
              <Button
                onClick={onSave}
                disabled={saving || deleting}
                className="gradient-accent text-background shadow-[0_8px_24px_-8px_var(--color-cyan-accent)]"
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this scheduled post?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the post from your calendar. This action can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
