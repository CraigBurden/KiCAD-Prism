import type { CatalogComponent, WorkflowStage } from "@/types/catalog";
import type { UserRole } from "@/types/auth";

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  designer: "Designer",
  viewer: "Viewer",
  qa: "QA",
};

export const ROLE_OPTIONS: UserRole[] = ["viewer", "designer", "qa", "admin"];

export type RoleAuthorityKey =
  | "view_projects"
  | "manage_projects"
  | "comment_on_projects"
  | "inspect_release_studio"
  | "start_release_builds"
  | "approve_project_releases"
  | "publish_project_releases"
  | "view_catalog"
  | "edit_catalog"
  | "review_catalog_qa"
  | "administer_workspace";

export interface RoleAuthority {
  key: RoleAuthorityKey;
  category: "Projects" | "Project releases" | "Component library" | "Administration";
  label: string;
  description: string;
  roles: readonly UserRole[];
}

/**
 * The role matrix mirrors the backend dependencies in core/security.py:
 * every signed-in role can read projects, project mutations require Designer,
 * catalog reads/writes use their dedicated allow-lists, and settings require
 * Admin. Keeping the UI helpers on this same data prevents the popover and the
 * controls it describes from drifting apart.
 */
export const ROLE_AUTHORITIES: readonly RoleAuthority[] = [
  {
    key: "view_projects",
    category: "Projects",
    label: "View available projects",
    description: "Browse projects, schematics, boards, and existing comments.",
    roles: ["viewer", "designer", "qa", "admin"],
  },
  {
    key: "manage_projects",
    category: "Projects",
    label: "Manage projects",
    description: "Import, sync, configure, move, and delete projects.",
    roles: ["designer", "admin"],
  },
  {
    key: "comment_on_projects",
    category: "Projects",
    label: "Write project comments",
    description: "Create, edit, reply to, delete, and publish comments.",
    roles: ["designer", "admin"],
  },
  {
    key: "inspect_release_studio",
    category: "Project releases",
    label: "Inspect Release Studio",
    description: "Open a project's Source-to-Publish rail, inspect outputs, and read build history.",
    roles: ["viewer", "designer", "qa", "admin"],
  },
  {
    key: "start_release_builds",
    category: "Project releases",
    label: "Start a project release build",
    description: "Choose Source, Identity, and Manufacturing, then enqueue the KiCad pipeline.",
    roles: ["designer", "admin"],
  },
  {
    key: "approve_project_releases",
    category: "Project releases",
    label: "Approve a project release",
    description: "Cast the Designer or QA sign-off on a succeeded build. QA cannot skip the Designer's slot; admin may fill either with a written override.",
    roles: ["designer", "qa", "admin"],
  },
  {
    key: "publish_project_releases",
    category: "Project releases",
    label: "Publish to GitHub or GitLab",
    description: "Create the forge Release after both sign-offs, clear DRC/ERC errors, and ready vendor packs.",
    roles: ["designer", "qa", "admin"],
  },
  {
    key: "view_catalog",
    category: "Component library",
    label: "View component library",
    description: "Browse components, revisions, validation, and release queues.",
    roles: ["designer", "qa", "admin"],
  },
  {
    key: "edit_catalog",
    category: "Component library",
    label: "Edit component library",
    description: "Create components, edit metadata, and attach library assets.",
    roles: ["designer", "admin"],
  },
  {
    key: "review_catalog_qa",
    category: "Component library",
    label: "Review component QA",
    description: "Approve or return components that are in QA review.",
    roles: ["qa", "admin"],
  },
  {
    key: "administer_workspace",
    category: "Administration",
    label: "Administer workspace",
    description: "Manage users, sessions, Git access, and workspace settings.",
    roles: ["admin"],
  },
] as const;

const WORKFLOW_TRANSITIONS: Record<WorkflowStage, WorkflowStage[]> = {
  open: ["in_progress", "archived"],
  in_progress: ["qa_review", "open", "archived"],
  qa_review: ["done", "in_progress", "archived"],
  done: ["released", "qa_review", "archived"],
  released: ["archived", "open"],
  archived: ["open"],
};

export function roleLabel(role: UserRole): string {
  return ROLE_LABELS[role] ?? role;
}

export function roleHasAuthority(role: UserRole | null | undefined, authority: RoleAuthorityKey): boolean {
  if (!role) return false;
  return ROLE_AUTHORITIES.find((entry) => entry.key === authority)?.roles.includes(role) ?? false;
}

export function canManageProjects(role?: UserRole | null): boolean {
  return roleHasAuthority(role, "manage_projects");
}

export function canOpenLibraryManager(role?: UserRole | null): boolean {
  return roleHasAuthority(role, "view_catalog");
}

export function canWriteCatalog(role?: UserRole | null): boolean {
  return roleHasAuthority(role, "edit_catalog");
}

export function canReviewCatalogQa(role?: UserRole | null): boolean {
  return roleHasAuthority(role, "review_catalog_qa");
}

export function workflowStage(component: CatalogComponent): WorkflowStage {
  return component.workflow_stage ?? component.release_status;
}

export function allowedWorkflowTransitions(role: UserRole | undefined | null, component: CatalogComponent): WorkflowStage[] {
  const current = workflowStage(component);
  const transitions = WORKFLOW_TRANSITIONS[current] ?? [];
  if (role === "admin") {
    return transitions;
  }
  if (role === "designer") {
    return transitions.filter((next) => !(current === "qa_review" && next === "done"));
  }
  if (role === "qa" && current === "qa_review") {
    return transitions.filter((next) => next === "done" || next === "in_progress" || next === "archived");
  }
  return [];
}
