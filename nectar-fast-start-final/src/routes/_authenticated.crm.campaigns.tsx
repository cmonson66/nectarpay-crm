import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Megaphone, Mail, MousePointerClick } from "lucide-react";
import {
  getCampaignAudience,
  listCampaigns,
  sendCampaign,
} from "@/lib/comms.functions";
import {
  getEmailAudience,
  listEmailCampaigns,
  listRecentEmailClicks,
  sendEmailCampaign,
} from "@/lib/email-campaigns.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PageSkeleton } from "@/components/crm/loading-state";
import { formatPhone } from "@/lib/phone";

export const Route = createFileRoute("/_authenticated/crm/campaigns")({
  // Campaigns are a super-admin tool: one voice going out to the whole market.
  beforeLoad: async ({ context }) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/crm" });
  },
  component: CampaignsPage,
  head: () => ({
    meta: [
      { title: "Campaigns | NectarPay CRM" },
      {
        name: "description",
        content: "Send bulk texts and tracked email campaigns to your prospects.",
      },
      { property: "og:title", content: "Campaigns | NectarPay CRM" },
      {
        property: "og:description",
        content: "Send bulk texts and tracked email campaigns to your prospects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CampaignsPage() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <Megaphone className="h-5 w-5 text-primary" /> Campaigns
        </h1>
        <p className="text-sm text-muted-foreground">
          Bulk outreach to consented prospects. Email clicks alert the owning rep instantly.
        </p>
      </header>
      <Tabs defaultValue="sms">
        <TabsList>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>
        <TabsContent value="sms" className="mt-4">
          <SmsCampaigns />
        </TabsContent>
        <TabsContent value="email" className="mt-4">
          <EmailCampaigns />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SmsCampaigns() {
  const qc = useQueryClient();
  const audienceFn = useServerFn(getCampaignAudience);
  const listFn = useServerFn(listCampaigns);
  const sendFn = useServerFn(sendCampaign);

  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  const audience = useQuery({ queryKey: ["campaign-audience"], queryFn: () => audienceFn() });
  const campaigns = useQuery({ queryKey: ["campaigns"], queryFn: () => listFn() });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = audience.data ?? [];
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.business_name ?? ""} ${r.contact_name ?? ""} ${r.contact_phone_e164 ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [audience.data, search]);

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  const send = useMutation({
    mutationFn: () => sendFn({ data: { name, body, leadIds: selectedIds } }),
    onSuccess: (r) => {
      toast.success(`Sent ${r.sent}${r.failed ? `, ${r.failed} failed` : ""}`);
      setName("");
      setBody("");
      setSelected({});
      qc.invalidateQueries({ queryKey: ["campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (audience.isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Only prospects with texting consent and no opt-out appear here. Every message appends
        &ldquo;Reply STOP to opt out.&rdquo;
      </p>


      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Campaign name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="April terminal push"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="campaign-body">Message</Label>
            <Textarea
              id="campaign-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Hi {contact}, quick note about {business}…"
            />
            <p className="text-xs text-muted-foreground">
              Tokens: <code>{"{business}"}</code>, <code>{"{contact}"}</code>
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} recipient{selectedIds.length === 1 ? "" : "s"} selected
            </span>
            <Button
              disabled={!name.trim() || !body.trim() || selectedIds.length === 0 || send.isPending}
              onClick={() => send.mutate()}
            >
              {send.isPending ? "Sending…" : "Send campaign"}
            </Button>
          </div>

          <div className="border-t border-border/60 pt-3">
            <h2 className="mb-2 text-sm font-medium">Recent campaigns</h2>
            {(campaigns.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing sent yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {(campaigns.data ?? []).map((c) => (
                  <li key={c.id} className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.sent_count ?? 0} sent · {c.failed_count ?? 0} failed ·{" "}
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Audience ({filtered.length})</h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() =>
                  setSelected(Object.fromEntries(filtered.map((r) => [r.id, true])))
                }
              >
                Select all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
                Clear
              </Button>
            </div>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads…"
          />
          <div className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
            {filtered.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <Checkbox
                  checked={Boolean(selected[r.id])}
                  onCheckedChange={(v) =>
                    setSelected((s) => ({ ...s, [r.id]: Boolean(v) }))
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{r.business_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {formatPhone(r.contact_phone_e164)}
                  </span>
                </span>
              </label>
            ))}
            {filtered.length === 0 ? (
              <p className="py-4 text-xs text-muted-foreground">
                No consented, textable leads yet.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function EmailCampaigns() {
  const qc = useQueryClient();
  const audienceFn = useServerFn(getEmailAudience);
  const listFn = useServerFn(listEmailCampaigns);
  const clicksFn = useServerFn(listRecentEmailClicks);
  const sendFn = useServerFn(sendEmailCampaign);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");

  const audience = useQuery({ queryKey: ["email-audience"], queryFn: () => audienceFn() });
  const campaigns = useQuery({ queryKey: ["email-campaigns"], queryFn: () => listFn() });
  const clicks = useQuery({ queryKey: ["email-clicks"], queryFn: () => clicksFn() });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = audience.data ?? [];
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.business_name ?? ""} ${r.contact_name ?? ""} ${r.contact_email ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [audience.data, search]);

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  const send = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          name,
          subject,
          body,
          ctaLabel: ctaLabel.trim() || undefined,
          ctaUrl: ctaUrl.trim() || undefined,
          leadIds: selectedIds,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        `Queued ${r.sent}${r.failed ? `, ${r.failed} failed` : ""}${r.skipped ? `, ${r.skipped} skipped` : ""}`,
      );
      setName("");
      setSubject("");
      setBody("");
      setCtaLabel("");
      setCtaUrl("");
      setSelected({});
      qc.invalidateQueries({ queryKey: ["email-campaigns"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (audience.isLoading) return <PageSkeleton />;

  const canSend =
    name.trim() &&
    subject.trim() &&
    body.trim() &&
    selectedIds.length > 0 &&
    !send.isPending &&
    (!ctaLabel.trim() || ctaUrl.trim());

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Prospects with an email address who haven&rsquo;t unsubscribed. Every link is tracked —
        a click creates a callback task and alerts the owning rep.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="email-campaign-name">Campaign name</Label>
            <Input
              id="email-campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="April terminal push"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="{business} — accept crypto in 5 minutes"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={"Hi {first},\n\nQuick note about {business}…"}
            />
            <p className="text-xs text-muted-foreground">
              Tokens: <code>{"{business}"}</code>, <code>{"{contact}"}</code>,{" "}
              <code>{"{first}"}</code>
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="email-cta-label">Button label (optional)</Label>
              <Input
                id="email-cta-label"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="Book a demo"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-cta-url">Button link</Label>
              <Input
                id="email-cta-url"
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
                placeholder="https://nectar-pay.com/demo"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} recipient{selectedIds.length === 1 ? "" : "s"} selected
            </span>
            <Button disabled={!canSend} onClick={() => send.mutate()}>
              {send.isPending ? "Sending…" : "Send campaign"}
            </Button>
          </div>

          <div className="border-t border-border/60 pt-3">
            <h2 className="mb-2 text-sm font-medium">Recent email campaigns</h2>
            {(campaigns.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing sent yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {(campaigns.data ?? []).map((c) => (
                  <li key={c.id} className="flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {c.sent_count ?? 0} sent · {c.click_count ?? 0} clicks ·{" "}
                      {c.failed_count ?? 0} failed ·{" "}
                      {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-border/60 pt-3">
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <MousePointerClick className="h-4 w-4 text-primary" /> Recent clicks
            </h2>
            {(clicks.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No clicks yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {(clicks.data ?? []).map((c) => (
                  <li key={c.id} className="flex flex-wrap justify-between gap-2 text-xs">
                    <span className="truncate">{c.label || c.url}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {new Date(c.clicked_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-3 rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-medium">
              <Mail className="h-4 w-4 text-primary" /> Audience ({filtered.length})
            </h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSelected(Object.fromEntries(filtered.map((r) => [r.id, true])))}
              >
                Select all
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
                Clear
              </Button>
            </div>
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prospects…"
          />
          <div className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
            {filtered.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
              >
                <Checkbox
                  checked={Boolean(selected[r.id])}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, [r.id]: Boolean(v) }))}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">
                    {r.business_name || r.contact_name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {r.contact_email}
                  </span>
                </span>
              </label>
            ))}
            {filtered.length === 0 ? (
              <p className="py-4 text-xs text-muted-foreground">No emailable prospects yet.</p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
