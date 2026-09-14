/** Parse a pasted Vimeo / Loom / YouTube URL into an embeddable player URL. */

export type EmbedProvider = "youtube" | "vimeo" | "loom";

export function parseEmbedUrl(
  raw: string,
): { provider: EmbedProvider; url: string } | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.slice(1).split("/")[0];
      if (id) return { provider: "youtube", url: `https://www.youtube.com/embed/${id}` };
    }
    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const id =
        u.searchParams.get("v") ?? u.pathname.match(/\/(shorts|embed|live)\/([\w-]+)/)?.[2];
      if (id) return { provider: "youtube", url: `https://www.youtube.com/embed/${id}` };
    }
    if (host === "vimeo.com" || host.endsWith(".vimeo.com")) {
      const id = u.pathname.match(/(\d{6,})/)?.[1];
      if (id) return { provider: "vimeo", url: `https://player.vimeo.com/video/${id}` };
    }
    if (host === "loom.com" || host.endsWith(".loom.com")) {
      const id = u.pathname.match(/\/(share|embed)\/([\w-]+)/)?.[2];
      if (id) return { provider: "loom", url: `https://www.loom.com/embed/${id}` };
    }
    return null;
  } catch {
    return null;
  }
}

export const EMBED_PROVIDER_LABEL: Record<EmbedProvider, string> = {
  youtube: "YouTube",
  vimeo: "Vimeo",
  loom: "Loom",
};
