import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Link2, Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { createKnowledgeItem, updateKnowledgeItem } from "@/lib/knowledge.functions";
import { parseEmbedUrl, EMBED_PROVIDER_LABEL } from "@/lib/embed";
import { RichTextEditor } from "@/components/knowledge/rich-text-editor";
import { EmbedViewer, fmtBytes } from "@/components/knowledge/viewers";
import { btn, fieldCls, Field } from "@/components/crm/kit";
import { cn } from "@/lib/utils";

export type KnowledgeCategoryLite = { id: string; name: string };

export type KnowledgeItemFull = {
  id: string;
  category_id: string | null;
  title: string;
  summary: string | null;
  kind: "article" | "file" | "embed";
  body: string | null;
  file_path: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  embed_url: string | null;
  provider: string | null;
  published: boolean;
};

const KINDS = [
  { value: "article", label: "Article", hint: "Rich text written in the editor", icon: FileText },
  { value: "file", label: "File upload", hint: "PDF, doc, or video file (mp4/webm)", icon: Upload },
  { value: "embed", label: "Video embed", hint: "YouTube, Vimeo, or Loom link", icon: Link2 },
] as const;

export function KnowledgeItemForm({
  categories,
  item,
}: {
  categories: KnowledgeCategoryLite[];
  item?: KnowledgeItemFull;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const createFn = useServerFn(createKnowledgeItem);
  const updateFn = useServerFn(updateKnowledgeItem);

  const [title, setTitle] = useState(item?.title ?? "");
  const [summary, setSummary] = useState(item?.summary ?? "");
  const [categoryId, setCategoryId] = useState(item?.category_id ?? "");
  const [kind, setKind] = useState<"article" | "file" | "embed">(item?.kind ?? "article");
  const [body, setBody] = useState(item?.body ?? "");
  const [embedUrl, setEmbedUrl] = useState(item?.embed_url ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [published, setPublished] = useState(item?.published ?? true);
  const [saving, setSaving] = useState(false);

  const parsed = kind === "embed" && embedUrl.trim() ? parseEmbedUrl(embedUrl) : null;

  async function onSubmit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (kind === "embed" && !parsed) {
      toast.error("Paste a valid YouTube, Vimeo, or Loom link");
      return;
    }
    if (kind === "file" && !file && !(item?.kind === "file" && item.file_path)) {
      toast.error("Choose a file to upload");
      return;
    }
    setSaving(true);
    try {
      let fileFields: Record<string, unknown> = {};
      if (kind === "file") {
        if (file) {
          if (!user) throw new Error("Not signed in");
          const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
          const path = `${user.id}/${Date.now()}-${safe}`;
          const { error } = await supabase.storage
            .from("knowledge-assets")
            .upload(path, file, { contentType: file.type || undefined });
          if (error) throw new Error(error.message);
          fileFields = {
            file_path: path,
            file_name: file.name,
            file_type: file.type || null,
            file_size: file.size,
          };
        } else {
          // Keep the existing upload.
          fileFields = {
            file_path: item!.file_path,
            file_name: item!.file_name,
            file_type: item!.file_type,
            file_size: item!.file_size,
          };
        }
      }

      const payload = {
        category_id: categoryId || null,
        title: title.trim(),
        summary: summary.trim() || null,
        kind,
        body: kind === "article" ? body : null,
        published,
        ...(kind === "embed" ? { embed_url: parsed!.url, provider: parsed!.provider } : {}),
        ...fileFields,
      };

      let id = item?.id;
      if (item) {
        await updateFn({ data: { id: item.id, patch: payload } });
        toast.success("Saved");
      } else {
        const row = await createFn({ data: payload });
        id = row.id;
        toast.success("Added to the knowledge base");
      }
      await qc.invalidateQueries({ queryKey: ["knowledge"] });
      navigate({ to: "/admin/knowledge/item/$itemId", params: { itemId: id! } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      <div className="space-y-5">
        {/* Kind picker */}
        <div className="grid grid-cols-3 gap-2">
          {KINDS.map((k) => (
            <button
              key={k.value}
              type="button"
              onClick={() => setKind(k.value)}
              className={cn(
                "flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors",
                kind === k.value
                  ? "border-honey bg-honey/10"
                  : "border-border bg-card hover:bg-comb/50",
              )}
            >
              <k.icon className={cn("h-4 w-4", kind === k.value ? "text-honey-deep" : "text-muted-foreground")} />
              <span className="text-[13px] font-semibold text-ink">{k.label}</span>
              <span className="text-[11.5px] leading-snug text-muted-foreground">{k.hint}</span>
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" className="sm:col-span-2">
            <input
              className={fieldCls}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Handling the 'crypto is a scam' objection"
            />
          </Field>
          <Field label="Category">
            <select
              className={fieldCls}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Uncategorized</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Summary (shown on cards)">
            <input
              className={fieldCls}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One line about what's inside"
            />
          </Field>
        </div>

        {kind === "article" ? (
          <Field label="Body">
            <RichTextEditor value={body} onChange={setBody} />
          </Field>
        ) : null}

        {kind === "file" ? (
          <Field label="File">
            {file || (item?.kind === "file" && item.file_name) ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-inset px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-honey-deep" />
                  <span className="truncate text-[13px] font-medium">
                    {file ? file.name : item!.file_name}
                  </span>
                  <span className="shrink-0 text-[11.5px] text-muted-foreground">
                    {file ? fmtBytes(file.size) : fmtBytes(item!.file_size)}
                    {!file && item ? " · current file" : ""}
                  </span>
                </div>
                <label className={cn(btn.secondary, "h-8 cursor-pointer text-[12px]")}>
                  Replace
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,video/mp4,video/webm,video/quicktime,image/*"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {file ? (
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-chip"
                    aria-label="Clear chosen file"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : (
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-inset/50 px-6 py-10 text-center hover:border-honey/60">
                <Upload className="h-5 w-5 text-muted-foreground" />
                <span className="text-[13px] font-medium text-secondary-text">
                  Click to choose a file
                </span>
                <span className="text-[11.5px] text-muted-foreground">
                  PDF, Office docs, images, or mp4/webm video — up to 500 MB
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,video/mp4,video/webm,video/quicktime,image/*"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
          </Field>
        ) : null}

        {kind === "embed" ? (
          <Field label="Video link">
            <input
              className={fieldCls}
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              placeholder="https://vimeo.com/… or https://loom.com/share/… or YouTube link"
            />
            {embedUrl.trim() ? (
              parsed ? (
                <div className="mt-3 space-y-2">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-honey-deep">
                    {EMBED_PROVIDER_LABEL[parsed.provider]} embed — preview
                  </span>
                  <EmbedViewer url={parsed.url} title={title || "Video preview"} />
                </div>
              ) : (
                <p className="mt-1.5 text-[12px] text-red-text">
                  Not a recognized YouTube, Vimeo, or Loom link.
                </p>
              )
            ) : null}
          </Field>
        ) : null}

        <label className="flex items-center gap-2.5 text-[13px] text-secondary-text">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
            className="h-4 w-4 accent-[var(--honey)]"
          />
          Published — visible to the whole team. Unchecked saves it as an admin-only draft.
        </label>

        <div className="flex items-center gap-2 pt-2">
          <button type="button" onClick={onSubmit} disabled={saving} className={btn.primary}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {item ? "Save changes" : "Add to knowledge base"}
          </button>
          <button
            type="button"
            onClick={() => navigate({ to: "/admin/knowledge" })}
            className={btn.ghost}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
