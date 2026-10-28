interface ProjectTimestamps {
    last_modified: string;
    last_synced_at?: string | null;
}

/**
 * "Last updated" for a project: when Prism last synced its repository, or its
 * registration time for projects that have never been synced.
 */
export function projectLastUpdated(project: ProjectTimestamps): string {
    const value = project.last_synced_at || project.last_modified;
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
