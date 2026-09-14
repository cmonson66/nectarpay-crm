import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAddress, suggestAddresses } from "@/lib/geo.functions";

export type ResolvedAddress = {
  formattedAddress: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  lat: number | null;
  lng: number | null;
};

type Suggestion = { placeId: string; primary: string; secondary: string };

/**
 * Address input backed by Google Places autocomplete (server-side gateway, so it
 * works on the custom domain). Emits the typed value plus parsed parts on pick.
 */
export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Start typing an address…",
  className,
  disabled,
  autoFocus,
  onBlur,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (address: ResolvedAddress) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const suggest = useServerFn(suggestAddresses);
  const resolve = useServerFn(resolveAddress);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const r = await suggest({ data: { query: q } });
        setItems(r.suggestions);
        setOpen(r.suggestions.length > 0);
      } catch (e) {
        console.error(e);
        setItems([]);
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      setBusy(false);
    };
  }, [value, suggest]);

  const pick = async (s: Suggestion) => {
    skipNext.current = true;
    setItems([]);
    setOpen(false);
    onChange(s.primary);
    try {
      const detail = await resolve({ data: { placeId: s.placeId } });
      if (detail) {
        skipNext.current = true;
        onChange(detail.addressLine1 || s.primary);
        onSelect?.(detail);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="relative">
      <input
        className={cn(className, "pr-8")}
        value={value}
        disabled={disabled}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
          onBlur?.();
        }}
        onKeyDown={onKeyDown}
      />
      {busy && (
        <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      {open && items.length > 0 && (
        <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-popover shadow-lg">
          {items.map((s) => (
            <button
              key={s.placeId}
              type="button"
              className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-inset"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void pick(s)}
            >
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{s.primary}</span>
                <span className="block truncate text-[11.5px] text-muted-foreground">
                  {s.secondary}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
