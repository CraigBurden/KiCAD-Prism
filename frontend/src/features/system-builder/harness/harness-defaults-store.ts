/**
 * The wire defaults the harness tab keeps per user (CONTRACTS §16.5): gauge and
 * colour for new wires in browser storage. Reading or writing may be refused
 * (private mode, a full quota); the fallback is still a valid pair.
 */
import { GAUGES, WIRE_COLOURS } from "./harness-format";

export interface WireDefaults {
  gaugeAwg: string;
  colour: string;
}

export const DEFAULTS_KEY = "prism.sb.harnessDefaults";
const FALLBACK: WireDefaults = { gaugeAwg: "26", colour: "black" };
function oneOf<T extends string>(value: unknown, options: readonly T[]): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

export function readWireDefaults(): WireDefaults {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    if (!raw) return FALLBACK;
    const parsed = JSON.parse(raw) as Partial<WireDefaults>;
    return {
      gaugeAwg: oneOf(parsed.gaugeAwg, GAUGES) ? parsed.gaugeAwg : FALLBACK.gaugeAwg,
      colour: oneOf(parsed.colour, WIRE_COLOURS) ? parsed.colour : FALLBACK.colour,
    };
  } catch {
    return FALLBACK;
  }
}

export function writeWireDefaults(defaults: WireDefaults): void {
  try {
    // react-doctor-disable-next-line react-doctor/client-localstorage-no-version - CONTRACTS §16.5 fixes this key for the user's wire defaults; the payload is validated on read, and versioning the key would strand saved choices.
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults));
  } catch {
    // Storage refused; the choice still applies for this session.
  }
}
