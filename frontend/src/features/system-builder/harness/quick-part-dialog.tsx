/**
 * Quick-create a harness part (CONTRACTS §16.1, §16.5): an ordinary catalog
 * `part` with the role's `harness_*` fields pre-filled. It follows the normal
 * review like any other catalog component.
 */
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createComponent } from "@/components/workspace/catalog-client";
import type { CatalogComponent } from "@/types/catalog";

import { HARNESS_ROLE_LABEL, HARNESS_ROLES, type HarnessRole } from "./harness-parts";

interface FieldSpec {
  key: string;
  label: string;
  kind: "text" | "number" | "boolean";
}

const ROLE_FIELDS: Record<HarnessRole, FieldSpec[]> = {
  housing: [
    { key: "harness_cavities", label: "Cavities", kind: "number" },
    { key: "harness_contact_family", label: "Contact family", kind: "text" },
  ],
  contact: [
    { key: "harness_contact_family", label: "Contact family", kind: "text" },
    { key: "harness_gauge_min_awg", label: "Gauge min (AWG)", kind: "text" },
    { key: "harness_gauge_max_awg", label: "Gauge max (AWG)", kind: "text" },
  ],
  cable: [
    { key: "harness_conductors", label: "Conductors", kind: "number" },
    { key: "harness_shielded", label: "Shielded", kind: "boolean" },
    { key: "harness_od_mm", label: "Outer diameter (mm)", kind: "number" },
  ],
  sleeve: [
    { key: "harness_diameter_min_mm", label: "Diameter min (mm)", kind: "number" },
    { key: "harness_diameter_max_mm", label: "Diameter max (mm)", kind: "number" },
  ],
  "heat-shrink": [
    { key: "harness_diameter_min_mm", label: "Diameter min (mm)", kind: "number" },
    { key: "harness_diameter_max_mm", label: "Diameter max (mm)", kind: "number" },
    { key: "harness_shrink_ratio", label: "Shrink ratio", kind: "number" },
  ],
  tape: [],
  "zip-ties": [],
  label: [],
  marker: [],
};

const categoryFor = (role: HarnessRole) => `Harness ${role}`;

const fieldBox = "w-full rounded-none border border-white/15 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-sky-500 disabled:opacity-50";

export interface QuickPartDialogProps {
  role?: HarnessRole;
  onClose: () => void;
  onCreated: (component: CatalogComponent) => void;
}

export function QuickPartDialog({ role: initialRole = "housing", onClose, onCreated }: QuickPartDialogProps) {
  const id = useId();
  const [role, setRole] = useState<HarnessRole>(initialRole);
  const [value, setValue] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [mpn, setMpn] = useState("");
  const [description, setDescription] = useState("");
  const [datasheet, setDatasheet] = useState("");
  const [category, setCategory] = useState(() => categoryFor(initialRole));
  const [extra, setExtra] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CatalogComponent | null>(null);

  const changeRole = (next: HarnessRole) => {
    if (category === categoryFor(role)) setCategory(categoryFor(next));
    setRole(next);
    setExtra({});
  };
  const setField = (key: string, text: string) => setExtra((current) => ({ ...current, [key]: text }));

  // The catalog's built-in required fields (description falls back to the value).
  const ready = [value, manufacturer, mpn, datasheet].every((text) => text.trim());

  const create = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const extraFields: Record<string, string> = { harness_role: role };
    for (const field of ROLE_FIELDS[role]) {
      const text = (extra[field.key] ?? "").trim();
      if (text) extraFields[field.key] = text;
    }
    try {
      const component = await createComponent({
        value: value.trim(),
        manufacturer: manufacturer.trim(),
        manufacturer_part_number: mpn.trim(),
        // The catalog requires a description; the value stands in when none is typed.
        description: description.trim() || value.trim(),
        datasheet: datasheet.trim(),
        category: category.trim(),
        change_summary: "Create harness part",
        extra_fields: extraFields,
      });
      setCreated(component);
      onCreated(component);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="max-h-[86vh] w-[min(94vw,560px)] max-w-none overflow-y-auto border-white/10 bg-[#0b1220] text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">{created ? "Part created" : "New harness part"}</DialogTitle>
          <DialogDescription className="text-zinc-400">
            An ordinary catalog part with its harness fields; it goes through the normal review.
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-2 text-sm">
            <p role="status" className="text-emerald-300">{created.name || created.value || value} created.</p>
            <p className="text-xs text-zinc-400">In review{created.workflow_stage ? ` · ${created.workflow_stage.replace("_", " ")}` : ""}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor={`${id}-role`} className="text-[11.5px] text-zinc-400">Role</Label>
              <select id={`${id}-role`} className={fieldBox} value={role} onChange={(event) => changeRole(event.target.value as HarnessRole)}>
                {HARNESS_ROLES.map((item) => <option key={item} value={item}>{HARNESS_ROLE_LABEL[item]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-value`} className="text-[11.5px] text-zinc-400">Value *</Label>
              <Input id={`${id}-value`} value={value} onChange={(event) => setValue(event.target.value)} placeholder="e.g. Micro-Fit 3.0 receptacle" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor={`${id}-manufacturer`} className="text-[11.5px] text-zinc-400">Manufacturer *</Label>
                <Input id={`${id}-manufacturer`} value={manufacturer} onChange={(event) => setManufacturer(event.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`${id}-mpn`} className="text-[11.5px] text-zinc-400">MPN *</Label>
                <Input id={`${id}-mpn`} value={mpn} onChange={(event) => setMpn(event.target.value)} required />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-description`} className="text-[11.5px] text-zinc-400">Description</Label>
              <Input id={`${id}-description`} value={description} onChange={(event) => setDescription(event.target.value)} placeholder={value.trim() || "Defaults to the value"} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-datasheet`} className="text-[11.5px] text-zinc-400">Datasheet URL *</Label>
              <Input id={`${id}-datasheet`} type="url" value={datasheet} onChange={(event) => setDatasheet(event.target.value)} placeholder="https://" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${id}-category`} className="text-[11.5px] text-zinc-400">Category</Label>
              <Input id={`${id}-category`} value={category} onChange={(event) => setCategory(event.target.value)} />
            </div>
            {ROLE_FIELDS[role].length > 0 && (
              <fieldset className="space-y-2 rounded-md border border-white/10 p-2">
                <legend className="px-1 text-[11px] uppercase tracking-wide text-zinc-500">Harness fields</legend>
                {ROLE_FIELDS[role].map((field) => (
                  <div key={field.key} className="space-y-1">
                    <Label htmlFor={`${id}-${field.key}`} className="text-[11.5px] text-zinc-400">{field.label}</Label>
                    {field.kind === "boolean" ? (
                      <select id={`${id}-${field.key}`} className={fieldBox} value={extra[field.key] ?? ""} onChange={(event) => setField(field.key, event.target.value)}>
                        <option value="">Not set</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    ) : (
                      <Input
                        id={`${id}-${field.key}`}
                        type={field.kind === "number" ? "number" : "text"}
                        value={extra[field.key] ?? ""}
                        onChange={(event) => setField(field.key, event.target.value)}
                      />
                    )}
                  </div>
                ))}
              </fieldset>
            )}
            {error && <p className="text-sm text-red-300" role="alert">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>{created ? "Close" : "Cancel"}</Button>
          {!created && <Button onClick={() => void create()} disabled={busy || !ready}>{busy ? "Creating…" : "Create part"}</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
