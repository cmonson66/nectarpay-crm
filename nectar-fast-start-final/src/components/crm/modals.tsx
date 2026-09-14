/**
 * Shared CRM modals: new prospect, log a sale / contingent trial, schedule a
 * follow-up. Presentation + existing server functions only.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { purchaseAgreementSections, trialAgreementSections } from "@/lib/agreement-terms";

import QRCode from "qrcode";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarIcon, Check, Loader2, MapPin, Minus, Plus, ScanLine, Search } from "lucide-react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { LEAD_SOURCES, createLead } from "@/lib/crm.functions";
import { getDealDocsShareToken } from "@/lib/deal-documents.functions";
import { DEMO_SALE_PRICE, PAYMENT_METHODS, createDeal, createDealInvoice, createTask, getDealPaymentStatus, listLeadDeals, signDealContract } from "@/lib/deals.functions";
import { searchBusinesses } from "@/lib/places.functions";
import type { BusinessResult } from "@/lib/places.server";
import { Chip, Field, btn, fieldCls, fmtMoney } from "@/components/crm/kit";
import { BarcodeScannerDialog } from "@/components/crm/barcode-scanner";
import { AddressAutocomplete } from "@/components/crm/address-autocomplete";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export const SOURCE_LABEL: Record<string, string> = {
  cold_walk_in: "Cold walk-in",
  referral: "Referral",
  web_intake: "Web intake",
  campaign: "Campaign",
  manual: "Manual",
};

/** Fixed company pricing — reps cannot change these. */
export const DEAL_TERMS = {
  hardware_amount: 499,
  subscription_monthly: 49.99,
  subscription_months: 12,
} as const;

/** Monthly subscription tiers — all billed annually (12 months up front). */
export const SUBSCRIPTION_PLANS = [24.99, 49.99, 99.99] as const;
export const DEFAULT_PLAN = 49.99;


/* ── New prospect ───────────────────────────────────────────────── */

const EMPTY_PROSPECT_FORM = {
  business_name: "",
  contact_name: "",
  contact_phone: "",
  city: "",
  state: "",
  address_line1: "",
  postal_code: "",
  source: "cold_walk_in" as (typeof LEAD_SOURCES)[number],
  sms_consent: false,
};

export function NewProspectModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createLead);
  const search = useServerFn(searchBusinesses);
  const [form, setForm] = useState(EMPTY_PROSPECT_FORM);
  const [bizQuery, setBizQuery] = useState("");
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const skipNextSearch = useRef(false);

  // Debounced Google Business search (server-side, min 3 chars).
  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    const q = bizQuery.trim();
    if (q.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const r = await search({ data: { query: q } });
        setResults(r);
        setShowResults(true);
      } catch (e) {
        console.error(e);
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => {
      clearTimeout(t);
      setSearching(false);
    };
  }, [bizQuery, search]);

  const pickBusiness = (b: BusinessResult) => {
    skipNextSearch.current = true;
    setBizQuery(b.name);
    setResults([]);
    setShowResults(false);
    setForm((f) => ({
      ...f,
      business_name: b.name,
      contact_phone: f.contact_phone || b.phone,
      city: b.city || f.city,
      state: b.state || f.state,
      address_line1: b.addressLine1,
      postal_code: b.postalCode,
    }));
  };

  const save = useMutation({
    mutationFn: () =>
      create({
        data: {
          business_name: form.business_name.trim(),
          contact_name: form.contact_name.trim(),
          contact_phone: form.contact_phone.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          address_line1: form.address_line1.trim(),
          postal_code: form.postal_code.trim(),
          status: "new",
          source: form.source,
          sms_consent: form.sms_consent,
        },
      }),
    onSuccess: (r) => {
      toast.success("Prospect created");
      qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
      onOpenChange(false);
      setForm(EMPTY_PROSPECT_FORM);
      setBizQuery("");
      setResults([]);
      setShowResults(false);
      navigate({ to: "/crm/leads/$id", params: { id: r.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create prospect"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[16px]">New prospect</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="card-label">Find on Google</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                className={cn(fieldCls, "pl-8 pr-8")}
                value={bizQuery}
                onChange={(e) => setBizQuery(e.target.value)}
                onFocus={() => results.length > 0 && setShowResults(true)}
                onBlur={() => setTimeout(() => setShowResults(false), 150)}
                placeholder="Search a business name to autofill…"
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {showResults && results.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
                  {results.map((r) => (
                    <button
                      key={r.placeId}
                      type="button"
                      className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-inset"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickBusiness(r)}
                    >
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">{r.name}</span>
                        <span className="block truncate text-[11.5px] text-muted-foreground">
                          {r.address}
                          {r.phone ? ` · ${r.phone}` : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <Field label="Business name">
            <input
              className={fieldCls}
              value={form.business_name}
              onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
              placeholder="Corner Market"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Contact">
              <input
                className={fieldCls}
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                placeholder="Owner name"
              />
            </Field>
            <Field label="Phone">
              <input
                className={fieldCls}
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                placeholder="(555) 010-2233"
              />
            </Field>
          </div>
          <Field label="Address">
            <AddressAutocomplete
              className={fieldCls}
              value={form.address_line1}
              onChange={(v) => setForm((f) => ({ ...f, address_line1: v }))}
              onSelect={(a) =>
                setForm((f) => ({
                  ...f,
                  address_line1: a.addressLine1 || f.address_line1,
                  city: a.city || f.city,
                  state: a.state || f.state,
                  postal_code: a.postalCode || f.postal_code,
                }))
              }
              placeholder="123 Main St"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="City">
              <input
                className={fieldCls}
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
              />
            </Field>
            <Field label="State">
              <input
                className={fieldCls}
                value={form.state}
                onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}
              />
            </Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="card-label">Source</span>
            <div className="flex flex-wrap gap-1.5">
              {LEAD_SOURCES.map((s) => (
                <Chip
                  key={s}
                  active={form.source === s}
                  onClick={() => setForm((f) => ({ ...f, source: s }))}
                >
                  {SOURCE_LABEL[s] ?? s}
                </Chip>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 rounded-lg border border-border bg-inset px-2.5 py-2 text-[12.5px]">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--honey)]"
              checked={form.sms_consent}
              onChange={(e) => setForm((f) => ({ ...f, sms_consent: e.target.checked }))}
            />
            <span className="text-secondary-text">
              This contact agreed to receive texts from NectarPay
            </span>
          </label>
        </div>
        <DialogFooter>
          <button type="button" className={btn.secondary} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={btn.primary}
            disabled={!form.business_name.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Create prospect"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Log a sale / contingent trial ──────────────────────────────── */

/** The Beekeeper URL never changes, so its QR is rendered once per session. */
const BEEKEEPER_URL = "https://beekeeper.money/";
let beekeeperQrCache = "";
let beekeeperQrPending: Promise<string> | null = null;
const beekeeperQrPromise = () => {
  if (beekeeperQrCache) return Promise.resolve(beekeeperQrCache);
  beekeeperQrPending ??= QRCode.toDataURL(BEEKEEPER_URL, { margin: 2, width: 240 }).then((url) => {
    beekeeperQrCache = url;
    return url;
  });
  return beekeeperQrPending;
};

/** Terminals covered by a single monthly subscription, per plan. */
export const PLAN_TERMINAL_ALLOWANCE: Record<string, number> = { "99.99": 10 };

/** How many monthly subscriptions a terminal count requires on a plan. */
export const billablePlanUnits = (monthly: number, terminals: number) =>
  Math.max(1, Math.ceil(terminals / (PLAN_TERMINAL_ALLOWANCE[String(monthly)] ?? 1)));

/** Base hardware per terminal + the required plan subscriptions billed annually. */
const firstYearTotal = (monthly: number, terminals = 1) =>
  DEAL_TERMS.hardware_amount * terminals +
  monthly * billablePlanUnits(monthly, terminals) * DEAL_TERMS.subscription_months;


export function LogSaleModal({
  leadId,
  open,
  onOpenChange,
  onLogged,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onLogged?: (kind: "sale" | "contingent") => void;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createDeal);
  const sign = useServerFn(signDealContract);
  const makeInvoice = useServerFn(createDealInvoice);
  const getPaymentStatus = useServerFn(getDealPaymentStatus);
  const listDeals = useServerFn(listLeadDeals);
  const getDocsToken = useServerFn(getDealDocsShareToken);
  const { isAdmin } = useRouteContext({ from: "/_authenticated/crm" });

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [pendingDealId, setPendingDealId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [beekeeperQr, setBeekeeperQr] = useState(beekeeperQrCache);
  const [type, setType] = useState<"sale" | "contingent">("sale");
  const [terminals, setTerminals] = useState(1);
  const [term, setTerm] = useState(14);
  const [plan, setPlan] = useState<number>(DEFAULT_PLAN);
  const [deviceId, setDeviceId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [demo, setDemo] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [coinId, setCoinId] = useState("");
  const [maxStep, setMaxStep] = useState<1 | 2 | 3 | 4>(1);
  const [coinScanOpen, setCoinScanOpen] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [hasSignature, setHasSignature] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [invoiceStarted, setInvoiceStarted] = useState(false);
  const [checkoutFrameLoaded, setCheckoutFrameLoaded] = useState(false);
  const [frameNonce, setFrameNonce] = useState(0);

  const [showQrFallback, setShowQrFallback] = useState(false);
  const [checkoutExpiresAt, setCheckoutExpiresAt] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const isMobile = useIsMobile();
  const mobileQrDefaulted = useRef(false);

  // On phones the hosted checkout iframe is unusable; lead with the scannable QR.
  useEffect(() => {
    if (!open) { mobileQrDefaulted.current = false; return; }
    if (step !== 4 || !isMobile || mobileQrDefaulted.current) return;
    mobileQrDefaulted.current = true;
    setShowQrFallback(true);
  }, [open, step, isMobile]);


  const devicesQuery = useQuery({
    queryKey: ["lead-deals", leadId],
    queryFn: () => listDeals({ data: { lead_id: leadId } }),
    enabled: open,
  });
  const availableDevices = devicesQuery.data?.availableDevices ?? [];

  useEffect(() => {
    setMaxStep((m) => (step > m ? step : m));
  }, [step]);
  useEffect(() => {
    if (!open) {
      setMaxStep(1);
    }
  }, [open]);

  const storageKey = `nectar.logsale.${leadId}`;
  const [restored, setRestored] = useState(false);

  const clearSaved = () => {
    setRestored(false);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      /* storage unavailable */
    }
  };

  useEffect(() => {
    if (!open) {
      setRestored(false);
      return;
    }
    // Resume an in-flight checkout when the rep closes and reopens the modal.
    let saved: Record<string, unknown> | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      saved = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
    } catch {
      saved = null;
    }

    setQrCode("");
    setHasSignature(false);
    setInvoiceStarted(false);
    setCheckoutExpiresAt(null);
    setCheckoutFrameLoaded(false);
    setShowQrFallback(false);

    if (saved && typeof saved['pendingDealId'] === "string" && saved['pendingDealId']) {
      setPendingDealId(saved['pendingDealId'] as string);
      setStep((saved['step'] as 1 | 2 | 3 | 4) ?? 2);
      setType((saved['type'] as "sale" | "contingent") ?? "sale");
      setTerminals((saved['terminals'] as number) ?? 1);
      setTerm((saved['term'] as number) ?? 14);
      setPlan((saved['plan'] as number) ?? DEFAULT_PLAN);
      setDeviceId((saved['deviceId'] as string) ?? "");
      setPaymentMethod((saved['paymentMethod'] as string) ?? PAYMENT_METHODS[0]);
      setDemo(Boolean(saved['demo']));
      setCoinId((saved['coinId'] as string) ?? "");
      setSignerName((saved['signerName'] as string) ?? "");
      setAgreedToTerms(Boolean(saved['agreedToTerms']));
      setRestored(true);
      return;
    }

    setStep(1);
    setPendingDealId("");
    setSignerName("");
    setAgreedToTerms(false);
    setRestored(true);
  }, [open, storageKey]);

  useEffect(() => {
    if (!open || !restored) return;
    if (!pendingDealId) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          pendingDealId,
          step,
          type,
          terminals,
          term,
          plan,
          deviceId,
          paymentMethod,
          demo,
          coinId,
          signerName,
          agreedToTerms,
        }),
      );
    } catch {
      /* storage unavailable */
    }
  }, [
    open,
    restored,
    storageKey,
    pendingDealId,
    step,
    type,
    terminals,
    term,
    plan,
    deviceId,
    paymentMethod,
    demo,
    coinId,
    signerName,
    agreedToTerms,
  ]);

  useEffect(() => {
    if (step !== 4) return;
    const tick = () => setClock(Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (beekeeperQr) return;
    let cancelled = false;
    void beekeeperQrPromise()
      .then((url) => {
        if (!cancelled) setBeekeeperQr(url);
      })
      .catch(() => toast.error("Could not create the Beekeeper QR code"));
    return () => {
      cancelled = true;
    };
  }, [beekeeperQr]);

  useEffect(() => {
    if (step !== 3) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#1f2937";
    setHasSignature(false);
    setAgreedToTerms(false);
  }, [step]);

  const getPoint = (event: { clientX: number; clientY: number }) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  };

  const startDrawing = (event: { clientX: number; clientY: number }) => {
    const point = getPoint(event);
    const context = canvasRef.current?.getContext("2d");
    if (!point || !context) return;
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const draw = (event: { clientX: number; clientY: number }) => {
    if (!drawingRef.current) return;
    const point = getPoint(event);
    const context = canvasRef.current?.getContext("2d");
    if (!point || !context) return;
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    drawingRef.current = false;
  };

  /** Match a scanned/typed serial against the available terminal list. */
  const handleScan = (raw: string) => {
    const serial = raw.trim().toLowerCase();
    if (!serial) return;
    const match = availableDevices.find((d) => d.serial_number.trim().toLowerCase() === serial);
    if (match) {
      setDeviceId(match.id);
      toast.success(`Terminal ${match.serial_number} selected`);
    } else {
      toast.error(`${raw.trim()} isn't an available terminal — check inventory or pick from the list`);
    }
  };

  /** Match a typed/scanned 6-digit coin ID against terminals that have a coin linked. */
  const handleCoin = (raw: string) => {
    const digits = raw.trim().match(/\d{6}/)?.[0] ?? "";
    if (!digits) {
      toast.error("Coin ID must be 6 digits");
      return;
    }
    const match = availableDevices.find((d) => d.coin_id === digits);
    if (match) {
      setDeviceId(match.id);
      setCoinId(digits);
      toast.success(`Coin ${digits} → terminal ${match.serial_number}`);
    } else {
      toast.error(`Coin ${digits} isn't linked to an available terminal`);
    }
  };

  const planUnits = billablePlanUnits(plan, terminals);
  const suggested = firstYearTotal(plan, terminals);
  const numericValue = suggested;
  const isDemo = type === "sale" && demo;

  // Same text the signed PDF is generated from.
  const agreementSections = useMemo(() => {
    const serial = availableDevices.find((d) => d.id === deviceId)?.serial_number ?? "unassigned";
    const monthly = plan * billablePlanUnits(plan, terminals);

    if (type === "contingent") {
      const start = new Date();
      const end = new Date(start.getTime() + term * 86_400_000);
      return trialAgreementSections({
        serial,
        trialStart: start.toISOString().slice(0, 10),
        trialEnd: end.toISOString().slice(0, 10),
        trialDays: term,
        hardwareAmount: DEAL_TERMS.hardware_amount,
        subscriptionMonthly: plan,
      });
    }
    const total = isDemo ? DEMO_SALE_PRICE : numericValue;
    const hardware = Math.max(0, total - monthly * DEAL_TERMS.subscription_months);
    return purchaseAgreementSections({
      serial,
      hardwareAmount: hardware,
      subscriptionMonthly: monthly,
      subscriptionMonths: DEAL_TERMS.subscription_months,
      totalAmount: total,
      paymentMethod: isDemo ? null : paymentMethod,
    });
  }, [type, term, terminals, deviceId, availableDevices, isDemo, numericValue, paymentMethod, plan]);


  const paymentQuery = useQuery({
    queryKey: ["deal-payment-status", pendingDealId],
    queryFn: () => getPaymentStatus({ data: { id: pendingDealId } }),
    enabled: open && step === 4 && Boolean(pendingDealId),
    refetchInterval: 5000,
  });

  const paid =
    paymentQuery.data?.status === "won" || paymentQuery.data?.nectarpay_status === "paid";
  useEffect(() => {
    // Once payment lands there is nothing left to resume.
    if (paid) clearSaved();
  }, [paid]);

  // Customer-facing QR: opens a page to download the signed contract + invoice.
  const [docsQr, setDocsQr] = useState("");
  const [docsUrl, setDocsUrl] = useState("");
  useEffect(() => {
    if (!paid || !pendingDealId || docsQr) return;
    let cancelled = false;
    void (async () => {
      try {
        const { token } = await getDocsToken({ data: { deal_id: pendingDealId } });
        const url = `${window.location.origin}/api/public/docs/${token}`;
        const dataUrl = await QRCode.toDataURL(url, { margin: 2, width: 240 });
        if (cancelled) return;
        setDocsUrl(url);
        setDocsQr(dataUrl);
      } catch {
        /* The confirmation still stands without the download QR. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paid, pendingDealId, docsQr, getDocsToken]);



  const invoice = useMutation({
    mutationFn: () => makeInvoice({ data: { id: pendingDealId, chain: "btc" } }),
    onSuccess: async (result) => {
      setCheckoutExpiresAt(result.expiresAt ?? null);
      setCheckoutFrameLoaded(false);
      setFrameNonce((n) => n + 1);
      setShowQrFallback(false);
      if (result.checkoutUrl) {
        try {
          setQrCode(await QRCode.toDataURL(result.checkoutUrl, { margin: 2, width: 240 }));
        } catch {
          toast.error("Could not create the payment QR code");
        }
      }
      toast.success("Nectar.Pay checkout is ready");
      qc.invalidateQueries({ queryKey: ["deal-payment-status", pendingDealId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create payment checkout"),
  });

  useEffect(() => {
    // The server rejects an invoice before the contract is signed, so the
    // checkout can only be created once we reach the payment step.
    if (!pendingDealId || invoiceStarted) return;
    if (step < 4) return;

    setInvoiceStarted(true);
    invoice.mutate();
  }, [step, pendingDealId, invoiceStarted]);



  const checkoutExpiresAtValue = checkoutExpiresAt ?? paymentQuery.data?.nectarpay_expires_at ?? null;
  const checkoutExpired = Boolean(
    checkoutExpiresAtValue && new Date(checkoutExpiresAtValue).getTime() <= clock,
  );
  const checkoutMinutesRemaining = checkoutExpiresAtValue
    ? Math.max(0, Math.ceil((new Date(checkoutExpiresAtValue).getTime() - clock) / 60000))
    : null;

  const save = useMutation({
    mutationFn: () => {
      const subscription = plan * planUnits;
      const hardware = Math.max(0, numericValue - subscription * DEAL_TERMS.subscription_months);
      return create({
        data: {
          lead_id: leadId,
          type,
          hardware_amount: type === "sale" ? hardware : DEAL_TERMS.hardware_amount,
          subscription_monthly: type === "sale" ? subscription : plan,
          subscription_months: DEAL_TERMS.subscription_months,
          device_id: deviceId,
          duration_days: type === "contingent" ? term : undefined,
          is_demo: isDemo,
          payment_method: isDemo ? null : paymentMethod,
          notes: isDemo
            ? "Demo sale — flat $250"
            : type === "contingent"
              ? `${terminals} terminal(s) on a ${term}-day trial`
              : `${terminals} terminal(s) sold`,
        },
      });
    },
    onSuccess: (result) => {
      setPendingDealId(result.id);
      qc.invalidateQueries({ queryKey: ["crm-devices"] });
      qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
      qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
      if (type === "sale") {
        setStep(2);
        toast.success("Pending sale created — have the customer review the next step");
        return;
      }
      setStep(3);
      toast.success("Trial created — have the customer review and sign");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const contract = useMutation({
    mutationFn: () => {
      const signature = canvasRef.current?.toDataURL("image/png") ?? "";
      return sign({ data: { id: pendingDealId, signer_name: signerName.trim(), signature } });
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["lead-deals", leadId] });
      qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
      qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
      qc.invalidateQueries({ queryKey: ["crm-lead-documents", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-documents", leadId] });
      if (result?.documentError) toast.warning(`Signature saved, but the PDF could not be filed: ${result.documentError}`);
      if (type === "contingent") {

        toast.success("Trial agreement signed and filed");
        qc.invalidateQueries({ queryKey: ["crm-placements"] });
        qc.invalidateQueries({ queryKey: ["crm-home"] });
        onLogged?.(type);
        clearSaved();
        onOpenChange(false);
        return;
      }
      toast.success("Contract signed — creating payment checkout");
      setStep(4);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save the signed contract"),
  });

  const close = (nextOpen: boolean) => {
    if (!nextOpen && (save.isPending || contract.isPending || invoice.isPending)) return;
    onOpenChange(nextOpen);
  };

  const stepList: { n: 1 | 2 | 3 | 4; label: string }[] =
    type === "contingent"
      ? [
          { n: 1, label: "Details" },
          { n: 3, label: "Sign" },
        ]
      : [
          { n: 1, label: "Details" },
          { n: 2, label: "Review" },
          { n: 3, label: "Sign" },
          { n: 4, label: "Pay" },
        ];

  const canGoTo = (n: 1 | 2 | 3 | 4) => {
    if (paid || n === step) return false;
    if (n > maxStep) return false;
    // Step 1 is locked once the pending deal exists — use "Start over".
    if (n === 1 && pendingDealId) return false;
    return true;
  };

  const stepper = (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {stepList.map((s, i) => (
        <div key={s.n} className="flex min-w-0 items-center gap-1.5">
          {i > 0 ? <span className="h-px w-4 bg-border sm:w-6" /> : null}
          <button
            type="button"
            disabled={!canGoTo(s.n)}
            onClick={() => setStep(s.n)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors",
              step === s.n ? "bg-honey text-honey-foreground" : "bg-inset",
              canGoTo(s.n) ? "hover:bg-chip hover:text-foreground" : "cursor-default",
            )}
          >
            <span className="num">{i + 1}</span>
            <span className="truncate">{s.label}</span>
          </button>
        </div>
      ))}
    </div>
  );

  const prevStep = (() => {
    const i = stepList.findIndex((s) => s.n === step);
    return i > 0 ? stepList[i - 1]!.n : null;
  })();

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className={cn("max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-x-hidden overflow-y-auto max-md:gap-2.5 max-md:p-3.5 sm:max-w-2xl lg:max-w-3xl", step === 4 && "flex flex-col gap-3 p-0")}>

        <DialogHeader className={step === 4 ? "shrink-0 border-b border-border px-4 pb-3 pt-4 sm:px-6" : undefined}>
          <DialogTitle className="text-[16px]">
            {step === 1 ? "Log a sale" : step === 2 ? "Customer review" : step === 3 ? "Sign contract" : "Collect payment"}
          </DialogTitle>
        </DialogHeader>
        <div className={cn(step === 4 && "shrink-0 px-4 sm:px-6")}>{stepper}</div>



        {step === 1 ? (
          <div className="flex min-w-0 flex-col gap-3.5">

            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { key: "sale", title: "Sale", hint: "Signed and permanent" },
                  { key: "contingent", title: "Contingent trial", hint: "Terminal on term" },
                ] as const
              ).map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setType(o.key)}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                    type === o.key ? "border-honey/55 bg-honey/12" : "border-border bg-inset hover:bg-chip",
                  )}
                >
                  <span className="text-[13px] font-semibold">{o.title}</span>
                  <span className="text-[11.5px] text-muted-foreground">{o.hint}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="card-label">Payment method</span>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select payment method" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="card-label">Terminal <span className="text-red-text">*</span></span>
              {devicesQuery.isLoading ? (
                <p className="text-[11.5px] text-muted-foreground">Loading terminals…</p>
              ) : availableDevices.length === 0 ? (
                <p className="text-[11.5px] text-red-text">No available terminals. Add one to inventory first.</p>
              ) : (
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="flex min-w-0 gap-2">
                    <Popover modal>

                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            fieldCls,
                            "flex min-w-0 flex-1 items-center justify-between text-left",
                            !deviceId && "text-muted-foreground",
                          )}
                        >
                          <span className="truncate">
                            {deviceId
                              ? (() => {
                                  const d = availableDevices.find((x) => x.id === deviceId);
                                  return d
                                    ? `${d.serial_number}${d.coin_id ? ` · coin ${d.coin_id}` : ""} — ${d.status.replace(/_/g, " ")}`
                                    : "Select a terminal";
                                })()
                              : "Select a terminal"}
                          </span>
                          <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
                        <Command>
                          <CommandInput placeholder="Search serial, coin ID, or status" />
                          <CommandList className="max-h-[45vh] overscroll-contain">

                            <CommandEmpty>No terminals match.</CommandEmpty>
                            <CommandGroup>
                              {availableDevices.map((d) => (
                                <CommandItem
                                  key={d.id}
                                  value={`${d.serial_number} ${d.coin_id ?? ""} ${d.status}`}
                                  onSelect={() => setDeviceId(d.id)}
                                >
                                  <span className="min-w-0 truncate">
                                    {d.serial_number}
                                    {d.coin_id ? ` · coin ${d.coin_id}` : ""} — {d.status.replace(/_/g, " ")}
                                  </span>
                                  {deviceId === d.id && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-honey" />}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <Button type="button" variant="secondary" className="h-9 shrink-0" onClick={() => setScanOpen(true)}>
                      <ScanLine className="mr-1.5 h-4 w-4" /> Scan
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{availableDevices.length} available</p>
                </div>
              )}
              <BarcodeScannerDialog open={scanOpen} onOpenChange={setScanOpen} onScan={handleScan} title="Scan terminal" description="Point the camera at the terminal's serial barcode, or type the serial below." />
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="card-label">Coin ID <span className="text-muted-foreground">(optional — selects the linked terminal)</span></span>
              <div className="flex min-w-0 flex-wrap gap-2">
                <input className={cn(fieldCls, "num min-w-0 flex-1")} value={coinId} inputMode="numeric" maxLength={6} placeholder="6-digit coin ID" onChange={(e) => setCoinId(e.target.value.replace(/\D/g, "").slice(0, 6))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCoin(coinId); } }} />
                <Button type="button" variant="secondary" className="h-9 shrink-0" disabled={coinId.length !== 6} onClick={() => handleCoin(coinId)}>Look up</Button>
                <Button type="button" variant="secondary" className="h-9 shrink-0" onClick={() => setCoinScanOpen(true)}><ScanLine className="mr-1.5 h-4 w-4" /> Scan QR</Button>
              </div>

              <BarcodeScannerDialog open={coinScanOpen} onOpenChange={setCoinScanOpen} onScan={handleCoin} title="Scan coin QR" description="Point the camera at the coin's QR code, or type the 6-digit coin ID below." />
            </div>

            {type === "contingent" ? (
              <div className="flex flex-col gap-1.5"><span className="card-label">Trial term</span><div className="flex flex-wrap gap-1.5">{[14, 30].map((d) => <Chip key={d} active={term === d} onClick={() => setTerm(d)}>{d === 14 ? "2 weeks" : "30 days"}</Chip>)}</div></div>
            ) : isDemo ? (
              <div className="rounded-lg border border-honey/40 bg-honey/10 px-3 py-2.5"><div className="flex items-baseline justify-between"><span className="card-label">Demo price</span><span className="num text-[16px] font-semibold">{fmtMoney(DEMO_SALE_PRICE)}</span></div><p className="mt-1 text-[11.5px] text-muted-foreground">Flat {fmtMoney(DEMO_SALE_PRICE)} — no subscription. Standard terms would be {fmtMoney(firstYearTotal(plan))} ({fmtMoney(DEAL_TERMS.hardware_amount)} base + {fmtMoney(plan)}/mo × {DEAL_TERMS.subscription_months}).</p></div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2"><div className="flex flex-col gap-1.5"><span className="card-label">Terminals</span><div className="flex h-9 items-center justify-between rounded-lg border border-border bg-inset px-1.5"><button type="button" aria-label="Fewer terminals" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-chip hover:text-foreground" onClick={() => setTerminals((n) => Math.max(1, n - 1))}><Minus className="h-3.5 w-3.5" /></button><span className="num text-[14px] font-semibold">{terminals}</span><button type="button" aria-label="More terminals" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-chip hover:text-foreground" onClick={() => setTerminals((n) => Math.min(50, n + 1))}><Plus className="h-3.5 w-3.5" /></button></div></div><Field label="Monthly plan (billed annually)">
                  <Select value={String(plan)} onValueChange={(v) => setPlan(Number(v))}>
                    <SelectTrigger className={fieldCls}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUBSCRIPTION_PLANS.map((p) => (
                        <SelectItem key={p} value={String(p)}>
                          {fmtMoney(p)}/mo{PLAN_TERMINAL_ALLOWANCE[String(p)] ? ` · covers ${PLAN_TERMINAL_ALLOWANCE[String(p)]} terminals` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field></div>
            )}

            {type === "sale" && isAdmin ? <label className="flex items-center gap-2 rounded-lg border border-border bg-inset px-2.5 py-2 text-[12.5px]"><input type="checkbox" className="h-4 w-4 accent-[var(--honey)]" checked={demo} onChange={(e) => setDemo(e.target.checked)} /><span className="text-secondary-text">Demo sale — flat {fmtMoney(DEMO_SALE_PRICE)} <span className="text-muted-foreground">(admin only, overrides pricing)</span></span></label> : null}
            {type === "sale" && !isDemo ? (
              <div className="rounded-lg border border-honey/40 bg-honey/10 px-3 py-2.5">
                <div className="flex items-baseline justify-between"><span className="card-label">Total due today</span><span className="num text-[16px] font-semibold">{fmtMoney(suggested)}</span></div>
                <p className="mt-1 text-[11.5px] text-muted-foreground">{terminals} × {fmtMoney(DEAL_TERMS.hardware_amount)} base + {planUnits > 1 ? `${planUnits} × ` : ""}{fmtMoney(plan)}/mo × {DEAL_TERMS.subscription_months} months billed annually{PLAN_TERMINAL_ALLOWANCE[String(plan)] ? ` (one plan covers up to ${PLAN_TERMINAL_ALLOWANCE[String(plan)]} terminals)` : ""}</p>
              </div>
            ) : null}
            <p className="rounded-lg border border-border bg-inset px-3 py-2 text-[12px] text-muted-foreground">{type === "contingent" ? `Starts the clock: this prospect moves to Contingent and shows up on the expiring list ${term === 14 ? "2 weeks" : "30 days"} from today.` : isDemo ? "Creates a pending demo sale. Payment confirmation is still required before it is finalized." : "Creates a pending sale. The customer will review Beekeeper, sign the contract, and then continue to payment."}</p>
          </div>
         ) : step === 2 ? (
            <div className="flex min-w-0 flex-col items-center gap-4 py-2 text-center max-md:gap-2.5 max-md:py-0">
              <div><h3 className="text-[17px] font-semibold max-md:text-[15px]">Let the customer review Beekeeper</h3><p className="mt-1 max-w-sm text-[12.5px] text-muted-foreground max-md:mt-0.5 max-md:text-[11.5px]">Scan this QR code on the customer’s phone or tablet to open beekeeper.money.</p></div>
              <div className="rounded-xl border border-border bg-white p-3 shadow-sm max-md:p-2">{beekeeperQr ? <img src={beekeeperQr} alt="QR code linking to beekeeper.money" className="h-52 w-52 max-md:h-44 max-md:w-44 sm:h-60 sm:w-60" /> : <div className="grid h-52 w-52 place-items-center text-sm text-muted-foreground max-md:h-44 max-md:w-44 sm:h-60 sm:w-60">Creating QR code…</div>}</div>
              <a href="https://beekeeper.money/" target="_blank" rel="noreferrer" className="text-[12px] text-honey-text underline">Open beekeeper.money</a>
            </div>
         ) : step === 3 ? (
           <div className="flex min-w-0 flex-col gap-4">

             <div><h3 className="text-[17px] font-semibold">Customer agreement</h3><p className="mt-1 text-[12.5px] text-muted-foreground">Have the customer review and sign on the rep’s phone or tablet.</p></div>
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border bg-inset p-3.5 text-[12px] leading-5 text-secondary-text">
              <p className="text-[13px] font-semibold text-foreground">{type === "contingent" ? "Trial Terminal Agreement" : "Purchase Agreement"}</p>
              <p className="mt-1 text-[11.5px] text-muted-foreground">Between NectarPay and the Merchant. This is the same text filed as the signed PDF.</p>
              {agreementSections.map(([title, text]) => (
                <div key={title} className="mt-3">
                  <p className="font-semibold text-foreground">{title}</p>
                  {text.split("\n").map((line, i) => (
                    <p key={i} className="mt-0.5 whitespace-pre-wrap">{line}</p>
                  ))}
                </div>
              ))}
            </div>

             <label className="flex items-start gap-2 rounded-lg border border-border bg-inset px-3 py-2.5 text-[12px] text-secondary-text">
               <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--honey)]" checked={agreedToTerms} onChange={(e) => setAgreedToTerms(e.target.checked)} />
               <span>I have read and agree to the customer agreement.</span>
             </label>
             <Field label="Customer name"><input className={fieldCls} value={signerName} autoFocus onChange={(e) => setSignerName(e.target.value)} placeholder="Full legal name" /></Field>
             <div className="flex flex-col gap-1.5"><div className="flex items-center justify-between"><span className="card-label">Signature <span className="text-red-text">*</span></span><button type="button" className="text-[11.5px] text-honey-text hover:underline" onClick={() => { const canvas = canvasRef.current; const context = canvas?.getContext("2d"); if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height); setHasSignature(false); }}>Clear</button></div><canvas ref={canvasRef} width={720} height={260} className="h-44 w-full touch-none rounded-lg border border-border bg-white" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startDrawing(e); }} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} onPointerLeave={stopDrawing} /><p className="text-[11px] text-muted-foreground">The signed contract is attached to this pending sale.</p></div>
           </div>
         ) : (
             <div className="flex min-h-0 flex-1 flex-col max-md:flex-none">
               {invoice.isPending && !paymentQuery.data?.nectarpay_checkout_url ? (
                 <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 pb-1 sm:px-6">
                   <div className="h-3 w-40 animate-pulse rounded bg-inset" />
                   <div className="min-h-0 flex-1 animate-pulse rounded-xl border border-border bg-inset" />
                   <p className="text-center text-[12.5px] text-muted-foreground">Creating secure checkout…</p>
                 </div>
               ) : invoice.isError ? (
                 <p className="px-6 py-10 text-center text-sm text-red-text">Checkout could not be created. Close and retry this payment step.</p>

               ) : paymentQuery.data?.status === "won" || paymentQuery.data?.nectarpay_status === "paid" ? (
                 <div className="grid flex-1 place-items-center px-4 pb-1 sm:px-6">
                   <div className="flex max-w-sm flex-col items-center gap-4 text-center">
                     <p className="rounded-lg border border-green/30 bg-green/10 px-5 py-4 text-sm font-medium text-green-text">Payment confirmed. Sale finalized.</p>
                     <div className="flex flex-col items-center gap-2">
                       <span className="card-label">Customer documents</span>
                       <div className="rounded-xl border border-border bg-white p-3 shadow-sm">
                         {docsQr ? <img src={docsQr} alt="QR code to download the signed contract and invoice" className="h-48 w-48" /> : <div className="grid h-48 w-48 place-items-center text-[12.5px] text-muted-foreground">Preparing documents…</div>}
                       </div>
                       <p className="text-[12.5px] text-muted-foreground">Have the customer scan this to download their signed contract and invoice.</p>
                       {docsUrl ? <a href={docsUrl} target="_blank" rel="noreferrer" className="text-[12px] text-honey-text hover:underline">Open the document page</a> : null}
                     </div>
                   </div>
                 </div>
               ) : checkoutExpired ? (
                 <div className="my-auto mx-4 flex flex-col gap-2 rounded-lg border border-red-text/30 bg-red-text/10 px-4 py-3 text-left sm:mx-6">
                   <p className="text-sm font-semibold text-red-text">Checkout expired</p>
                   <p className="text-[12.5px] text-secondary-text">This secure payment link was available for 15 minutes. Create a fresh checkout to continue.</p>
                 </div>
               ) : paymentQuery.data?.nectarpay_checkout_url ? (
                 <div className="flex min-h-0 flex-1 flex-col max-md:flex-none">
                   <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-2 max-md:gap-1 sm:px-6">
                     <p className="text-[11.5px] text-muted-foreground">
                       Waiting for payment confirmation…{checkoutMinutesRemaining !== null ? ` · ${checkoutMinutesRemaining} min remaining` : ""}
                     </p>
                     <a href={paymentQuery.data.nectarpay_checkout_url} target="_blank" rel="noreferrer" className={cn(btn.secondary, "h-7 text-[11.5px]")}>
                       Open in browser
                     </a>
                   </div>
                    {showQrFallback ? (
                      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 border-t border-border bg-white p-4 text-center">
                        <p className="text-[12.5px] font-medium text-black">Scan to open the secure checkout on the customer's phone</p>
                        {qrCode ? <img src={qrCode} alt="QR code for Nectar.Pay payment checkout" className="h-52 w-52" /> : <p className="p-8 text-sm text-muted-foreground">Preparing payment QR…</p>}
                        <a href={paymentQuery.data.nectarpay_checkout_url} target="_blank" rel="noreferrer" className="text-[12px] text-honey-text underline">Open checkout in a new tab</a>
                        <button type="button" className="text-[12px] text-muted-foreground underline" onClick={() => { setCheckoutFrameLoaded(false); setFrameNonce((n) => n + 1); setShowQrFallback(false); }}>Show checkout here instead</button>
                      </div>
                    ) : (
                       <div className="relative h-[1500px] min-h-[1500px] w-full max-w-full flex-none">
                        <iframe
                          key={`${paymentQuery.data.nectarpay_checkout_url}#${frameNonce}`}
                          title="Nectar.Pay secure checkout"
                          src={paymentQuery.data.nectarpay_checkout_url}
                          className="absolute inset-0 block h-full w-full border-0 bg-transparent"
                          scrolling="no"
                          loading="eager"
                          // @ts-expect-error non-standard but supported by Chromium
                          fetchpriority="high"
                          allow="payment; clipboard-write"
                          onLoad={() => setCheckoutFrameLoaded(true)}
                        />
                        {!checkoutFrameLoaded ? (
                          <div className="pointer-events-none absolute inset-x-0 top-2 text-center text-[12.5px] text-muted-foreground">
                            Loading secure checkout…
                          </div>
                        ) : null}
                      </div>
                    )}



                 </div>
               ) : (
                 <div className="grid flex-1 place-items-center"><p className="text-sm text-muted-foreground">Preparing payment options…</p></div>

              )}
            </div>

         )}

          <DialogFooter className={cn("flex-wrap gap-2", step === 4 && "shrink-0 border-t border-border px-4 py-3 max-md:flex-nowrap max-md:gap-1.5 max-md:px-3 max-md:py-2 max-md:[&_button]:h-9 max-md:[&_button]:flex-1 max-md:[&_button]:whitespace-nowrap max-md:[&_button]:px-2 max-md:[&_button]:text-[12.5px] sm:px-6")}>
           {step > 1 && !paid ? (
             <button
               type="button"
               className="mr-auto text-[12.5px] text-muted-foreground underline-offset-2 hover:underline"
               onClick={() => { clearSaved(); setStep(1); setMaxStep(1); setPendingDealId(""); setSignerName(""); setAgreedToTerms(false); setRestored(true); }}
             >
               Start over
             </button>
           ) : null}

           {prevStep && canGoTo(prevStep) ? (
             <button type="button" className={btn.secondary} onClick={() => setStep(prevStep)}>Back</button>
           ) : null}




           {step === 1 ? <><button type="button" className={btn.secondary} onClick={() => onOpenChange(false)}>Cancel</button><button type="button" className={type === "sale" ? btn.green : btn.primary} disabled={save.isPending || !deviceId || (type === "sale" && !isDemo && numericValue <= 0)} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : type === "sale" ? "Create pending sale" : "Start trial"}</button></> : step === 2 ? <><button type="button" className={btn.secondary} onClick={() => onOpenChange(false)}>Cancel</button><button type="button" className={btn.green} onClick={() => setStep(3)}>Next: sign contract</button></> : step === 3 ? <><button type="button" className={btn.green} disabled={contract.isPending || !agreedToTerms || !signerName.trim() || !hasSignature} onClick={() => contract.mutate()}>{contract.isPending ? "Saving signature…" : type === "contingent" ? "Sign trial agreement" : "Next: payment"}</button></> : <><button type="button" className={btn.secondary} onClick={() => onOpenChange(false)}>Close</button>{paymentQuery.data?.status !== "won" && paymentQuery.data?.nectarpay_status !== "paid" ? <button type="button" className={btn.green} disabled={invoice.isPending} onClick={() => { setInvoiceStarted(false); setCheckoutExpiresAt(null); setCheckoutFrameLoaded(false); setShowQrFallback(false); setFrameNonce((n) => n + 1); }}>{invoice.isPending ? "Creating checkout…" : "Retry checkout"}</button> : null}</>}
         </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
/* ── Follow-up ──────────────────────────────────────────────────── */

const QUICK_TITLES = ["Call back", "Second visit", "Send agreement", "Drop off terminal"];

function tomorrowAt9Am() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}

function toTimeString(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function combineDateAndTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const out = new Date(date);
  out.setHours(hours, minutes, 0, 0);
  return out;
}

export function FollowUpModal({
  leadId,
  open,
  onOpenChange,
  onCreated,
}: {
  leadId?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: () => void;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createTask);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState<Date>(tomorrowAt9Am());
  const [time, setTime] = useState<string>(toTimeString(tomorrowAt9Am()));

  const save = useMutation({
    mutationFn: () => {
      const due = combineDateAndTime(date, time);
      if (due.getTime() < Date.now()) {
        throw new Error("Follow-up time must be in the future");
      }
      return create({
        data: {
          title: title.trim(),
          lead_id: leadId ?? null,
          type: "callback",
          due_at: due.toISOString(),
        },
      });
    },
    onSuccess: () => {
      toast.success("Follow-up scheduled");
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      qc.invalidateQueries({ queryKey: ["crm-home"] });
      if (leadId) qc.invalidateQueries({ queryKey: ["crm-lead", leadId] });
      setTitle("");
      setDate(tomorrowAt9Am());
      setTime(toTimeString(tomorrowAt9Am()));
      onOpenChange(false);
      onCreated?.();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not schedule"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Schedule a follow-up</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <Field label="What needs doing">
            <input
              className={fieldCls}
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Call back the owner"
            />
          </Field>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TITLES.map((t) => (
              <Chip key={t} active={title === t} onClick={() => setTitle(t)}>
                {t}
              </Chip>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="card-label">Date</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !date && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && setDate(d)}
                    initialFocus
                    fromDate={new Date()}
                    className="pointer-events-auto p-3"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Field label="Time">
              <input
                type="time"
                className={cn(fieldCls, "num")}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <button type="button" className={btn.secondary} onClick={() => onOpenChange(false)}>
            Cancel
          </button>
          <button
            type="button"
            className={btn.primary}
            disabled={!title.trim() || save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Schedule"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
