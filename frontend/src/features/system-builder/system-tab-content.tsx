import type { User } from "@/types/auth";
import type { SystemDocument } from "@/types/system";

import type { SystemTab } from "./system-tabs";
import type { PartDetail } from "./workspace/part-detail";
import type { TrayTab, WorkspaceSelection } from "./workspace/workspace-state";

export interface SystemTabProps {
  systemId: string;
  document: SystemDocument;
  canEdit: boolean;
  user: User | null;
  /** Switch tab, optionally selecting something in it (`{board: id}`, `{link: id}`). */
  onNavigate: (tab: SystemTab, params?: Record<string, string>) => void;
  /** The workspace selection the view shows (PLAN M8, SB2-61); views report their picks through `onSelect`. */
  selection?: WorkspaceSelection | null;
  onSelect?: (selection: WorkspaceSelection | null) => void;
  /** The 3D view reports the part picked on a board, for the inspector. */
  onPart?: (part: PartDetail | null) => void;
  /**
   * Where the 3D view puts its move, route and trace panels (the top of the
   * inspector) and its net list (the Nets tray); null where they float over
   * the view instead (below `lg`, or the tray on another tab).
   */
  inspectorSlot?: HTMLElement | null;
  netsSlot?: HTMLElement | null;
  onOpenTray?: (tab: TrayTab | null) => void;
  /** Bumped by the inspector's Edit route: the 3D view enters Route mode (D-P2-51). */
  routeRequest?: number;
}
