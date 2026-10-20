/**
 * The harness tab's wire defaults bar (CONTRACTS §16.5, mockup 09): the gauge
 * and colour a new wire gets, kept per user in browser storage, and the length
 * the 3D route supplies in 4c.
 */
import { colourHex, GAUGES, WIRE_COLOURS } from "./harness-format";
import type { WireDefaults } from "./harness-defaults-store";

interface Props {
  defaults: WireDefaults;
  disabled: boolean;
  onChange: (next: WireDefaults) => void;
}

const field = "rounded-md border border-[#e2e8f0] bg-white px-2 py-[3px] text-[11.5px] text-[#0f172a] outline-none focus:border-[#0ea5e9]";

export function HarnessDefaults({ defaults, disabled, onChange }: Props) {
  return (
    <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-[10px] border border-[#e2e8f0] bg-white px-2.5 py-1.5 text-[11.5px] text-[#0f172a] shadow-[0_4px_16px_rgba(15,23,42,.12)]">
      <span className="text-[10px] font-semibold tracking-[0.05em] text-[#64748b]">WIRE DEFAULTS</span>
      <label htmlFor="harness-default-gauge" className="sr-only">
        Default gauge
      </label>
      <select
        id="harness-default-gauge"
        className={field}
        value={defaults.gaugeAwg}
        disabled={disabled}
        onChange={(event) => onChange({ ...defaults, gaugeAwg: event.target.value })}
      >
        {GAUGES.map((gauge) => (
          <option key={gauge} value={gauge}>
            {gauge} AWG
          </option>
        ))}
      </select>
      <label htmlFor="harness-default-colour" className="sr-only">
        Default colour
      </label>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-3 w-3 rounded-[3px] border border-[#475569]" style={{ background: colourHex(defaults.colour) }} />
        <select
          id="harness-default-colour"
          className={field}
          value={defaults.colour}
          disabled={disabled}
          onChange={(event) => onChange({ ...defaults, colour: event.target.value })}
        >
          {WIRE_COLOURS.map((colour) => (
            <option key={colour} value={colour}>
              {colour[0].toUpperCase() + colour.slice(1)}
            </option>
          ))}
        </select>
      </span>
      <span className="rounded-md border border-[#e2e8f0] px-2 py-[3px] text-[#64748b]">Length: from 3D route</span>
    </div>
  );
}
