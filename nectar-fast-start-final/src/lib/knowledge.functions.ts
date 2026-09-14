import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertKnowledgeAdmin, slugifyKnowledge } from "@/lib/knowledge.server";
import type { Database } from "@/integrations/supabase/types";

type CategoryUpdate = Database["public"]["Tables"]["knowledge_categories"]["Update"];
type ItemUpdate = Database["public"]["Tables"]["knowledge_items"]["Update"];

const ITEM_COLS =
  "id, category_id, title, summary, kind, provider, file_name, file_type, file_size, sort_order, published, created_at, updated_at";

const itemInput = z.object({
  category_id: z.string().uuid().nullish(),
  title: z.string().trim().min(1, "Title is required"),
  summary: z.string().trim().nullish(),
  kind: z.enum(["article", "file", "embed"]),
  body: z.string().nullish(),
  file_path: z.string().nullish(),
  file_name: z.string().nullish(),
  file_type: z.string().nullish(),
  file_size: z.number().int().nonnegative().nullish(),
  embed_url: z.string().trim().url().nullish(),
  provider: z.string().nullish(),
  sort_order: z.number().int().nullish(),
  published: z.boolean().nullish(),
});

/** Categories + item index for the sidebar and home page. RLS scopes drafts to admins. */
export const listKnowledge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [cats, items] = await Promise.all([
      context.supabase
        .from("knowledge_categories")
        .select("id, name, slug, description, sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      context.supabase
        .from("knowledge_items")
        .select(ITEM_COLS)
        .order("sort_order", { ascending: true })
        .order("title", { ascending: true }),
    ]);
    if (cats.error) throw new Error(cats.error.message);
    if (items.error) throw new Error(items.error.message);
    return { categories: cats.data ?? [], items: items.data ?? [] };
  });

/** Single item with a fresh signed URL for file content. */
export const getKnowledgeItem = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: item, error } = await context.supabase
      .from("knowledge_items")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);

    let fileUrl: string | null = null;
    if (item.kind === "file" && item.file_path) {
      const { data: signed } = await context.supabase.storage
        .from("knowledge-assets")
        .createSignedUrl(item.file_path, 60 * 60 * 6);
      fileUrl = signed?.signedUrl ?? null;
    }
    return { item, fileUrl };
  });

export const createKnowledgeCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        name: z.string().trim().min(1, "Name is required"),
        description: z.string().trim().nullish(),
        sort_order: z.number().int().nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertKnowledgeAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("knowledge_categories")
      .insert({
        name: data.name,
        slug: slugifyKnowledge(data.name),
        description: data.description || null,
        sort_order: data.sort_order ?? 0,
      })
      .select("id, name, slug, description, sort_order")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateKnowledgeCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        name: z.string().trim().min(1).optional(),
        description: z.string().trim().nullish(),
        sort_order: z.number().int().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertKnowledgeAdmin(context.supabase, context.userId);
    const patch: CategoryUpdate = {};
    if (data.name !== undefined) {
      patch.name = data.name;
      patch.slug = slugifyKnowledge(data.name);
    }
    if (data.description !== undefined) patch.description = data.description || null;
    if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
    const { error } = await context.supabase
      .from("knowledge_categories")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Items in a deleted category become uncategorized (FK is ON DELETE SET NULL). */
export const deleteKnowledgeCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertKnowledgeAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("knowledge_categories")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createKnowledgeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => itemInput.parse(data))
  .handler(async ({ data, context }) => {
    await assertKnowledgeAdmin(context.supabase, context.userId);
    const { data: row, error } = await context.supabase
      .from("knowledge_items")
      .insert({
        category_id: data.category_id ?? null,
        title: data.title,
        summary: data.summary || null,
        kind: data.kind,
        body: data.kind === "article" ? (data.body ?? null) : null,
        file_path: data.kind === "file" ? (data.file_path ?? null) : null,
        file_name: data.kind === "file" ? (data.file_name ?? null) : null,
        file_type: data.kind === "file" ? (data.file_type ?? null) : null,
        file_size: data.kind === "file" ? (data.file_size ?? null) : null,
        embed_url: data.kind === "embed" ? (data.embed_url ?? null) : null,
        provider: data.kind === "embed" ? (data.provider ?? null) : null,
        sort_order: data.sort_order ?? 0,
        published: data.published ?? true,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateKnowledgeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), patch: itemInput.partial() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await assertKnowledgeAdmin(context.supabase, context.userId);
    const p = data.patch;
    const patch: ItemUpdate = {};
    if (p.category_id !== undefined) patch.category_id = p.category_id ?? null;
    if (p.title !== undefined) patch.title = p.title;
    if (p.summary !== undefined) patch.summary = p.summary || null;
    if (p.sort_order !== undefined) patch.sort_order = p.sort_order ?? 0;
    if (p.published !== undefined) patch.published = p.published ?? true;
    if (p.kind !== undefined) {
      patch.kind = p.kind;
      // Clear fields that don't belong to the new kind.
      patch.body = p.kind === "article" ? (p.body ?? null) : null;
      patch.file_path = p.kind === "file" ? (p.file_path ?? null) : null;
      patch.file_name = p.kind === "file" ? (p.file_name ?? null) : null;
      patch.file_type = p.kind === "file" ? (p.file_type ?? null) : null;
      patch.file_size = p.kind === "file" ? (p.file_size ?? null) : null;
      patch.embed_url = p.kind === "embed" ? (p.embed_url ?? null) : null;
      patch.provider = p.kind === "embed" ? (p.provider ?? null) : null;
    } else {
      if (p.body !== undefined) patch.body = p.body;
      if (p.file_path !== undefined) patch.file_path = p.file_path ?? null;
      if (p.file_name !== undefined) patch.file_name = p.file_name ?? null;
      if (p.file_type !== undefined) patch.file_type = p.file_type ?? null;
      if (p.file_size !== undefined) patch.file_size = p.file_size ?? null;
      if (p.embed_url !== undefined) patch.embed_url = p.embed_url ?? null;
      if (p.provider !== undefined) patch.provider = p.provider ?? null;
    }
    const { error } = await context.supabase
      .from("knowledge_items")
      .update(patch)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Deletes the row and the stored file (admin storage policy covers the remove). */
export const deleteKnowledgeItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertKnowledgeAdmin(context.supabase, context.userId);
    const { data: item, error: readErr } = await context.supabase
      .from("knowledge_items")
      .select("file_path")
      .eq("id", data.id)
      .single();
    if (readErr) throw new Error(readErr.message);

    const { error } = await context.supabase
      .from("knowledge_items")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (item.file_path) {
      await context.supabase.storage.from("knowledge-assets").remove([item.file_path]);
    }
    return { ok: true };
  });
