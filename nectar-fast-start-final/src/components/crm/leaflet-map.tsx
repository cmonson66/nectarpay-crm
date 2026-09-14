import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { LeadStatus } from "@/lib/crm.functions";

/** Hex per pipeline stage — mirrors STATUS_CLASS but as raw colors Leaflet can use. */
export const PIN_COLOR: Record<string, string> = {
  new: "#fbbf24",
  contacted: "#38bdf8",
  thinking: "#a78bfa",
  contingent: "#fb923c",
  pending: "#facc15",
  won: "#34d399",
  lost: "#94a3b8",
  do_not_contact: "#f87171",
  business: "#e2e8f0",
  rep: "#60a5fa",
  home: "#fcd34d",
  me: "#f43f5e",
};

/** Dark basemap + popup polish, injected once so the map matches the CRM shell. */
const MAP_CSS = `
.leaflet-container{background:#0b1220;font-family:inherit}
.crm-map .leaflet-tile{filter:invert(1) hue-rotate(180deg) brightness(.92) contrast(.84) saturate(.28)}
.crm-map .leaflet-fade-anim .leaflet-tile{will-change:transform}
.crm-map .leaflet-zoom-anim .leaflet-zoom-animated{will-change:transform}
.leaflet-control-zoom a{background:rgba(15,23,42,.92);color:#e2e8f0;border-color:rgba(255,255,255,.12)}
.leaflet-control-zoom a:hover{background:rgba(30,41,59,.98);color:#fff}
.leaflet-control-attribution{background:rgba(15,23,42,.7)!important;color:#94a3b8!important;font-size:10px}
.leaflet-control-attribution a{color:#cbd5e1!important}
.leaflet-popup-content-wrapper{background:#0f172a;color:#e2e8f0;border:1px solid rgba(255,255,255,.12);border-radius:12px;box-shadow:0 12px 32px rgba(0,0,0,.55)}
.leaflet-popup-content{margin:10px 12px;font-size:13px;line-height:1.35}
.leaflet-popup-tip{background:#0f172a;border:1px solid rgba(255,255,255,.12)}
.leaflet-popup-close-button{color:#94a3b8!important}
.crm-pin{filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
@keyframes crm-pin-bounce{0%,100%{transform:translateY(0)}30%{transform:translateY(-14px)}60%{transform:translateY(-4px)}80%{transform:translateY(-8px)}}
.crm-pin-bounce{animation:crm-pin-bounce .6s ease-in-out 3}
.crm-pin-bounce.crm-pin{filter:drop-shadow(0 0 8px rgba(255,255,255,.8)) drop-shadow(0 2px 4px rgba(0,0,0,.6))}
`;

function ensureMapCss() {
  if (typeof document === "undefined" || document.getElementById("crm-map-css")) return;
  const style = document.createElement("style");
  style.id = "crm-map-css";
  style.textContent = MAP_CSS;
  document.head.appendChild(style);
}


export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  /** Pipeline status, or one of the extra keys in PIN_COLOR. */
  kind: LeadStatus | "business" | "rep" | "home" | "me";
  title: string;
  subtitle?: string;
  /** Rendered inside the popup under the title. */
  popupHtml?: string;
  /** Fired when the marker (or its popup action button) is clicked. */
  onSelect?: () => void;
  emphasis?: boolean;
};

type LeafletMapProps = {
  center: { lat: number; lng: number };
  zoom?: number;
  pins: MapPin[];
  className?: string;
  /** Re-centers the map when this value changes. */
  recenterKey?: string;
  /** Fired after the user finishes panning/zooming, with the new map center. */
  onMoveEnd?: (center: { lat: number; lng: number }) => void;
  /** When `seq` changes, the map pans to the pin with `id` and bounces it. */
  focus?: { id: string; seq: number };
};

type LeafletLike = {
  map: (el: HTMLElement, opts?: unknown) => LeafletMapInstance;
  tileLayer: (url: string, opts?: unknown) => { addTo: (m: unknown) => unknown };
  layerGroup: () => LeafletLayerGroup;
  marker: (latlng: [number, number], opts?: unknown) => LeafletMarker;
  divIcon: (opts: unknown) => unknown;
};

type LeafletMapInstance = {
  setView: (latlng: [number, number], zoom?: number, opts?: unknown) => void;
  getZoom: () => number;
  remove: () => void;
  invalidateSize: () => void;
  on: (event: string, cb: () => void) => void;
  getCenter: () => { lat: number; lng: number };
};

type LeafletLayerGroup = {
  addTo: (m: LeafletMapInstance) => LeafletLayerGroup;
  clearLayers: () => void;
  addLayer: (l: unknown) => void;
};

type LeafletMarker = {
  bindPopup: (html: string) => LeafletMarker;
  on: (event: string, cb: () => void) => LeafletMarker;
  openPopup: () => LeafletMarker;
  getElement: () => HTMLElement | undefined;
};

function pinIcon(L: LeafletLike, kind: string, emphasis?: boolean) {
  const color = PIN_COLOR[kind] ?? PIN_COLOR.business;
  // Live people / home bases stay as pulsing dots; everything else is a teardrop pin.
  if (kind === "me" || kind === "rep") {
    const size = 16;
    return L.divIcon({
      className: "",
      html: `<span class="crm-pin" style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid rgba(255,255,255,.9);box-shadow:0 0 0 6px ${color}33"></span>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }

  const w = emphasis ? 22 : 18;
  const h = Math.round(w * 1.35);
  return L.divIcon({
    className: "",
    html: `<svg class="crm-pin" width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 0C5.4 0 0 5.3 0 11.9 0 20.6 12 32 12 32s12-11.4 12-20.1C24 5.3 18.6 0 12 0z" fill="${color}" stroke="rgba(15,23,42,.85)" stroke-width="1.5"/>
        <circle cx="12" cy="11.6" r="4.2" fill="rgba(15,23,42,.9)"/>
      </svg>`,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 4],
  });
}


function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/**
 * Leaflet + OpenStreetMap tiles. Deliberately not Google Maps JS: the managed
 * browser key is referrer-locked to *.lovable.app and would fail on the
 * custom domain. All Google data still comes from the server.
 */
export function LeafletMap({
  center,
  zoom = 14,
  pins,
  className,
  recenterKey,
  onMoveEnd,
  focus,
}: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const layerRef = useRef<LeafletLayerGroup | null>(null);
  const markersRef = useRef(new globalThis.Map<string, LeafletMarker>());
  const readyRef = useRef(false);
  const pinsRef = useRef(pins);
  pinsRef.current = pins;
  const moveEndRef = useRef(onMoveEnd);
  moveEndRef.current = onMoveEnd;

  const leafletRef = useRef<LeafletLike | null>(null);

  function drawPins() {
    const L = leafletRef.current;
    const group = layerRef.current;
    if (!L || !group) return;
    group.clearLayers();
    markersRef.current.clear();
    for (const pin of pinsRef.current) {
      const marker = L.marker([pin.lat, pin.lng], {
        icon: pinIcon(L, pin.kind, pin.emphasis),
        title: pin.title,
      });
      const html = `<div style="min-width:170px">
          <div style="font-weight:600;margin-bottom:2px">${escapeHtml(pin.title)}</div>
          ${pin.subtitle ? `<div style="opacity:.7;font-size:12px">${escapeHtml(pin.subtitle)}</div>` : ""}
          ${pin.popupHtml ?? ""}
        </div>`;
      marker.bindPopup(html);
      if (pin.onSelect) marker.on("click", pin.onSelect);
      group.addLayer(marker);
      markersRef.current.set(pin.id, marker);
    }
  }
  const drawPinsRef = useRef(drawPins);
  drawPinsRef.current = drawPins;

  // Mount the map once. The container often has a zero/intermediate size at
  // this point (SSR shell, layout settling, dialog opening), so a
  // ResizeObserver keeps Leaflet's notion of size in sync — without it the
  // tiles never render and the map looks invisible until a window resize.
  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    ensureMapCss();
    (async () => {
      const mod = await import("leaflet");
      const L = (mod.default ?? mod) as unknown as LeafletLike;
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      const el = containerRef.current;
      const map = L.map(el, {
        center: [center.lat, center.lng],
        zoom,
        scrollWheelZoom: true,
        zoomControl: true,
        attributionControl: true,
        // Smooth pinch zoom on mobile — snapping back to whole-number zooms
        // mid-pinch is what makes zooming feel jumpy.
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        wheelPxPerZoomLevel: 90,
        bounceAtZoomLimits: false,
        tapHold: false,
        zoomAnimation: true,
        fadeAnimation: false,
      } as unknown as Record<string, unknown>);
      // OSM tiles, inverted via CSS into a dark basemap that matches the navy shell
      // (keyless — hosted dark basemaps all require an API key).
      el.classList.add("crm-map");
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      map.on("moveend", () => {
        const c = map.getCenter();
        moveEndRef.current?.({ lat: c.lat, lng: c.lng });
      });
      mapRef.current = map;
      layerRef.current = L.layerGroup().addTo(map);
      readyRef.current = true;
      drawPinsRef.current();

      // Only invalidate on real size changes — mobile browsers fire RO during
      // pinch zoom (visual viewport shifts), which fights the zoom animation.
      let lastW = el.clientWidth;
      let lastH = el.clientHeight;
      resizeObserver = new ResizeObserver(() => {
        const w = el.clientWidth;
        const h = el.clientHeight;
        if (w === lastW && h === lastH) return;
        lastW = w;
        lastH = h;
        map.invalidateSize();
      });
      resizeObserver.observe(el);
      setTimeout(() => {
        if (!cancelled) map.invalidateSize();
      }, 120);
    })();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      layerRef.current = null;
      readyRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw whenever the pin list changes, once the map exists.
  useEffect(() => {
    if (readyRef.current) drawPinsRef.current();
  }, [pins]);

  useEffect(() => {
    if (mapRef.current) mapRef.current.setView([center.lat, center.lng], zoom);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterKey]);

  // Pan to a pin and bounce it (e.g. clicked from the nearby-business list).
  useEffect(() => {
    if (!focus) return;
    const pin = pins.find((p) => p.id === focus.id);
    if (!pin) return;
    const map = mapRef.current;
    if (!map) return;
    map.setView([pin.lat, pin.lng], Math.max(map.getZoom(), 15), { animate: true });
    // Markers redraw async after pin-list changes, so retry a few times.
    let attempts = 0;
    const timer = setInterval(() => {
      const marker = markersRef.current.get(focus.id);
      attempts += 1;
      if (!marker) {
        if (attempts > 20) clearInterval(timer);
        return;
      }
      clearInterval(timer);
      // Marker may have been dropped by a redraw — skip if it isn't on a map.
      if (!(marker as unknown as { _map?: unknown })._map) return;
      marker.openPopup();
      const el = marker.getElement();
      const inner = el?.querySelector(".crm-pin");
      if (inner) {
        inner.classList.remove("crm-pin-bounce");
        // restart animation
        void (inner as HTMLElement).offsetWidth;
        inner.classList.add("crm-pin-bounce");
      }
    }, 120);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.seq]);

  return <div ref={containerRef} className={className} />;
}
