import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, MessageSquare, Phone, PhoneCall, Radio } from "lucide-react";
import { getMessagingSettings, saveMessagingSettings } from "@/lib/comms.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageSkeleton } from "@/components/crm/loading-state";

export const Route = createFileRoute("/_authenticated/admin/messaging")({
  component: MessagingPage,
  head: () => ({
    meta: [
      { title: "Messaging & Calling · Nectar.Pay CRM" },
      {
        name: "description",
        content:
          "Configure the shared Twilio sending number and copy the webhook URLs the CRM needs for SMS, call status and browser calling.",
      },
      { property: "og:title", content: "Messaging & Calling · Nectar.Pay CRM" },
      {
        property: "og:description",
        content: "Twilio number and webhook configuration for the Nectar.Pay sales console.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function CopyField({
  label,
  hint,
  value,
  icon,
}: {
  label: string;
  hint: string;
  value: string;
  icon: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the text manually");
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={copy}>
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
          <span className="ml-1.5 hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <code className="mt-3 block break-all rounded-md bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
        {value}
      </code>
    </div>
  );
}

function MessagingPage() {
  const load = useServerFn(getMessagingSettings);
  const save = useServerFn(saveMessagingSettings);
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["messaging-settings"],
    queryFn: () => load(),
  });
  const [value, setValue] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (fromNumber: string) => save({ data: { fromNumber } }),
    onSuccess: () => {
      toast.success("Sending number saved");
      setValue(null);
      qc.invalidateQueries({ queryKey: ["messaging-settings"] });
    },
    onError: (e: unknown) => toast.error((e as Error).message),
  });

  if (isLoading) return <PageSkeleton />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const current = value ?? data?.fromNumber ?? "";
  const w = data?.webhooks;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold uppercase tracking-tight">Messaging &amp; calling</h1>
        <p className="text-sm text-muted-foreground">
          The shared Twilio number reps text and call from, plus the webhook URLs Twilio needs.
        </p>
      </header>

      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          <MessageSquare className="h-4 w-4" /> Sending number
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label className="text-xs text-muted-foreground" htmlFor="from-number">
              Shared sending number (Twilio)
            </label>
            <Input
              id="from-number"
              value={current}
              placeholder="+12145550123"
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate(current)}>
            Save
          </Button>
        </div>
      </section>

      {w ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
              Twilio webhooks
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Paste each URL into the matching field in the Twilio Console. All use HTTP POST.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <CopyField
              label="Incoming SMS"
              hint="Phone number → Messaging → A message comes in"
              value={w.inboundSms}
              icon={<MessageSquare className="h-4 w-4" />}
            />
            <CopyField
              label="SMS status callback"
              hint="Messaging service / number → Status callback URL"
              value={w.smsStatus}
              icon={<Radio className="h-4 w-4" />}
            />
            <CopyField
              label="Call status callback"
              hint="Voice → Call status changes"
              value={w.callStatus}
              icon={<PhoneCall className="h-4 w-4" />}
            />
            <CopyField
              label="TwiML App Voice URL"
              hint="TwiML App → Voice Request URL, and number → A call comes in"
              value={w.voiceApp}
              icon={<Phone className="h-4 w-4" />}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Browser calling needs the TwiML App Voice URL set on both the TwiML App&apos;s Voice
            Request URL and the phone number&apos;s &ldquo;A call comes in&rdquo; setting.
          </p>
        </section>
      ) : null}
    </div>
  );
}
