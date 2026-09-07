"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { ImagePlus, Trash2, Images, CheckCircle2, AlertTriangle, ImageIcon, Save } from "lucide-react";
import {
  apiGetSets,
  apiAdminUpdateSet,
  apiAdminUpdateSetCover,
  apiAdminAddSetImage,
  apiAdminRemoveSetImage,
} from "@/lib/api";
import { uploadSetImage } from "@/lib/upload";
import type { GraduationSet } from "@/lib/types";

interface DescriptionForm {
  description: string;
}

export default function SetManagePanel() {
  const [sets, setSets]               = useState<GraduationSet[]>([]);
  const [selectedId, setSelectedId]   = useState<string>("");
  const [loading, setLoading]         = useState(true);
  const [busy, setBusy]               = useState<"cover" | "gallery" | "description" | null>(null);
  const [removingId, setRemovingId]   = useState<string | null>(null);
  const [error, setError]             = useState("");
  const [notice, setNotice]           = useState("");
  const coverInputRef                 = useRef<HTMLInputElement | null>(null);
  const galleryInputRef               = useRef<HTMLInputElement | null>(null);

  const descForm = useForm<DescriptionForm>();

  const selected = sets.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGetSets();
        setSets(res.data);
        if (res.data[0]) setSelectedId(res.data[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load sets.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (selected) descForm.reset({ description: selected.description ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;
    await runAction("cover", async () => {
      const url = await uploadSetImage(file, "sets");
      const res = await apiAdminUpdateSetCover(selected.id, url);
      updateSelected((s) => ({ ...s, cover_image: res.data.cover_image }));
      setNotice("Cover image updated. The previous cover was removed from Cloudinary.");
    });
  }

  async function handleRemoveCover() {
    if (!selected?.cover_image || !selected) return;
    await runAction("cover", async () => {
      await apiAdminUpdateSetCover(selected.id, null);
      updateSelected((s) => ({ ...s, cover_image: undefined }));
      setNotice("Cover removed and deleted from Cloudinary.");
    });
  }

  async function handleGalleryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !selected) return;
    await runAction("gallery", async () => {
      const url = await uploadSetImage(file, "sets/gallery");
      const res = await apiAdminAddSetImage(selected.id, url);
      updateSelected((s) => ({ ...s, images: [...(s.images ?? []), res.data] }));
      setNotice("Gallery image added.");
    });
  }

  async function handleRemoveImage(imageId: string) {
    if (!selected) return;
    setRemovingId(imageId);
    setError("");
    try {
      await apiAdminRemoveSetImage(selected.id, imageId);
      updateSelected((s) => ({ ...s, images: (s.images ?? []).filter((im) => im.id !== imageId) }));
      setNotice("Gallery image removed and deleted from Cloudinary.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove image.");
    } finally {
      setRemovingId(null);
    }
  }

  async function onSaveDescription(data: DescriptionForm) {
    if (!selected) return;
    await runAction("description", async () => {
      await apiAdminUpdateSet(selected.id, { description: data.description.trim() });
      updateSelected((s) => ({ ...s, description: data.description.trim() }));
      setNotice(selected.description ? "Set write-up updated." : "Set write-up added.");
    });
  }

  /** Shared wrapper: clears notices, runs a mutation, catches + reports errors. */
  async function runAction(kind: "cover" | "gallery" | "description", fn: () => Promise<void>) {
    setBusy(kind);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  function updateSelected(updater: (s: GraduationSet) => GraduationSet) {
    setSets((prev) => prev.map((s) => (s.id === selectedId ? updater(s) : s)));
  }

  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b border-[var(--border-subtle)]">
        <h2 className="font-[family-name:var(--font-heading)] font-semibold text-[var(--text-heading)] text-base flex items-center gap-2">
          <Images size={18} className="text-[var(--primary)]" /> Graduating Set Media
        </h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          Manage each set&apos;s cover photo, write-up, and gallery. All changes are admin-only.
        </p>
      </div>

      <div className="px-5 py-5 flex flex-col gap-5">
        {notice && (
          <div className="flex items-center gap-2 bg-[var(--success-bg)] text-[#166534] rounded-xl px-4 py-3 text-sm">
            <CheckCircle2 size={16} /> {notice}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-[var(--danger-bg)] text-[var(--danger)] rounded-xl px-4 py-3 text-sm">
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-sm text-[var(--text-muted)]">Loading sets…</div>
        ) : sets.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--text-muted)]">
            No graduation sets exist yet.
          </div>
        ) : (
          <>
            {/* Set picker */}
            <Select
              label="Set"
              placeholder="Choose a set…"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              options={sets.map((s) => ({
                value: s.id,
                label: `Class of ${s.set_name} (${s.start_year} – ${s.end_year})`,
              }))}
            />

            {selected && (
              <>
                {/* ── Cover image ──────────────────────────────────────────── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                  <div className="flex flex-col gap-2">
                    <span className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
                      Cover photo
                    </span>
                    <div className="aspect-[4/3] rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--primary)] to-[var(--primary-hover)] flex items-center justify-center">
                      {selected.cover_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selected.cover_image}
                          alt="Cover"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <ImageIcon size={28} className="text-white/80" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverFile}
                      />
                      <Button
                        size="sm"
                        loading={busy === "cover"}
                        onClick={() => coverInputRef.current?.click()}
                      >
                        <ImagePlus size={14} /> {selected.cover_image ? "Replace Cover" : "Upload Cover"}
                      </Button>
                      {selected.cover_image && (
                        <Button
                          size="sm"
                          variant="danger"
                          loading={busy === "cover"}
                          onClick={handleRemoveCover}
                        >
                          <Trash2 size={14} /> Remove
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* ── Description (write-up) ────────────────────────────── */}
                  <form
                    onSubmit={descForm.handleSubmit(onSaveDescription)}
                    className="flex flex-col gap-2"
                  >
                    <span className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
                      Set write-up
                    </span>
                    <textarea
                      className="input resize-none flex-1 min-h-[7.5rem]"
                      rows={5}
                      placeholder="Tell the story of this graduating set…"
                      {...descForm.register("description")}
                    />
                    <Button
                      type="submit"
                      size="sm"
                      loading={busy === "description"}
                      className="self-start"
                    >
                      <Save size={14} /> Save Write-up
                    </Button>
                  </form>
                </div>

                {/* ── Gallery ─────────────────────────────────────────────── */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[var(--text-heading)] font-[family-name:var(--font-heading)]">
                      Gallery ({selected.images?.length ?? 0})
                    </span>
                    <input
                      ref={galleryInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleGalleryFile}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busy === "gallery"}
                      onClick={() => galleryInputRef.current?.click()}
                    >
                      <ImagePlus size={14} /> Add Image
                    </Button>
                  </div>

                  {selected.images && selected.images.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                      {selected.images.map((img) => (
                        <div
                          key={img.id}
                          className="relative aspect-square rounded-xl overflow-hidden border border-[var(--border-subtle)] group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.image_url}
                            alt="Set gallery"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            disabled={removingId === img.id}
                            onClick={() => handleRemoveImage(img.id)}
                            className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer disabled:opacity-50"
                            aria-label="Delete gallery image"
                          >
                            {removingId === img.id ? (
                              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 size={20} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-[var(--border-subtle)] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                      No gallery images yet — click “Add Image” to include photos for this set.
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Card>
  );
}