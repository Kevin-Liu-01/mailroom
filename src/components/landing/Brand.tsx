/**
 * Brand marks for diagrams, the label grid and the dashboard, drawn in each brand's own color.
 * Simple Icons (CC0) paths and hex colors, plus a few hand-drawn marks for brands Simple Icons does not carry.
 * Very dark marks lift toward the ink in dark mode and very light ones sink toward it in light mode, so every
 * mark stays visible on both papers (see --brand-lift / --brand-sink in globals.css).
 */
import {
  siTarget, siChase, siUber, siUbereats, siDoordash, siApple, siGithub, siVercel, siSentry, siSupabase, siInstagram, siX, siYoutube,
  siSubstack, siMedium, siNewyorktimes, siRobinhood, siVenmo, siAmericanexpress, siUnitedairlines, siDelta, siAirbnb, siGooglecalendar,
  siGreenhouse, siIndeed, siNotion, siZoom, siOkta, siCloudflare, siNike, siGoogle, siGmail, siCanvas, siCoursera, siMarriott, siMeetup,
  siTicketmaster, siStripe, siPaypal, siDiscord, siReddit, siTiktok, siNextdoor, siWellfound, siHandshake, siGoogleclassroom, si1password,
  siFigma, siLinear, siJira, siCalendly, siHilton, siExpedia, siStarbucks, siHellofresh, siAdidas, siBankofamerica, siWellsfargo, siCoinbase,
  siDropbox, siSpotify, siAuth0, siGooglemeet, siBitwarden,
} from "simple-icons";

type Mark = { title: string; path: string; hex: string };
const si = (icon: { title: string; path: string; hex: string }): Mark => ({ title: icon.title, path: icon.path, hex: icon.hex });

export const BRANDS = {
  target: si(siTarget), chase: si(siChase), uber: si(siUber), ubereats: si(siUbereats), doordash: si(siDoordash), apple: si(siApple),
  github: si(siGithub), vercel: si(siVercel), sentry: si(siSentry), supabase: si(siSupabase), instagram: si(siInstagram), x: si(siX),
  youtube: si(siYoutube), substack: si(siSubstack), medium: si(siMedium), nytimes: si(siNewyorktimes), robinhood: si(siRobinhood),
  venmo: si(siVenmo), amex: si(siAmericanexpress), united: si(siUnitedairlines), delta: si(siDelta), airbnb: si(siAirbnb),
  gcal: si(siGooglecalendar), greenhouse: si(siGreenhouse), indeed: si(siIndeed), notion: si(siNotion), zoom: si(siZoom), okta: si(siOkta),
  cloudflare: si(siCloudflare), nike: si(siNike), google: si(siGoogle), gmail: si(siGmail), canvas: si(siCanvas), coursera: si(siCoursera),
  marriott: si(siMarriott), meetup: si(siMeetup), ticketmaster: si(siTicketmaster), stripe: si(siStripe), paypal: si(siPaypal),
  discord: si(siDiscord), reddit: si(siReddit), tiktok: si(siTiktok), nextdoor: si(siNextdoor), wellfound: si(siWellfound),
  handshake: si(siHandshake), classroom: si(siGoogleclassroom), onepassword: si(si1password), figma: si(siFigma), linear: si(siLinear),
  jira: si(siJira), calendly: si(siCalendly), hilton: si(siHilton), expedia: si(siExpedia), starbucks: si(siStarbucks),
  hellofresh: si(siHellofresh), adidas: si(siAdidas), bofa: si(siBankofamerica), wellsfargo: si(siWellsfargo), coinbase: si(siCoinbase),
  dropbox: si(siDropbox), spotify: si(siSpotify), auth0: si(siAuth0), meet: si(siGooglemeet), bitwarden: si(siBitwarden),
  // Hand-drawn stand-ins for marks Simple Icons no longer ships.
  linkedin: { title: "LinkedIn", path: "M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z", hex: "0A66C2" },
  amazon: { title: "Amazon", path: "M15.93 17.09c-2.23 1.64-5.47 2.52-8.26 2.52-3.91 0-7.43-1.45-10.09-3.85-.21-.19-.02-.45.23-.3 2.87 1.67 6.42 2.68 10.09 2.68 2.47 0 5.19-.51 7.69-1.58.38-.16.69.25.34.53Zm.93-1.07c-.29-.37-1.9-.17-2.62-.09-.22.03-.25-.16-.06-.3 1.28-.9 3.38-.64 3.63-.34.25.31-.07 2.42-1.27 3.42-.19.16-.36.08-.28-.13.27-.68.88-2.19.6-2.56ZM13.4 9.5c0 1.03.03 1.9-.5 2.82-.42.75-1.09 1.21-1.84 1.21-1.02 0-1.61-.78-1.61-1.92 0-2.26 2.02-2.67 3.95-2.67v.56Zm2.65 6.41c-.17.16-.42.17-.62.06-.87-.72-1.02-1.06-1.5-1.75-1.44 1.47-2.46 1.91-4.33 1.91-2.21 0-3.93-1.36-3.93-4.09 0-2.13 1.15-3.58 2.8-4.29 1.43-.63 3.42-.74 4.94-.91v-.34c0-.62.05-1.36-.32-1.9-.32-.48-.93-.68-1.47-.68-1 0-1.89.51-2.11 1.57-.04.24-.22.47-.46.48l-2.55-.28c-.21-.05-.45-.22-.39-.55C6.7 2.06 9.5 1.1 12 1.1c1.28 0 2.95.34 3.96 1.31 1.28 1.19 1.16 2.79 1.16 4.52v4.09c0 1.23.51 1.77.99 2.44.17.24.21.52-.01.7-.53.45-1.49 1.28-2.02 1.75Z", hex: "FF9900" },
  eventbrite: { title: "Eventbrite", path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-4.2 7.2h7.5v1.9H9.7v1.1h4.9v1.8H9.7v1.2h5.7V17H7.8V9.2Z", hex: "F05537" },
  luma: { title: "Luma", path: "M12 1.5c.4 5.7 4.8 10.1 10.5 10.5-5.7.4-10.1 4.8-10.5 10.5C11.6 16.8 7.2 12.4 1.5 12 7.2 11.6 11.6 7.2 12 1.5Z", hex: "6E56CF" },
  slack: { title: "Slack", path: "M5.04 15.16a2.52 2.52 0 1 1-2.52-2.52h2.52v2.52Zm1.27 0a2.52 2.52 0 1 1 5.04 0v6.32a2.52 2.52 0 1 1-5.04 0v-6.32ZM8.83 5.04a2.52 2.52 0 1 1 2.52-2.52v2.52H8.83Zm0 1.27a2.52 2.52 0 1 1 0 5.04H2.52a2.52 2.52 0 1 1 0-5.04h6.31ZM18.96 8.83a2.52 2.52 0 1 1 2.52 2.52h-2.52V8.83Zm-1.27 0a2.52 2.52 0 1 1-5.04 0V2.52a2.52 2.52 0 1 1 5.04 0v6.31ZM15.17 18.96a2.52 2.52 0 1 1-2.52 2.52v-2.52h2.52Zm0-1.27a2.52 2.52 0 1 1 0-5.04h6.31a2.52 2.52 0 1 1 0 5.04h-6.31Z", hex: "4A154B" },
  amtrak: { title: "Amtrak", path: "M2 14.5 12 5l10 9.5h-4.5L12 9.6 6.5 14.5H2Zm3.2 3L12 11.1l6.8 6.4h-3.3L12 14.4l-3.5 3.1H5.2Z", hex: "1F5FA9" },
} satisfies Record<string, Mark>;

export type BrandId = keyof typeof BRANDS;

/** Relative luminance of a hex color, 0..1. */
function luminance(hex: string): number {
  const n = parseInt(hex, 16);
  const [r, g, b] = [16, 8, 0].map((shift) => ((n >> shift) & 255) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The brand's own color as a CSS value that survives both themes. */
export function brandColor(id: BrandId): string {
  const { hex } = BRANDS[id];
  const l = luminance(hex);
  if (l < 0.12) return `color-mix(in srgb, var(--ink) var(--brand-lift), #${hex})`;
  if (l > 0.6) return `color-mix(in srgb, var(--ink) var(--brand-sink), #${hex})`;
  return `#${hex}`;
}

export function Brand({ id, size = 18, className, title, mono = false }: { id: BrandId; size?: number; className?: string; title?: string; mono?: boolean }) {
  const b = BRANDS[id];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title ?? b.title} className={className} style={{ fill: mono ? "currentColor" : brandColor(id), flexShrink: 0 }}>
      <title>{title ?? b.title}</title>
      <path d={b.path} />
    </svg>
  );
}

/** The same mark for use inside another SVG, placed by its top-left corner. */
export function BrandGlyph({ id, x, y, size }: { id: BrandId; x: number; y: number; size: number }) {
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={BRANDS[id].path} style={{ fill: brandColor(id) }} />
    </svg>
  );
}

/** A person, when the sender is a human: initials in a ring. */
export function Person({ initials, size = 18 }: { initials: string; size?: number }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: 999, border: "1.5px solid currentColor", display: "inline-grid", placeItems: "center", fontSize: size * 0.45, fontWeight: 700, lineHeight: 1, flexShrink: 0, fontFamily: "var(--font-mono)" }}>{initials}</span>
  );
}

/** Which marks belong to which taxonomy category; used by the label grid and the policy diagrams. */
export const CATEGORY_BRANDS: Record<string, BrandId[]> = {
  work: ["slack", "notion", "linear", "figma", "meet"],
  personal: [],
  finance: ["chase", "amex", "robinhood", "venmo", "bofa"],
  receipts: ["uber", "doordash", "amazon", "apple", "stripe"],
  travel: ["united", "delta", "airbnb", "marriott", "amtrak"],
  events: ["gcal", "luma", "eventbrite", "ticketmaster", "meetup"],
  recruiting: ["linkedin", "greenhouse", "indeed", "wellfound", "handshake"],
  school: ["canvas", "classroom", "coursera", "zoom"],
  dev: ["github", "vercel", "sentry", "supabase", "cloudflare"],
  social: ["linkedin", "instagram", "x", "youtube", "reddit"],
  newsletters: ["substack", "medium", "nytimes"],
  marketing: ["target", "nike", "adidas", "starbucks", "hellofresh"],
  security: ["google", "apple", "okta", "onepassword", "auth0"],
};
