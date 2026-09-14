import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DocHeader, DocBody } from "@/components/knowledge-shell";
import { getMemberHeatPoints } from "@/lib/members-geo.functions";

export const Route = createFileRoute("/_authenticated/admin/knowledge/members-heatmap")({
  head: () => ({
    meta: [
      { title: "Members Heatmap · Knowledge · Nectar-PAY" },
      { name: "robots", content: "noindex,nofollow" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
        integrity: "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=",
        crossOrigin: "",
      },
    ],
  }),
  component: MembersHeatmapPage,
});

function MembersHeatmapPage() {
  const fetchPoints = useServerFn(getMemberHeatPoints);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "members-heatmap"],
    queryFn: () => fetchPoints(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <>
      <DocHeader
        eyebrow="Ecosystem · US Members"
        title="Members Heatmap"
        lede="TEXITcoin community members across the United States, geocoded by ZIP centroid. Anonymous — no PII stored."
      />
      <DocBody>
        <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          {isLoading ? <span>Loading…</span> : null}
          {error ? <span className="text-red-600">Failed to load</span> : null}
          {data ? (
            <>
              <span>
                <strong className="text-ink">{data.total.toLocaleString()}</strong> members
              </span>
              <span>
                <strong className="text-ink">{data.points.length.toLocaleString()}</strong> grid cells
              </span>
            </>
          ) : null}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Each member is snapped to a ~0.7-mile grid cell so nearby members merge into one weighted
          point — that's why the cell count is smaller than the member count. Color intensity is
          log-scaled so mid-size clusters stay visible next to mega-hotspots like DFW.
        </p>
        <HeatMap points={data?.points ?? []} />

        {data ? (
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 font-display text-lg font-semibold text-ink">Top states</h3>
              <ol className="space-y-1.5 text-sm">
                {data.topStates.map((s, i) => {
                  const pct = (s.count / data.total) * 100;
                  return (
                    <li key={s.state} className="flex items-center gap-3">
                      <span className="w-5 text-muted-foreground">{i + 1}.</span>
                      <span className="w-10 font-mono font-medium text-ink">{s.state}</span>
                      <div className="relative h-2 flex-1 overflow-hidden rounded bg-muted">
                        <div
                          className="absolute inset-y-0 left-0 bg-honey-deep"
                          style={{ width: `${Math.min(100, pct * 4)}%` }}
                        />
                      </div>
                      <span className="w-14 text-right font-mono text-ink">
                        {s.count.toLocaleString()}
                      </span>
                      <span className="w-12 text-right text-muted-foreground">
                        {pct.toFixed(1)}%
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="mb-3 font-display text-lg font-semibold text-ink">
                Top metro clusters
              </h3>
              <p className="mb-3 text-xs text-muted-foreground">
                ~7-mile grid. Click a row to jump the map there.
              </p>
              <ol className="space-y-1 text-sm">
                {data.topMetros.map((m, i) => (
                  <li key={`${m.lat},${m.lng}`}>
                    <a
                      href={`https://www.google.com/maps/@${m.lat},${m.lng},11z`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded px-2 py-1 hover:bg-muted"
                    >
                      <span className="w-5 text-muted-foreground">{i + 1}.</span>
                      <span className="flex-1 font-mono text-xs text-muted-foreground">
                        {m.lat.toFixed(2)}, {m.lng.toFixed(2)}
                      </span>
                      <span className="font-mono font-medium text-ink">
                        {m.count.toLocaleString()}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : null}
      </DocBody>
    </>
  );
}

function HeatMap({ points }: { points: Array<{ lat: number; lng: number; count: number }> }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<unknown>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet.heat");
      if (cancelled || !containerRef.current) return;

      const LAny = L as unknown as {
        map: (el: HTMLElement, opts?: unknown) => unknown;
        tileLayer: (url: string, opts?: unknown) => { addTo: (m: unknown) => unknown };
        heatLayer: (
          data: Array<[number, number, number]>,
          opts?: unknown,
        ) => { addTo: (m: unknown) => unknown; setLatLngs: (d: Array<[number, number, number]>) => void };
      };

      if (!mapRef.current) {
        const m = LAny.map(containerRef.current, {
          center: [39.5, -98.35],
          zoom: 4,
          scrollWheelZoom: true,
        });
        LAny.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap",
          maxZoom: 18,
        }).addTo(m);
        mapRef.current = m;
      }

      // Log-scale weights so a few mega-hotspots don't wash out mid-size clusters.
      const maxCount = points.reduce((a, p) => Math.max(a, p.count), 1);
      const logMax = Math.log(maxCount + 1);
      const heatData = points.map(
        (p) => [p.lat, p.lng, Math.log(p.count + 1) / logMax] as [number, number, number],
      );

      if (layerRef.current) {
        (layerRef.current as { setLatLngs: (d: Array<[number, number, number]>) => void }).setLatLngs(heatData);
      } else {
        layerRef.current = LAny.heatLayer(heatData, {
          radius: 14,
          blur: 18,
          maxZoom: 11,
          minOpacity: 0.35,
          gradient: {
            0.0: "#312e81", // indigo-900
            0.25: "#2563eb", // blue-600
            0.5: "#10b981", // emerald-500
            0.7: "#facc15", // yellow-400
            0.9: "#f97316", // orange-500
            1.0: "#dc2626", // red-600
          },
        }).addTo(mapRef.current);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [points]);

  return (
    <div
      ref={containerRef}
      className="h-[70vh] w-full overflow-hidden rounded-xl border border-border"
    />
  );
}
