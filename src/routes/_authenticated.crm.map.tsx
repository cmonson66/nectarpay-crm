import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Crosshair, MapPin, Radio, Search, UserPlus } from "lucide-react";
import {
  getMapData,
  getMyLocationSettings,
  importBusiness,
  searchNearby,
  setLocationSharing,
} from "@/lib/geo.functions";
import { LIVE_LOCATION_STALE_MS } from "@/lib/geo-schemas";
import { useLiveLocation } from "@/lib/use-live-location";
import { LeafletMap, PIN_COLOR, type MapPin as Pin } from "@/components/crm/leaflet-map";
import { PageSkeleton } from "@/components/crm/loading-state";
import {
  Chip,
  EmptyState,
  PageHeader,
  Pill,
  btn,
  fieldCls,
  fmtRel,
} from "@/components/crm/kit";
import { STATUS_LABEL } from "@/lib/lead-status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/crm/map")({
  component: MapPage,
  head: () => ({
    meta: [
      { title: "Map | NectarPay Sales CRM" },
      {
        name: "description",
        content:
          "Prospect on the map: nearby businesses, your pipeline pins, and where the team is working today.",
      },
      { property: "og:title", content: "Map | NectarPay Sales CRM" },
      {
        property: "og:description",
        content: "Nearby businesses, pipeline pins, and live team locations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const LEGEND: Array<{ kind: string; label: string }> = [
  { kind: "business", label: "Business" },
  { kind: "new", label: "New" },
  { kind: "contacted", label: "Contacted" },
  { kind: "contingent", label: "Contingent" },
  { kind: "won", label: "Won" },
  { kind: "rep", label: "Teammate" },
  { kind: "home", label: "Home base" },
];

const RADIUS_METERS = 4800; // fixed 3 mi search radius

function MapPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mapDataFn = useServerFn(getMapData);
  const settingsFn = useServerFn(getMyLocationSettings);
  const searchFn = useServerFn(searchNearby);
  const importFn = useServerFn(importBusiness);
  const sharingFn = useServerFn(setLocationSharing);

  const settings = useQuery({ queryKey: ["geo-settings"], queryFn: () => settingsFn() });
  const mapData = useQuery({
    queryKey: ["geo-map-data"],
    queryFn: () => mapDataFn(),
    refetchInterval: 60_000,
  });

  const sharing = settings.data?.sharingEnabled ?? false;
  const { coords, error: geoError, locating, locate } = useLiveLocation(sharing);

  const [keyword, setKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [viewCenter, setViewCenter] = useState<{ lat: number; lng: number } | null>(null);
  /** Where the last business search ran. Only changes on explicit search / recenter. */
  const [searchAt, setSearchAt] = useState<{ lat: number; lng: number } | null>(null);
  const [recenterSeq, setRecenterSeq] = useState(0);
  const [showPipeline, setShowPipeline] = useState(true);
  const [showTeam, setShowTeam] = useState(true);
  const [showBusinesses, setShowBusinesses] = useState(true);
  const [focusPin, setFocusPin] = useState<{ id: string; seq: number } | undefined>();




  const importLead = useMutation({
    mutationFn: (b: NonNullable<typeof search.data>["businesses"][number]) =>
      importFn({
        data: {
          placeId: b.placeId,
          name: b.name,
          addressLine1: b.addressLine1,
          city: b.city,
          state: b.state,
          postalCode: b.postalCode,
          phone: b.phone,
          businessType: b.primaryType,
          lat: b.lat,
          lng: b.lng,
        },
      }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["crm-pipeline"] });
      void queryClient.invalidateQueries({ queryKey: ["geo-map-data"] });
      toast.success(res.alreadyExisted ? "Already in your pipeline" : "Added to pipeline");
      navigate({ to: "/crm/leads/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSharing = useMutation({
    mutationFn: (enabled: boolean) => sharingFn({ data: { enabled } }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["geo-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["geo-map-data"] });
      toast.success(res.enabled ? "Sharing your location with your team" : "Location sharing off");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const homeBase = useMemo(() => {
    const s = settings.data;
    return s?.homeLat !== null && s?.homeLat !== undefined && s.homeLng !== null
      ? { lat: s.homeLat, lng: s.homeLng }
      : null;
  }, [settings.data]);

  const center = coords ?? homeBase ?? { lat: 32.7767, lng: -96.797 };
  // Searches run at the last committed point, NOT wherever the map happens to be
  // panned to — Google-style "search this area" instead of refetching on every drag.
  const searchCenter = searchAt ?? center;

  const search = useQuery({
    queryKey: [
      "geo-nearby",
      searchCenter.lat.toFixed(3),
      searchCenter.lng.toFixed(3),
      RADIUS_METERS,
      appliedKeyword,
    ],
    queryFn: () =>
      searchFn({
        data: {
          lat: searchCenter.lat,
          lng: searchCenter.lng,
          radiusMeters: RADIUS_METERS,
          keyword: appliedKeyword,
        },
      }),
    enabled: showBusinesses,
    staleTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });


  useEffect(() => {
    if (search.error) toast.error((search.error as Error).message);
  }, [search.error]);

  // Ask for the browser position once so the first view is already local.
  const askedRef = useRef(false);
  useEffect(() => {
    if (askedRef.current) return;
    askedRef.current = true;
    locate();
  }, [locate]);

  // Clicking a pin highlights the matching card and scrolls it into view.
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!focusPin) return;
    const el = cardRefs.current[focusPin.id];
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusPin]);

  const pins = useMemo<Pin[]>(() => {
    const out: Pin[] = [];

    if (showPipeline) {
      for (const lead of mapData.data?.leads ?? []) {
        out.push({
          id: `lead-${lead.id}`,
          lat: Number(lead.lat),
          lng: Number(lead.lng),
          kind: lead.status as Pin["kind"],
          title: lead.business_name ?? "Prospect",
          subtitle: [STATUS_LABEL[lead.status as keyof typeof STATUS_LABEL], lead.city]
            .filter(Boolean)
            .join(" · "),
          onSelect: () => navigate({ to: "/crm/leads/$id", params: { id: lead.id } }),
        });
      }
    }

    if (showTeam) {
      const fresh = Date.now() - LIVE_LOCATION_STALE_MS;
      for (const rep of mapData.data?.reps ?? []) {
        if (new Date(rep.updatedAt).getTime() < fresh) continue;
        out.push({
          id: `rep-${rep.userId}`,
          lat: rep.lat,
          lng: rep.lng,
          kind: rep.userId === mapData.data?.me ? "me" : "rep",
          title: rep.userId === mapData.data?.me ? "You" : rep.name,
          subtitle: `Updated ${fmtRel(rep.updatedAt)}`,
          emphasis: true,
        });
      }
      for (const home of mapData.data?.homeBases ?? []) {
        out.push({
          id: `home-${home.userId}`,
          lat: home.lat,
          lng: home.lng,
          kind: "home",
          title: `${home.name} — home base`,
          subtitle: home.address ?? undefined,
        });
      }
    }

    for (const b of (showBusinesses ? search.data?.businesses : undefined) ?? []) {
      out.push({
        id: `biz-${b.placeId}`,
        lat: b.lat,
        lng: b.lng,
        kind: "business",
        title: b.name,
        subtitle: b.inPipeline ? "Already in pipeline" : b.address,
        emphasis: true,
        onSelect: () =>
          setFocusPin((f) =>
            f?.id === `biz-${b.placeId}` ? f : { id: `biz-${b.placeId}`, seq: (f?.seq ?? 0) + 1 },
          ),
      });
    }

    return out;
  }, [mapData.data, search.data, showPipeline, showTeam, showBusinesses, navigate]);

  if (settings.isLoading || mapData.isLoading) return <PageSkeleton />;

  const runSearch = () => {
    setShowBusinesses(true);
    setAppliedKeyword(keyword.trim());
    setSearchAt(viewCenter ?? center);
  };

  const recenter = () => {
    setViewCenter(null);
    setSearchAt(null);
    setRecenterSeq((n) => n + 1);
    locate();
  };


  return (
    <div className="space-y-4">
      <PageHeader
        title="Map"
        subtitle="Find businesses around you, see your pipeline on the ground, and where the team is working."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btn.ghost}
              onClick={recenter}
              disabled={locating}
            >

              <Crosshair className="h-4 w-4" />
              {locating ? "Locating…" : "Use my location"}
            </button>
            <button
              type="button"
              className={sharing ? btn.primary : btn.ghost}
              onClick={() => toggleSharing.mutate(!sharing)}
              disabled={toggleSharing.isPending}
            >
              <Radio className="h-4 w-4" />
              {sharing ? "Sharing live" : "Share my location"}
            </button>
          </div>
        }
      />

      {geoError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {geoError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full min-w-0 flex-1 sm:min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
          <input
            className={cn(fieldCls, "pl-9")}
            placeholder="Search businesses — press Enter"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setShowPipeline((v) => !v)}
          className={cn("shrink-0", showPipeline ? btn.ghost : cn(btn.ghost, "opacity-50"))}
        >
          <MapPin className="h-3.5 w-3.5" /> Pipeline pins
        </button>
        <button
          type="button"
          onClick={() => setShowTeam((v) => !v)}
          className={cn("shrink-0", showTeam ? btn.ghost : cn(btn.ghost, "opacity-50"))}
        >
          <Radio className="h-3.5 w-3.5" /> Team & home bases
        </button>
        <button
          type="button"
          onClick={() => setShowBusinesses((v) => !v)}
          className={cn("shrink-0", showBusinesses ? btn.ghost : cn(btn.ghost, "opacity-50"))}
        >
          <Search className="h-3.5 w-3.5" /> Businesses
        </button>
      </div>


      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-[0_18px_48px_rgba(2,6,23,.55)]">
          <LeafletMap
            center={center}
            zoom={14}
            pins={pins}
            recenterKey={`${recenterSeq}:${center.lat.toFixed(4)},${center.lng.toFixed(4)}`}
            onMoveEnd={(c) => setViewCenter(c)}
            focus={focusPin}
            className="h-[52vh] min-h-[300px] w-full sm:h-[62vh] sm:min-h-[420px]"
          />
          <button
            type="button"
            title="Recenter on my location"
            disabled={locating}
            onClick={recenter}
            className="absolute right-3 top-3 z-[400] flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-slate-950/90 text-slate-200 shadow-lg backdrop-blur transition hover:border-amber-400/40 hover:text-amber-400 disabled:opacity-50"
          >
            <Crosshair className={cn("h-4 w-4", locating && "animate-spin")} />
          </button>
          <div className="pointer-events-none absolute bottom-3 left-3 z-[400] hidden flex-wrap gap-x-3 gap-y-1 rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-[11px] text-slate-200 backdrop-blur sm:flex">
            {LEGEND.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: PIN_COLOR[l.kind] }}
                />
                {l.label}
              </span>
            ))}
          </div>
          {search.isFetching ? (
            <div className="pointer-events-none absolute right-3 top-14 z-[400] rounded-full border border-white/10 bg-slate-950/80 px-3 py-1 text-[11px] text-slate-200 backdrop-blur">
              Loading businesses…
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-2">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide opacity-60">
            <span>Nearby businesses</span>
            <span>{search.data?.businesses.length ?? 0}</span>
          </div>

          {!showBusinesses ? (
            <EmptyState title="Businesses hidden" hint="Turn the Businesses layer back on." />
          ) : search.isLoading ? (
            <EmptyState title="Loading businesses…" hint="Pulling places around this area." />
          ) : (search.data?.businesses.length ?? 0) === 0 ? (
            <EmptyState title="No businesses found" hint="Try a wider radius or a different keyword." />
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1 lg:max-h-[62vh]">
              {(search.data?.businesses ?? []).map((b) => (
                <div
                  key={b.placeId}
                  ref={(el) => {
                    cardRefs.current[`biz-${b.placeId}`] = el;
                  }}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setFocusPin((f) => ({ id: `biz-${b.placeId}`, seq: (f?.seq ?? 0) + 1 }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter")
                      setFocusPin((f) => ({ id: `biz-${b.placeId}`, seq: (f?.seq ?? 0) + 1 }));
                  }}
                  className={cn(
                    "cursor-pointer rounded-lg border border-white/10 bg-white/[0.02] p-3 transition hover:border-amber-400/40 hover:bg-white/[0.05]",
                    focusPin?.id === `biz-${b.placeId}` && "border-amber-400/60 bg-amber-400/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{b.name}</div>
                      <div className="truncate text-xs opacity-60">{b.address}</div>
                      {b.phone ? <div className="text-xs opacity-60">{b.phone}</div> : null}
                    </div>
                    {b.inPipeline ? (
                      <Pill tone="green">In pipeline</Pill>
                    ) : (
                      <button
                        type="button"
                        className={btn.ghost}
                        onClick={(e) => {
                          e.stopPropagation();
                          importLead.mutate(b);
                        }}
                        disabled={importLead.isPending}
                      >
                        <UserPlus className="h-3.5 w-3.5" /> Add
                      </button>
                    )}
                  </div>
                  {b.primaryType ? (
                    <div className="mt-2">
                      <Chip>{b.primaryType.replace(/_/g, " ")}</Chip>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
