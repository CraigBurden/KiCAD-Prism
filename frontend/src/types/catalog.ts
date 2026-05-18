export type ComponentSource = "manual" | "external";
export type AvailabilityState = "metadata_only" | "files_partial" | "place_ready";
export type WorkflowStage = "open" | "in_progress" | "qa_review" | "done" | "released" | "archived";
export type ReleaseStatus = WorkflowStage;

export interface CatalogAsset {
  id: string;
  asset_type: "symbol" | "footprint" | "3dmodel" | "spice";
  name: string;
  target_library: string;
  target_name: string;
  content_type: string;
  required: boolean;
}

export interface CatalogPreview {
  id: string;
  kind: "symbol" | "footprint";
  status: "ready" | "failed";
  content_type: string;
  file_path: string;
  generation_error: string;
  updated_at?: string;
}

export interface CatalogComponent {
  id: string;
  slug: string;
  external_source: string;
  external_id: string;
  external_workflow_source: string;
  external_workflow_id: string;
  external_workflow_url: string;
  source: ComponentSource;
  name: string;
  value: string;
  manufacturer: string;
  mpn: string;
  description: string;
  package_name: string;
  category: string;
  datasheet_url: string;
  vendor: string;
  vendor_part_number: string;
  mass_g: string;
  rqjc_c_w: string;
  rqjc_top_c_w: string;
  temp_max_c: string;
  temp_min_c: string;
  power_dissipation_w: string;
  rate: string;
  sap_code: string;
  keywords: string[];
  availability_state: AvailabilityState;
  missing_assets: string[];
  place_enabled: boolean;
  stock_quantity: number;
  stock_uom: string;
  inventory_status: string;
  serial_number: string;
  lot_number: string;
  pedigree: string;
  last_synced_at: string;
  is_active: boolean;
  revision_id: string;
  version: string;
  summary: string;
  library_name: string;
  symbol_name: string;
  release_status: ReleaseStatus;
  workflow_stage: WorkflowStage;
  assets: CatalogAsset[];
  previews: CatalogPreview[];
}

export interface PaginatedComponents {
  items: CatalogComponent[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface SelectionRequiredResponse {
  mode: "selection_required";
  discovered_symbols?: string[];
  discovered_footprints?: string[];
}

export interface ImportCompletedResponse {
  mode?: "imported";
  discovered_symbols?: string[];
  selected_symbol?: string;
  discovered_footprints?: string[];
  selected_footprint?: string;
  component: CatalogComponent;
}
