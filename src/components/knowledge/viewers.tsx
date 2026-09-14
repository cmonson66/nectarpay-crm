import { useEffect, useState } from "react";
import DOMPurify from "dompurify";
import { Download, FileText, Loader2 } from "lucide-react";
import { btn } from "@/components/crm/kit";

/** Renders stored article HTML, sanitized client-side after mount (DOMPurify needs a DOM). */
export function SafeHtml({ html, className }: { html: string; className?: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className={className} />;
  const clean = DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}

export function EmbedViewer({ url, title }: { url: string; title: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
      <iframe
        src={url}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}

export function fmtBytes(n: number | null | undefined) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function FileViewer({
  url,
  fileName,
  fileType,
}: {
  url: string | null;
  fileName: string;
  fileType: string | null;
}) {
  if (!url) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-[13px] text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Preparing file…
      </div>
    );
  }
  if (fileType?.startsWith("video/")) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-black">
        <video src={url} controls playsInline className="aspect-video w-full" />
      </div>
    );
  }
  if (fileType === "application/pdf") {
    return (
      <div className="overflow-hidden rounded-xl border border-border">
        <iframe src={url} title={fileName} className="h-[75vh] w-full bg-white" />
      </div>
    );
  }
  if (fileType?.startsWith("image/")) {
    return (
      <img
        src={url}
        alt={fileName}
        className="w-full rounded-xl border border-border object-contain"
      />
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card p-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-honey/15 text-honey-text">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold">{fileName}</div>
          <div className="text-[12px] text-muted-foreground">{fileType || "File"}</div>
        </div>
      </div>
      <a href={url} download={fileName} className={btn.primary}>
        <Download className="h-4 w-4" /> Download
      </a>
    </div>
  );
}
