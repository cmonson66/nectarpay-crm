import { useEffect, useRef, useState } from "react";
import { Maximize2, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { geocodeLead, getNearbyLeads, searchNearby, importBusiness } from "@/lib/geo.functions";
import { LeafletMap, type MapPin } from "@/components/crm/leaflet-map";
import { Card, Pill, btn } from "@/components/crm/kit";
import { cn } from "@/lib/utils";

/** Fixed search radius — no UI selector. */
const RADIUS_MILES = 3;
const RADIUS_METERS = 4_800;

/**
 * Live Google businesses around the prospect's address. The address is
 * geocoded automatically only to establish the search center; nearby results
 * never depend on CRM records having been imported or pinned.
 */
export function NearbyProspects({ leadId }: { leadId: string }) {
  const queryClient = useQueryClient();
  const nearbyFn = useServerFn(getNearbyLeads);
  const geocodeFn = useServerFn(geocodeLead);
  const searchFn = useServerFn(searchNearby);
  const importFn = useServerFn(importBusiness);
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [focusPin, setFocusPin] = useState<{ id: string; seq: number } | undefined>();

  const focusBusiness = (placeId: string) =>
    setFocusPin((f) => ({ id: `google-${placeId}`, seq: (f?.seq ?? 0) + 1 }));

  const nearby = useQuery({
    queryKey: ["nearby-leads", leadId],
    queryFn: () => nearbyFn({ data: { leadId, radiusMiles: RADIUS_MILES } }),
  });

  const silentRef = useRef(false);
  const geocode = useMutation({
    mutationFn: () => geocodeFn({ data: { id: leadId } }),
    onSuccess: (res) => {
      const silent = silentRef.current;
      silentRef.current = false;
      if (!res.ok) {
        if (!silent) {
          toast.error(
            res.reason === "no_address"
              ? "Add a street address to this prospect first."
              : "Google couldn't place that address.",
          );
        }
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ["nearby-leads", leadId] });
      if (!silent) toast.success("Location pinned");
    },
    onError: (e: Error) => {
      const silent = silentRef.current;
      silentRef.current = false;
      if (!silent) toast.error(e.message);
    },
  });

  const center = nearby.data?.center ?? null;

  const importLead = useMutation({
    mutationFn: (b: {
      placeId: string;
      name: string;
      addressLine1?: string | null;
      city?: string | null;
      state?: string | null;
      postalCode?: string | null;
      phone?: string | null;
      primaryType?: string | null;
      lat: number;
      lng: number;
    }) =>
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
      void queryClient.invalidateQueries({
        queryKey: ["lead-nearby-google-businesses", leadId],
      });
      toast.success(res.alreadyExisted ? "Already in your pipeline" : "Added to pipeline");
      setExpanded(false);
      void navigate({ to: "/crm/leads/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const businesses = useQuery({
    queryKey: ["lead-nearby-google-businesses", leadId, center?.lat, center?.lng],
    queryFn: () =>
      searchFn({
        data: {
          lat: center?.lat ?? 0,
          lng: center?.lng ?? 0,
          radiusMeters: RADIUS_METERS,
          keyword: "",
        },
      }),
    enabled: Boolean(center),
    staleTime: 5 * 60_000,
  });

  // Legacy prospects saved before auto-pinning: place them silently on load.
  const autoTried = useRef(false);
  useEffect(() => {
    if (autoTried.current) return;
    if (nearby.isLoading || center || !nearby.data?.hasAddress) return;
    autoTried.current = true;
    silentRef.current = true;
    geocode.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearby.isLoading, center, nearby.data?.hasAddress]);

  if (nearby.isLoading) {
    return (
      <Card title="Nearby businesses">
        <p className="text-[12.5px] text-muted-foreground">Loading map…</p>
      </Card>
    );
  }

  if (!center) {
    return (
      <Card title="Nearby businesses">
        <div className="space-y-2 text-[12.5px] text-muted-foreground">
          <p>
            {nearby.data?.hasAddress
              ? geocode.isPending
                ? "Finding nearby businesses…"
                : "Google couldn't locate this address. Check the street address and try again."
              : "Add a street address to find nearby businesses."}
          </p>
        </div>
      </Card>
    );
  }

  const nearbyBusinesses = businesses.data?.businesses ?? [];

  const pins: MapPin[] = [
    {
      id: center.id,
      lat: center.lat,
      lng: center.lng,
      kind: center.status as MapPin["kind"],
      title: center.name ?? "This prospect",
      emphasis: true,
    },
    ...nearbyBusinesses.map((business) => ({
      id: `google-${business.placeId}`,
      lat: business.lat,
      lng: business.lng,
      kind: "business" as const,
      title: business.name,
      subtitle: business.inPipeline ? "Already in pipeline" : business.address,
    })),
  ];

  return (
    <Card title="Nearby businesses">
      <div className="space-y-3">
        <div className="relative">
          <LeafletMap
            center={center}
            zoom={14}
            pins={pins}
            recenterKey={center.id}
            focus={focusPin}
            className="h-64 w-full overflow-hidden rounded-lg border border-white/10"
          />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            title="Expand map"
            className="absolute right-2 top-2 z-[1000] rounded-md border border-white/10 bg-black/70 p-1.5 text-white/80 backdrop-blur transition-colors hover:bg-black/90 hover:text-white"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>

        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent className="flex h-[85vh] max-w-5xl flex-col gap-3">
            <DialogHeader>
              <DialogTitle>
                Nearby businesses · {center.name ?? "This prospect"}
              </DialogTitle>
            </DialogHeader>
            {expanded ? (
              <LeafletMap
                center={center}
                zoom={14}
                pins={pins}
                recenterKey={`expanded-${center.id}`}
                focus={focusPin}
                className="min-h-0 w-full flex-1 overflow-hidden rounded-lg border border-white/10"
              />
            ) : null}
          </DialogContent>
        </Dialog>

        {businesses.isLoading ? (
          <p className="text-[12.5px] text-muted-foreground">
            Loading current Google business results…
          </p>
        ) : businesses.isError ? (
          <p className="text-[12.5px] text-destructive">
            {(businesses.error as Error).message}
          </p>
        ) : nearbyBusinesses.length === 0 ? (
          <p className="text-[12.5px] text-muted-foreground">
            Google found no businesses within {RADIUS_MILES} mi.
          </p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1 text-[12.5px]">
            {nearbyBusinesses.map((business) => (
              <div
                key={business.placeId}
                role="button"
                tabIndex={0}
                onClick={() => focusBusiness(business.placeId)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") focusBusiness(business.placeId);
                }}
                className={cn(
                  "flex cursor-pointer items-start justify-between gap-2 rounded px-1 py-1.5 transition hover:bg-white/[0.05]",
                  focusPin?.id === `google-${business.placeId}` && "bg-amber-400/10",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{business.name}</span>
                  <span className="block truncate text-muted-foreground">{business.address}</span>
                </span>
                {business.inPipeline ? (
                  <Pill tone="green">In pipeline</Pill>
                ) : (
                  <button
                    type="button"
                    className={cn(btn.ghost, "shrink-0")}
                    disabled={importLead.isPending}
                    onClick={(e) => {
                      e.stopPropagation();
                      importLead.mutate(business);
                    }}
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Add
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
