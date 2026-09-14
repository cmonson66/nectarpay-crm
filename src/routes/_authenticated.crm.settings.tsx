import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Home, Radio } from "lucide-react";
import { getMyLocationSettings, setHomeBase, setLocationSharing } from "@/lib/geo.functions";
import { AddressAutocomplete } from "@/components/crm/address-autocomplete";
import { PageSkeleton } from "@/components/crm/loading-state";
import { PageHeader, btn, fieldCls } from "@/components/crm/kit";

export const Route = createFileRoute("/_authenticated/crm/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "My settings | NectarPay Sales CRM" },
      {
        name: "description",
        content: "Set your home base address and control whether you share your live location.",
      },
      { property: "og:title", content: "My settings | NectarPay Sales CRM" },
      {
        property: "og:description",
        content: "Home base address and live location sharing for your CRM account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SettingsPage() {
  const qc = useQueryClient();
  const settingsFn = useServerFn(getMyLocationSettings);
  const homeBaseFn = useServerFn(setHomeBase);
  const sharingFn = useServerFn(setLocationSharing);

  const settings = useQuery({ queryKey: ["geo-settings"], queryFn: () => settingsFn() });
  const [homeInput, setHomeInput] = useState<string | null>(null);

  const saveHome = useMutation({
    mutationFn: (address: string) => homeBaseFn({ data: { address } }),
    onSuccess: (res) => {
      if (!res.ok) {
        toast.error("Google couldn't place that address.");
        return;
      }
      setHomeInput(null);
      void qc.invalidateQueries({ queryKey: ["geo-settings"] });
      void qc.invalidateQueries({ queryKey: ["geo-map-data"] });
      toast.success("cleared" in res ? "Home base cleared" : "Home base saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSharing = useMutation({
    mutationFn: (enabled: boolean) => sharingFn({ data: { enabled } }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["geo-settings"] });
      void qc.invalidateQueries({ queryKey: ["geo-map-data"] });
      toast.success(res.enabled ? "Sharing your location with your team" : "Location sharing off");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (settings.isLoading) return <PageSkeleton />;

  const sharing = settings.data?.sharingEnabled ?? false;
  const value = homeInput ?? settings.data?.homeAddress ?? "";

  return (
    <div className="space-y-4">
      <PageHeader title="My settings" subtitle="Your home base and location sharing." />

      <div className="max-w-xl space-y-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Home className="h-4 w-4" /> Home base
            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Where you start your day. Used as your default map center and shown to your manager.
          </p>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[240px] flex-1">
              <AddressAutocomplete
                className={fieldCls}
                placeholder="123 Main St, Dallas, TX"
                value={value}
                onChange={setHomeInput}
                onSelect={(a) => setHomeInput(a.formattedAddress)}
              />
            </div>
            <button
              type="button"
              className={btn.primary}
              onClick={() => saveHome.mutate(value.trim())}
              disabled={saveHome.isPending}
            >
              {saveHome.isPending ? "Saving…" : "Save"}
            </button>
            {settings.data?.homeAddress ? (
              <button
                type="button"
                className={btn.ghost}
                onClick={() => saveHome.mutate("")}
                disabled={saveHome.isPending}
              >
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
            <Radio className="h-4 w-4" /> Live location sharing
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            While on, your latest position shows on the team map. No history is stored, and turning
            it off deletes your last position.
          </p>
          <button
            type="button"
            className={sharing ? btn.primary : btn.secondary}
            onClick={() => toggleSharing.mutate(!sharing)}
            disabled={toggleSharing.isPending}
          >
            {sharing ? "Sharing is on — turn off" : "Turn sharing on"}
          </button>
        </div>
      </div>
    </div>
  );
}
