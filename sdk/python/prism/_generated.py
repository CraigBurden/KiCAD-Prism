"""Generated from openapi.json by tools/generate.py. Do not edit."""

from __future__ import annotations

from typing import Any, TypedDict


class AcceptProjectImportProposalRequest(TypedDict, total=False):
    asset_links: dict[str, str]
    asset_selections: dict[str, list[str]]
    change_summary: str
    metadata_overrides: dict[str, Any]


class AcknowledgeRequest(TypedDict, total=True):
    visibility: str


class ActiveSession(TypedDict, total=False):
    client_ip: str
    created_at: str
    expires_at: str
    id: str
    last_seen_at: str
    user_agent: str


class AgentTokenView(TypedDict, total=False):
    created_at: str | None
    email: str
    expires_at: int
    jti: str
    label: str
    last_used_at: str | None
    scopes: list[str]


class AlignmentRequest(TypedDict, total=False):
    offsetMm: list[float]
    rotationDeg: list[float]
    scale: float


class AnalyzeRequest(TypedDict, total=False):
    ref: str | None
    url: str


class ApplyMetadataBatchRequest(TypedDict, total=False):
    item_ids: list[str]


class AssetBrowseResult(TypedDict, total=True):
    files: list[str]
    total: int


class AssetChange(TypedDict, total=True):
    after: ComparedAsset | None
    before: ComparedAsset | None
    key: str
    status: str


class AssetSearchItem(TypedDict, total=True):
    asset_type: str
    id: str
    name: str
    sha256: str
    size_bytes: int
    target_library: str
    target_name: str
    usage_count: int


class AssetSearchPage(TypedDict, total=True):
    items: list[AssetSearchItem]


class AuditEvent(TypedDict, total=True):
    actor: str
    component_id: str
    created_at: str
    details: dict[str, Any]
    details_json: str
    event_hash: str
    event_type: str
    id: str
    previous_hash: str
    revision_id: str
    sequence: int


class AuditEventPage(TypedDict, total=True):
    items: list[AuditEvent]


class AuditVerification(TypedDict, total=False):
    anchored_head_hash: str | None
    asset_count: int | None
    coverage: str
    event_count: int
    first_invalid_asset_id: str | None
    first_invalid_event_id: str
    first_invalid_revision_id: str | None
    head_hash: str
    purged_asset_ids: list[str] | None
    reason: str
    revision_count: int | None
    valid: bool
    verified_count: int


class AuthConfig(TypedDict, total=False):
    """Authentication configuration exposed to frontend."""
    auth_enabled: bool
    dev_mode: bool
    oidc_enabled: bool
    oidc_provider_name: str
    password_auth_enabled: bool
    sim_studio_enabled: bool
    workspace_name: str


class BenchmarkMetrics(TypedDict, total=True):
    """Queue latency, job write rate and the API's pool counters."""
    activeJobs: int
    apiCommentLive: CommentLiveMetrics
    apiDatabasePool: DatabasePoolMetrics
    apiThreadPool: ThreadPoolMetrics
    byKindStatus: list[KindStatusCount]
    claimLatencyMs: ClaimLatency
    jobCount: int
    jobUpdateRatePerSecond: JobUpdateRate
    since: str


class Body_agent_token(TypedDict, total=True):
    code: str
    code_verifier: str
    redirect_uri: str


class Body_import_auxiliary_asset(TypedDict, total=False):
    file: str
    target_library: str


class Body_import_footprint(TypedDict, total=False):
    counterpart_asset_id: str
    file: str
    selected_footprint: str
    target_library: str


class Body_import_inventory_csv(TypedDict, total=True):
    file: str


class Body_import_proposals_csv(TypedDict, total=True):
    file: str


class Body_import_symbol_library(TypedDict, total=False):
    counterpart_asset_id: str
    file: str
    selected_symbol: str
    target_library: str


class Body_preview_metadata_csv(TypedDict, total=False):
    change_summary: str
    file: str


class Body_token(TypedDict, total=False):
    client_id: str
    client_secret: str
    grant_type: str
    scope: str


class Body_upload_comment_attachment(TypedDict, total=True):
    file: str


class Body_upload_folder_snapshot_file(TypedDict, total=True):
    file: str
    relative_path: str


class Body_upload_project_thumbnail(TypedDict, total=True):
    file: str


class BomLineOut(TypedDict, total=True):
    fields: dict[str, str]
    key: str
    quantity: int
    references: list[str]


class BomOut(TypedDict, total=True):
    columns: list[str]
    commit: str | None
    designKey: str
    lines: list[BomLineOut]


class BulkAcceptItem(TypedDict, total=False):
    asset_links: dict[str, str]
    asset_selections: dict[str, list[str]]
    change_summary: str
    metadata_overrides: dict[str, Any]
    proposal_id: str


class BulkAcceptRequest(TypedDict, total=False):
    items: list[BulkAcceptItem]


class CandidateRequest(TypedDict, total=False):
    board: str
    bom_preset: str
    commit_sha: str
    config_key: str
    identity: dict[str, Any]
    impedance_csv: str
    manufacturing: dict[str, Any]
    schematic: str
    stackup_pdf_b64: str
    variant: str


class CatalogCategories(TypedDict, total=True):
    categories: list[CatalogCategory]


class CatalogCategory(TypedDict, total=True):
    count: int
    name: str


class CatalogComponent(TypedDict, total=False):
    """A full component payload, or the lightweight summary the queue returns.

Fields the summary does not carry are optional; ``response_model_exclude_unset``
keeps an absent field out of the response instead of emitting ``null``."""
    assets: list[ComponentAsset]
    availability_state: str
    category: str
    change_kind: str | None
    change_summary: str | None
    component_created_at: str | None
    component_updated_at: str
    created_by: str
    current_revision_id: str | None
    datasheet_url: str
    default_representation_id: str | None
    description: str
    effective_representation_id: str | None
    external_id: str | None
    external_payload: dict[str, Any] | None
    external_source: str | None
    external_updated_at: str | None
    external_url: str | None
    external_workflow_id: str | None
    external_workflow_source: str | None
    external_workflow_url: str | None
    extra_fields: dict[str, Any]
    id: str
    identity_kind: str
    interface: dict[str, Any]
    inventory_status: str
    is_active: bool | None
    is_historical_revision: bool | None
    kind: str
    last_synced_at: str | None
    library_name: str
    local_inventory: LocalInventory | None
    lot_number: str | None
    manifest_hash: str | None
    manufacturer: str
    mass_g: str
    missing_assets: list[str]
    mpn: str
    name: str
    package_name: str
    parent_revision_id: str | None
    pedigree: str | None
    place_enabled: bool
    power_dissipation_w: str
    previews: list[ComponentPreview]
    rate: str
    release_status: str
    released_revision_id: str | None
    released_view: bool
    representations: list[Representation] | None
    revision: int
    revision_created_at: str | None
    revision_id: str
    revision_updated_at: str
    rqjc_c_w: str
    rqjc_top_c_w: str
    sap_code: str
    serial_number: str | None
    slug: str
    source: str
    source_ref: dict[str, Any]
    stock_known: bool
    stock_quantity: float
    stock_uom: str
    summary: str
    supply: Supply | None
    symbol_name: str
    sync_error: str | None
    sync_status: str | None
    temp_max_c: str
    temp_min_c: str
    validation: ValidationSummary
    value: str
    vendor: str
    vendor_part_number: str
    version: str
    workflow_stage: str


class CatalogComponentPage(TypedDict, total=True):
    items: list[CatalogComponent]
    page: int
    page_size: int
    pages: int
    total: int


class CatalogHealth(TypedDict, total=True):
    checker_available: bool
    checker_path: str
    enabled: bool
    missing_files: int
    place_ready: int
    preview_failed: int
    release_gate: str
    released: int
    released_assets_missing_on_disk: int | None
    total_components: int
    validation: dict[str, int]


class CatalogJob(TypedDict, total=True):
    """A ``ws_jobs`` row after the catalog adapter and result spread.

The adapter spreads a completed job's ``result`` at the top level, so this
model accepts keys it does not name."""
    artifact_key: str | None
    attempt: int
    attempts: int
    available_at: str | None
    cancel_requested_at: str | None
    checkpoint: dict[str, Any]
    completed_at: str | None
    created_at: str | None
    created_by: str
    error_code: str
    error_message: str
    fence: int
    heartbeat_at: str | None
    id: str
    job_id: str
    job_type: str
    kind: str
    lease_expires_at: str | None
    lease_owner: str
    lock_requirements: list[Any]
    log_path: str | None
    max_attempts: int
    message: str
    payload: dict[str, Any]
    percent: float
    priority: int
    progress: float
    project_id: str | None
    repository_id: str | None
    requested_by: str
    resource_requirements: dict[str, Any]
    result: dict[str, Any]
    result_digest: str | None
    result_metadata: dict[str, Any]
    result_path: str | None
    stage: str
    started_at: str | None
    status: str
    updated_at: str | None
    worker_pool: str


class CatalogJobWithEvents(TypedDict, total=True):
    artifact_key: str | None
    attempt: int
    attempts: int
    available_at: str | None
    cancel_requested_at: str | None
    checkpoint: dict[str, Any]
    completed_at: str | None
    created_at: str | None
    created_by: str
    error_code: str
    error_message: str
    events: list[app__api__catalog_admin_models__JobEvent]
    fence: int
    heartbeat_at: str | None
    id: str
    job_id: str
    job_type: str
    kind: str
    lease_expires_at: str | None
    lease_owner: str
    lock_requirements: list[Any]
    log_path: str | None
    max_attempts: int
    message: str
    payload: dict[str, Any]
    percent: float
    priority: int
    progress: float
    project_id: str | None
    repository_id: str | None
    requested_by: str
    resource_requirements: dict[str, Any]
    result: dict[str, Any]
    result_digest: str | None
    result_metadata: dict[str, Any]
    result_path: str | None
    stage: str
    started_at: str | None
    status: str
    updated_at: str | None
    worker_pool: str


class ChangePasswordRequest(TypedDict, total=True):
    current_password: str
    new_password: str


class CheckAccessRequest(TypedDict, total=True):
    url: str


class ClaimLatency(TypedDict, total=True):
    max: float
    p50: float
    p95: float


class CommentLiveMetrics(TypedDict, total=True):
    connections: int
    deliveredEvents: int
    eventLagMaxMs: float
    eventLagMeanMs: float
    listenerConnected: bool
    listenerReconnects: int
    replayFailures: int


class CommentLocation(TypedDict, total=False):
    bounds: list[float] | None
    layer: str
    page: str
    x: float
    y: float


class CommitDistance(TypedDict, total=True):
    commits_behind: int


class CommitFileChange(TypedDict, total=True):
    additions: int | None
    deletions: int | None
    filename: str
    path: str
    status: str


class CommitKicadChanges(TypedDict, total=True):
    other: int
    pcb: int
    pro: int
    sch: int


class ComparedAsset(TypedDict, total=True):
    assetId: str
    assetType: str
    previewGeneratorFingerprint: str
    previewId: str
    previewSha256: str
    previewStatus: str
    previews: list[ComparedPreview]
    sha256: str
    sizeBytes: int
    targetLibrary: str
    targetName: str


class ComparedPreview(TypedDict, total=True):
    previewGeneratorFingerprint: str
    previewId: str
    previewSha256: str
    previewStatus: str
    unit: str
    unitLabel: str


class ComparedRepresentation(TypedDict, total=True):
    displayOrder: int
    footprintAssetId: str
    isDefault: bool
    label: str
    provenance: dict[str, Any]
    sourceInternalPartNumber: str
    symbolAssetId: str


class ComparedRevision(TypedDict, total=True):
    manifestHash: str
    revisionId: str
    version: int


class ComparisonReviewOut(TypedDict, total=True):
    domain: str
    groups: list[ReviewGroupOut]
    jobId: str


class ComponentAsset(TypedDict, total=True):
    asset_type: str
    content_type: str
    id: str
    name: str
    required: bool
    sha256: str
    size_bytes: int
    source_group: str
    target_library: str
    target_name: str


class ComponentPreview(TypedDict, total=True):
    asset_id: str
    content_type: str
    file_path: str
    generation_error: str
    generator_fingerprint: str
    generator_version: str
    id: str
    kind: str
    preview_key: str
    sha256: str
    status: str
    unit: str
    unit_label: str
    updated_at: str


class ComponentReleaseRecord(TypedDict, total=True):
    approval_decision_id: str
    component_id: str
    created_at: str
    id: str
    manifest_hash: str
    policy: dict[str, Any]
    policy_json: str
    release_label: str
    released_by: str
    revision_id: str
    validation: dict[str, Any]
    validation_json: str


class ComponentReleaseRecordPage(TypedDict, total=True):
    items: list[ComponentReleaseRecord]


class ComponentReviewDecision(TypedDict, total=True):
    component_id: str
    created_at: str
    decision: str
    id: str
    manifest_hash: str
    note: str
    policy: dict[str, Any]
    policy_json: str
    reviewer: str
    reviewer_role: str
    revision_id: str
    validation: dict[str, Any]
    validation_json: str


class ComponentReviewDecisionPage(TypedDict, total=True):
    items: list[ComponentReviewDecision]


class ComponentRevision(TypedDict, total=True):
    change_kind: str
    change_summary: str
    component_id: str
    created_at: str
    created_by: str
    id: str
    manifest_hash: str
    parent_revision_id: str
    release_status: str
    updated_at: str
    version: int
    workflow_stage: str


class ComponentRevisionPage(TypedDict, total=True):
    items: list[ComponentRevision]


class ComponentUsage(TypedDict, total=True):
    component_id: str
    details: list[Any]
    details_json: str
    first_seen_at: str
    id: str
    is_current: bool
    last_seen_at: str
    project_id: str
    references: list[Any]
    references_json: str
    source: str
    source_revision: str


class ComponentUsagePage(TypedDict, total=True):
    items: list[ComponentUsage]


class ComponentValidation(TypedDict, total=True):
    runs: list[ValidationRun]
    summary: ValidationSummary


class ConnectorCredentials(TypedDict, total=False):
    appId: str
    installationId: str
    oauthClientId: str
    oauthClientSecret: str
    privateKey: str
    webhookSecret: str


class CreateCommentRequest(TypedDict, total=False):
    commentClass: str | None
    content: str
    contentFormat: str | None
    context: str
    elementId: str | None
    elementRef: str | None
    elementType: str | None
    location: CommentLocation
    mentions: list[str] | None
    metadata: dict[str, Any] | None
    revision: CreateDisplayedRevision | None
    severity: str | None


class CreateComparisonCommentRequest(TypedDict, total=False):
    anchorKind: str
    baseCommit: str
    commentClass: str | None
    compareCommit: str
    content: str
    contentFormat: str | None
    domain: str
    filePath: str | None
    mentions: list[str] | None
    selectedSide: str | None
    semanticItemId: str | None
    semanticItemRef: str | None
    severity: str | None


class CreateConnectorRequest(TypedDict, total=False):
    baseUrl: str
    credentials: ConnectorCredentials | None
    displayName: str
    id: str | None
    instanceKind: str
    provider: str


class CreateDisplayedRevision(TypedDict, total=False):
    commit: str | None
    sourceRevisionKey: str | None
    worktree: bool


class CreateFolderRequest(TypedDict, total=False):
    name: str
    parent_id: str | None


class CreateManualComponentRequest(TypedDict, total=False):
    category: str
    change_summary: str
    datasheet: str
    description: str
    extra_fields: dict[str, str]
    manufacturer: str
    manufacturer_part_number: str
    mass_g: str
    package_name: str
    power_dissipation_w: str
    rate: str
    rqjc_c_w: str
    rqjc_top_c_w: str
    sap_code: str
    temp_max_c: str
    temp_min_c: str
    value: str
    vendor: str
    vendor_part_number: str


class CreateMetadataBatchRequest(TypedDict, total=False):
    change_summary: str
    items: list[MetadataBatchItemRequest]


class CreatePersonalTokenRequest(TypedDict, total=False):
    expiresInDays: int
    name: str
    scopes: list[str]


class CreateReplyRequest(TypedDict, total=False):
    content: str
    contentFormat: str | None


class CreateRepresentationRequest(TypedDict, total=False):
    change_summary: str
    display_order: int
    footprint_asset_id: str
    is_default: bool
    label: str
    provenance: dict[str, Any]
    source_internal_part_number: str
    symbol_asset_id: str


class CreateServiceClientRequest(TypedDict, total=False):
    name: str
    role: str
    scopes: list[str]


class CreatedPersonalToken(TypedDict, total=False):
    """The one response that carries the secret, shown once."""
    created_at: str
    expires_at: str
    id: str
    last_used_at: str | None
    name: str
    prefix: str
    revoked_at: str | None
    scopes: list[str]
    token: str
    user_email: str


class DatabasePoolMetrics(TypedDict, total=True):
    connectionWaitCount: int
    connectionWaitMaxMs: float
    connectionWaitMeanMs: float
    pool: dict[str, Any]


class DesignAssemblyOut(TypedDict, total=False):
    dnp: bool | None
    excludeFromBoard: bool | None
    excludeFromBom: bool | None
    excludeFromPosFiles: bool | None
    excludeFromSim: bool | None


class DesignBundleStatus(TypedDict, total=True):
    """The bundle counts, alias count, stored size and the incomplete list."""
    aliases: int
    bundles: dict[str, int]
    failedBuilds: list[FailedBuild]
    incomplete: IncompleteCounts
    incompleteRevisions: list[IncompleteRevision]
    storedBytes: int


class DesignCompareDebugEvent(TypedDict, total=False):
    event: str
    payload: dict[str, Any]
    reset: bool
    sequence: int
    session_id: str
    timestamp: str


class DesignCompareRequest(TypedDict, total=False):
    base: str
    head: str
    include_unchanged: bool


class DesignComponent(TypedDict, total=False):
    assembly: DesignAssemblyOut
    componentUid: str | None
    dnp: bool
    fields: dict[str, str]
    footprint: str
    inBom: bool | None
    libraryRef: str | None
    page: str | None
    pins: list[DesignPinOut]
    reference: str
    sheet: str | None
    value: str


class DesignComponentOut(TypedDict, total=True):
    component: DesignComponent
    revision: DesignRevisionOut


class DesignNet(TypedDict, total=False):
    aliases: list[str]
    components: list[str]
    name: str
    netClass: str
    netUid: str | None
    pins: list[DesignNetPin]


class DesignNetOut(TypedDict, total=True):
    net: DesignNet
    revision: DesignRevisionOut


class DesignNetPin(TypedDict, total=False):
    pin: str
    pinName: str
    reference: str


class DesignPinOut(TypedDict, total=False):
    net: str | None
    netUid: str | None
    pin: str
    pinName: str


class DesignRevisionOut(TypedDict, total=False):
    commit: str
    designKey: str | None


class DesignSearchHit(TypedDict, total=False):
    field: str | None
    footprint: str | None
    kind: str
    matched: str
    name: str | None
    reference: str | None
    value: str | None


class DesignSearchOut(TypedDict, total=True):
    query: str
    results: list[DesignSearchHit]
    revision: DesignRevisionOut


class DestinationBody(TypedDict, total=False):
    containerKind: str
    containerPath: str
    generation: int | None
    remoteContainerId: str
    visibility: str | None


class DocFileContent(TypedDict, total=True):
    content: str
    path: str


class DraftSetupRequest(TypedDict, total=False):
    commit: str | None
    kind: str
    name: str


class EventOut(TypedDict, total=True):
    createdAt: str
    id: int
    kind: str
    payload: dict[str, Any]
    projectId: str | None
    topic: str


class EventPage(TypedDict, total=True):
    events: list[EventOut]
    next: int


class FailedBuild(TypedDict, total=True):
    """A bundle whose build failed outright."""
    commit: str | None
    reason: str
    revisionKey: str | None


class FileItem(TypedDict, total=True):
    is_dir: bool
    modified_date: str
    name: str
    path: str
    size: int
    type: str


class FolderApprovalRequest(TypedDict, total=False):
    approved_component_ids: list[str]
    footprint_resolutions: dict[str, str]


class FolderContents(TypedDict, total=True):
    folders: list[FolderRecord]
    projects: list[Project]


class FolderDiscoveryRequest(TypedDict, total=False):
    files: list[FolderInventoryFile]
    footprint_resolutions: dict[str, str]


class FolderImportRoot(TypedDict, total=True):
    name: str
    path_hint: str


class FolderImportRootPage(TypedDict, total=True):
    items: list[FolderImportRoot]


class FolderInventoryFile(TypedDict, total=False):
    relative_path: str
    size_bytes: int


class FolderNode(TypedDict, total=True):
    """One row of the folder tree the workspace renders."""
    allowed_roles: list[str]
    depth: int
    direct_project_count: int
    has_children: bool
    id: str
    name: str
    parent_id: str | None
    total_project_count: int
    visibility_mode: str | None


class FolderRecord(TypedDict, total=True):
    """A ``ws_folders`` row as the folder-content route returns it."""
    allowed_roles: list[str]
    created_at: str
    id: str
    name: str
    parent_id: str | None
    updated_at: str
    visibility_mode: str | None


class FolderSnapshotRequest(TypedDict, total=False):
    display_name: str


class GenerateSSHKeyRequest(TypedDict, total=False):
    email: str


class HTTPValidationError(TypedDict, total=False):
    detail: list[ValidationError]


class HostKeyRequest(TypedDict, total=False):
    host: str
    port: int


class ImportProposal(TypedDict, total=True):
    accepted_component_id: str
    assets: list[dict[str, Any]]
    component_uid: str
    created_at: str
    dedupe_key: str
    draft: dict[str, Any]
    findings: list[dict[str, Any]]
    id: str
    metadata: dict[str, Any]
    provenance: list[dict[str, Any]]
    reference: str
    session_id: str
    status: str
    updated_at: str


class ImportProposalPage(TypedDict, total=True):
    items: list[ImportProposal]


class ImportRequest(TypedDict, total=False):
    import_type: str
    ref: str | None
    selected_paths: list[str] | None
    url: str


class ImportSession(TypedDict, total=True):
    candidate_count: int
    created_at: str
    created_by: str
    error_message: str
    id: str
    project_id: str
    project_ids: list[str]
    project_revisions: dict[str, str]
    proposal_count: int
    scope: str
    selection: dict[str, Any]
    source_revision: str
    status: str
    updated_at: str


class ImportSessionPage(TypedDict, total=True):
    items: list[ImportSession]


class IncompleteCounts(TypedDict, total=True):
    failed: int
    partial: int


class IncompleteRevision(TypedDict, total=True):
    """A complete bundle whose stages failed or were only partial."""
    commit: str | None
    failedStages: list[str]
    partialStages: list[str]
    reason: str
    revisionKey: str | None


class JobEvents(TypedDict, total=True):
    events: list[app__api__jobs__JobEvent]
    job_id: str


class JobLogs(TypedDict, total=True):
    job_id: str
    lines: list[str]


class JobStatus(TypedDict, total=False):
    """The slim job row the status route returns."""
    attempt: int | None
    available_at: str | None
    cancel_requested_at: str | None
    completed_at: str | None
    created_at: str | None
    error_code: str | None
    error_message: str | None
    job_id: str
    kind: str | None
    max_attempts: int | None
    message: str | None
    percent: float | None
    pipeline: Any
    project_id: str | None
    repository_id: str | None
    result_digest: str | None
    result_metadata: dict[str, Any] | None
    result_url: str | None
    stage: str | None
    started_at: str | None
    status: str | None
    updated_at: str | None


class JobUpdateRate(TypedDict, total=True):
    max: float
    p95: float


class KindStatusCount(TypedDict, total=True):
    count: int
    kind: str
    status: str


class LabelsBody(TypedDict, total=False):
    base: str
    boardPrefix: str
    classPrefix: str
    severityPrefix: str


class LinkAssetRequest(TypedDict, total=False):
    counterpart_asset_id: str
    file_path: str
    target_library: str
    target_name: str


class LocalInventory(TypedDict, total=True):
    fetch_status: str
    fetched_at: str
    inventory_status: str
    mixed_fetch: bool
    mixed_freshness: bool
    mixed_status: bool
    mixed_units: bool
    quantity: float
    source: str
    uom: str


class LoginRequest(TypedDict, total=True):
    """Request body for OIDC auth code exchange."""
    code: str
    redirectUri: str
    state: str


class LoginStartResponse(TypedDict, total=True):
    """Where the browser should send the user to authenticate."""
    authorization_url: str


class MateOut(TypedDict, total=True):
    componentId: str
    createdAt: str
    createdBy: str
    manufacturer: str
    mpn: str
    name: str


class MatePage(TypedDict, total=True):
    items: list[MateOut]


class MateRequest(TypedDict, total=True):
    componentId: str


class MentionCandidate(TypedDict, total=True):
    email: str
    role: str


class MetadataBatch(TypedDict, total=True):
    applied_items: int
    change_summary: str
    created_at: str
    created_by: str
    failed_items: int
    id: str
    items: list[MetadataBatchItem]
    schema_version: str
    source: str
    status: str
    total_items: int
    unknown_fields: list[Any]
    updated_at: str
    valid_items: int


class MetadataBatchItem(TypedDict, total=True):
    applied_revision_id: str
    component_id: str
    diff: list[dict[str, str]]
    error_message: str
    expected_revision_id: str
    id: str
    mpn: str
    name: str
    patch: dict[str, str]
    validation_status: str


class MetadataBatchItemRequest(TypedDict, total=False):
    component_id: str
    expected_revision_id: str
    patch: dict[str, str]


class MetadataChange(TypedDict, total=True):
    after: str
    before: str
    field: str
    status: str


class MetadataField(TypedDict, total=True):
    archived: bool
    built_in: bool
    created_at: str
    created_by: str
    description: str
    display_order: int
    enum_values: list[str]
    group: str
    id: str
    key: str
    label: str
    required: bool
    storage_key: str
    storage_kind: str
    type: str
    unit: str
    updated_at: str
    updated_by: str


class MetadataFieldPage(TypedDict, total=True):
    items: list[MetadataField]
    schema: str


class MetadataFieldRequest(TypedDict, total=False):
    description: str
    display_order: int | None
    enum_values: list[str]
    key: str
    label: str
    required: bool
    type: str
    unit: str


class MetadataGridPage(TypedDict, total=True):
    fields: list[MetadataField]
    items: list[CatalogComponent]
    page: int
    page_size: int
    pages: int
    schema: str
    total: int


class MetadataGridPreferences(TypedDict, total=False):
    """The saved layout, or ``{}`` when this user has never saved one."""
    order: list[str] | None
    pinned: list[str] | None
    visible: list[str] | None
    widths: dict[str, int] | None


class MetadataGridPreferencesRequest(TypedDict, total=False):
    order: list[str]
    pinned: list[str]
    visible: list[str]
    widths: dict[str, int]


class ModelAlignment(TypedDict, total=True):
    offsetMm: list[float]
    rotationDeg: list[float]
    scale: float
    updatedAt: str | None
    updatedBy: str | None


class ModelGlb(TypedDict, total=True):
    bounds: dict[str, Any]
    converter: str
    key: str
    materials: int
    sizeBytes: int


class ModelOut(TypedDict, total=True):
    alignment: ModelAlignment
    assetId: str
    glb: ModelGlb | None
    name: str
    stepSha256: str


class ModelPage(TypedDict, total=True):
    items: list[ModelOut]


class Monorepo(TypedDict, total=False):
    last_synced: str | None
    name: str
    path: str
    project_count: int
    repo_url: str | None


class MonorepoFolder(TypedDict, total=True):
    item_count: int
    name: str
    path: str


class MonorepoProject(TypedDict, total=True):
    display_name: str | None
    has_thumbnail: bool
    id: str
    last_modified: str
    name: str
    relative_path: str


class MonorepoStructure(TypedDict, total=True):
    current_path: str
    folders: list[MonorepoFolder]
    projects: list[MonorepoProject]
    repo_name: str


class MoveProjectRequest(TypedDict, total=False):
    folder_id: str | None


class MoveProjectsRequest(TypedDict, total=False):
    folder_id: str | None
    project_ids: list[str]


class OAuthBeginResponse(TypedDict, total=True):
    authorizeUrl: str


class PasswordLoginRequest(TypedDict, total=False):
    email: str
    password: str
    remember_me: bool


class PasswordLoginResponse(TypedDict, total=False):
    email: str
    must_change_password: bool
    name: str
    picture: str
    role: str


class PathConfig(TypedDict, total=False):
    """Path configuration model."""
    description: str | None
    designOutputs: str | None
    documentation: str | None
    jobset: str | None
    manufacturingOutputs: str | None
    pcb: str | None
    portfolio: dict[str, Any] | None
    project_name: str | None
    readme: str | None
    schematic: str | None
    subsheets: str | None
    thumbnail: str | None
    workflows: list[Any] | None


class PersonalTokenView(TypedDict, total=False):
    """A token as its owner (or an admin) may see it: no secret, no hash."""
    created_at: str
    expires_at: str
    id: str
    last_used_at: str | None
    name: str
    prefix: str
    revoked_at: str | None
    scopes: list[str]
    user_email: str


class PinCommentRequest(TypedDict, total=True):
    commit: str


class PlacementCounts(TypedDict, total=True):
    bottom: int
    dnpPlaced: int
    notInBom: int
    notPlaced: int
    placed: int
    top: int


class PlacementFiles(TypedDict, total=True):
    bom: str
    positions: str


class PlacementMissingPart(TypedDict, total=True):
    """A BOM part the position files never place."""
    package: str
    ref: str
    status: str
    value: str


class PlacementPart(TypedDict, total=True):
    """One placed part in board coordinates."""
    package: str
    ref: str
    rotation: float
    side: str
    status: str
    value: str
    x: float
    y: float


class PlacementView(TypedDict, total=True):
    """The parts of a folder's position files, checked against its BOM."""
    counts: PlacementCounts
    files: PlacementFiles
    hasBom: bool
    missing: list[PlacementMissingPart]
    parts: list[PlacementPart]
    present: bool
    warnings: list[str]


class Project(TypedDict, total=False):
    description: str
    display_name: str | None
    folder_id: str | None
    id: str
    import_type: str | None
    last_modified: str
    last_synced_at: str | None
    name: str
    origin_owner: str | None
    origin_url: str | None
    parent_repo: str | None
    parent_repo_path: str | None
    path: str
    portfolio: dict[str, Any] | None
    project_file: str | None
    registered_at: str | None
    repo_url: str | None
    sub_path: str | None
    thumbnail_source: str | None
    thumbnail_url: str | None


class ProjectBranch(TypedDict, total=True):
    author: str
    commit: str
    date: str
    email: str
    hash: str
    is_current: bool
    message: str
    name: str
    ref: str
    source: str


class ProjectBranches(TypedDict, total=True):
    branches: list[ProjectBranch]
    current_branch: str | None
    default_ref: str | None


class ProjectCommit(TypedDict, total=True):
    author: str
    date: str
    email: str
    full_hash: str
    hash: str
    kicad_changes: CommitKicadChanges
    message: str


class ProjectCommitSummary(TypedDict, total=True):
    base_commit: str | None
    compare_commit: str
    comparison_basis: str
    files: list[CommitFileChange]
    parent_count: int


class ProjectCommits(TypedDict, total=True):
    commits: list[ProjectCommit]
    has_more: bool
    head: str | None
    limit: int
    offset: int
    resolved_ref_sha: str
    total: int | None


class ProjectComponentSelectionRequest(TypedDict, total=False):
    component_uid: str
    pcb_footprint_uuid: str
    reference: str
    schematic_uuid: str


class ProjectDescription(TypedDict, total=True):
    description: str


class ProjectDescriptionRequest(TypedDict, total=True):
    description: str


class ProjectImportRequest(TypedDict, total=False):
    project_id: str
    scope: str
    selection: ProjectComponentSelectionRequest | None
    source_revision: str


class ProjectName(TypedDict, total=True):
    display_name: str | None
    fallback_name: str


class ProjectNameRequest(TypedDict, total=True):
    display_name: str


class ProjectOverview(TypedDict, total=True):
    project: Project
    readme: str | None


class ProjectPathConfig(TypedDict, total=True):
    config: PathConfig
    resolved: ResolvedPaths
    source: str


class ProjectPropertiesFiles(TypedDict, total=False):
    pcb: ProjectPropertiesPcbFile | None
    schematic: ProjectPropertiesSchematicFile | None


class ProjectPropertiesLatestCommit(TypedDict, total=True):
    author: str
    date: str
    email: str
    full_hash: str
    hash: str
    message: str


class ProjectPropertiesPcbFile(TypedDict, total=False):
    dimensions_mm: dict[str, float] | None
    filename: str
    generator: str | None
    generator_version: str | None
    path: str
    thickness_mm: float | None
    title_block: ProjectPropertiesTitleBlock | None
    version: int | None


class ProjectPropertiesRepository(TypedDict, total=False):
    latest_commit: ProjectPropertiesLatestCommit | None
    latest_tag: ProjectPropertiesTag | None


class ProjectPropertiesResponse(TypedDict, total=True):
    files: ProjectPropertiesFiles
    project: Project
    repository: ProjectPropertiesRepository


class ProjectPropertiesSchematicFile(TypedDict, total=False):
    filename: str
    generator: str | None
    generator_version: str | None
    path: str
    title_block: ProjectPropertiesTitleBlock | None
    version: int | None


class ProjectPropertiesTag(TypedDict, total=True):
    commit_hash: str
    date: str
    message: str
    tag: str


class ProjectPropertiesTitleBlock(TypedDict, total=False):
    date: str
    title: str


class ProjectReadme(TypedDict, total=True):
    content: str


class ProjectRelease(TypedDict, total=False):
    commit_hash: str
    date: str
    full_hash: str
    message: str
    subproject_files_changed: int | None
    tag: str


class ProjectReleases(TypedDict, total=False):
    has_more: bool
    limit: int
    offset: int
    releases: list[ProjectRelease]
    resolved_ref_sha: str | None
    total: int | None


class ProjectSearchHit(TypedDict, total=True):
    description: str
    id: str
    last_modified: str
    last_synced_at: str | None
    name: str
    parent_repo: str | None
    sub_path: str | None
    thumbnail_url: str | None


class ProjectSearchResults(TypedDict, total=True):
    results: list[ProjectSearchHit]


class ProjectVariantCatalog(TypedDict, total=True):
    """The revision's variant catalog and its diagnostics."""
    commit: str | None
    diagnostics: list[VariantCatalogDiagnostic]
    projectId: str
    schema: str
    sourceRevisionKey: str
    variants: list[VariantCatalogEntry]


class PublishRequest(TypedDict, total=False):
    acknowledged_models: list[str]
    notes: str
    tag: str
    title: str


class ReattachCommentRequest(TypedDict, total=False):
    commit: str
    elementId: str | None
    location: CommentLocation
    relativePoint: list[float] | None


class RegenerateRequest(TypedDict, total=False):
    """What to rebuild: one commit (default ``HEAD``) or the whole project."""
    commit: str | None
    scope: str


class RegenerateThumbnailsRequest(TypedDict, total=True):
    project_ids: list[str]


class ReleaseQueuePage(TypedDict, total=True):
    items: list[CatalogComponent]
    page: int
    page_size: int
    pages: int
    summary: ReleaseQueueSummary
    total: int


class ReleaseQueueSummary(TypedDict, total=True):
    blocked: int
    done: int
    qa_review: int


class ReleaseStatusRequest(TypedDict, total=False):
    expected_manifest_hash: str
    release_status: str
    review_note: str
    self_approval_override_reason: str
    workflow_stage: str


class Representation(TypedDict, total=True):
    display_order: int
    footprint: RepresentationAsset | None
    id: str
    is_default: bool
    label: str
    provenance: dict[str, Any]
    revision_id: str
    source_internal_part_number: str
    symbol: RepresentationAsset | None


class RepresentationAsset(TypedDict, total=True):
    asset_type: str
    id: str
    name: str
    preview_id: str
    sha256: str
    target_library: str
    target_name: str


class RepresentationChange(TypedDict, total=True):
    after: ComparedRepresentation | None
    before: ComparedRepresentation | None
    key: str
    status: str


class ResolvedPaths(TypedDict, total=False):
    """Fully resolved absolute paths."""
    design_outputs_dir: str | None
    documentation_dir: str | None
    jobset_path: str | None
    manufacturing_outputs_dir: str | None
    pcb: str | None
    project_root: str
    readme_path: str | None
    schematic: str | None
    subsheets_dir: str | None
    thumbnail_dir: str | None


class ReviewDecisionRequest(TypedDict, total=False):
    acknowledged_models: list[str]
    note: str
    slot: str


class ReviewGroupOut(TypedDict, total=True):
    changeIds: list[str]
    id: str
    impact: str
    kind: str
    section: str
    summary: str
    title: str


class RevisionComparison(TypedDict, total=True):
    after: ComparedRevision
    assetChanges: list[AssetChange]
    before: ComparedRevision
    componentId: str
    metadataChanges: list[MetadataChange]
    representationChanges: list[RepresentationChange]
    summary: RevisionComparisonSummary


class RevisionComparisonSummary(TypedDict, total=True):
    assetChanges: int
    metadataChanges: int
    representationChanges: int


class RoleAssignmentResponse(TypedDict, total=False):
    email: str
    has_password: bool
    role: str
    source: str


class SSHKeyResponse(TypedDict, total=False):
    comment: str | None
    created_at: str | None
    exists: bool
    fingerprint: str | None
    key_type: str | None
    public_key: str | None


class SaveImportDraftsRequest(TypedDict, total=False):
    drafts: dict[str, dict[str, Any]]


class ScanRequest(TypedDict, total=False):
    commit: str | None
    force: bool


class SemanticIndexGenerateRequest(TypedDict, total=False):
    commit: str | None
    force: bool


class SemanticIndexGenerator(TypedDict, total=True):
    """The generator envelope the status route reports."""
    build: str
    cacheTag: str
    kicadMonkeyVersion: str
    name: str
    version: str


class SemanticIndexStatus(TypedDict, total=True):
    available: bool
    commit: str | None
    generator: SemanticIndexGenerator
    projectId: str
    schema: str
    sourceRevisionKey: str


class ServerFolderImportRequest(TypedDict, total=False):
    display_name: str
    root_name: str
    subpath: str


class SetPasswordRequest(TypedDict, total=False):
    must_change: bool
    password: str


class SetServiceClientEnabledRequest(TypedDict, total=True):
    enabled: bool


class SourceDefaultsRequest(TypedDict, total=False):
    board: str
    bom_preset: str
    schematic: str
    variant: str


class SubmitSetupRequest(TypedDict, total=True):
    analysis_id: str


class SubsheetFile(TypedDict, total=False):
    """One schematic below the root, with its text when the client asked for it."""
    content: str | None
    name: str
    url: str


class Subsheets(TypedDict, total=True):
    files: list[SubsheetFile]


class Supply(TypedDict, total=True):
    sources: list[SupplySource]


class SupplySource(TypedDict, total=True):
    display_name: str
    fetch_status: str
    fetched_at: str
    id: str
    kind: str
    mixed_fetch: bool
    mixed_freshness: bool
    mixed_status: bool
    mixed_units: bool
    stock: float
    stock_status: str
    uom: str


class ThreadPoolMetrics(TypedDict, total=True):
    borrowedTokens: int
    queueDepth: int
    totalTokens: int


class TokenExchangeResponse(TypedDict, total=True):
    access_token: str
    expires_in: int
    scope: str
    token_type: str


class UpdateCommentRequest(TypedDict, total=False):
    commentClass: str | None
    content: str | None
    contentFormat: str | None
    mentions: list[str] | None
    severity: str | None
    status: str | None


class UpdateComponentMetadataRequest(TypedDict, total=False):
    category: str | None
    change_summary: str
    datasheet_url: str | None
    description: str | None
    extra_fields: dict[str, str] | None
    manufacturer: str | None
    mass_g: str | None
    mpn: str | None
    package_name: str | None
    power_dissipation_w: str | None
    rate: str | None
    rqjc_c_w: str | None
    rqjc_top_c_w: str | None
    sap_code: str | None
    temp_max_c: str | None
    temp_min_c: str | None
    value: str | None
    vendor: str | None
    vendor_part_number: str | None


class UpdateConnectorRequest(TypedDict, total=False):
    baseUrl: str | None
    credentials: ConnectorCredentials | None
    displayName: str | None
    instanceKind: str | None


class UpdateFolderRequest(TypedDict, total=False):
    name: str | None
    parent_id: str | None


class UpdateProjectTrackerRequest(TypedDict, total=False):
    autoMinSeverity: str | None
    autoTaskClass: bool | None
    connectorId: str
    destination: DestinationBody
    labels: LabelsBody | None
    promoteMinRole: str | None


class UpdateReplyRequest(TypedDict, total=False):
    content: str
    contentFormat: str | None


class UpdateRepresentationRequest(TypedDict, total=False):
    change_summary: str
    display_order: int | None
    footprint_asset_id: str | None
    is_default: bool | None
    label: str | None
    symbol_asset_id: str | None


class UpsertRoleRequest(TypedDict, total=True):
    role: str


class UserSession(TypedDict, total=False):
    """User session data returned after successful login."""
    email: str
    must_change_password: bool
    name: str
    picture: str
    role: str


class ValidationAsset(TypedDict, total=True):
    asset_id: str
    asset_name: str
    asset_type: str
    latest_run: ValidationRun | None
    status: str
    target_library: str
    target_name: str


class ValidationError(TypedDict, total=False):
    ctx: dict[str, Any]
    input: Any
    loc: list[str | int]
    msg: str
    type: str


class ValidationFinding(TypedDict, total=True):
    created_at: str
    details: list[Any]
    id: str
    message: str
    object_name: str
    rule_code: str
    rule_url: str
    run_id: str
    severity: str


class ValidationRun(TypedDict, total=False):
    asset_id: str
    asset_type: str
    checker_type: str
    component_id: str
    created_at: str
    error_count: int
    exit_code: int | None
    findings: list[ValidationFinding] | None
    finished_at: str
    id: str
    inherited: bool
    inherited_from_revision_id: str
    reports: dict[str, str]
    revision_id: str
    status: str
    tool_version: str
    warning_count: int


class ValidationSummary(TypedDict, total=True):
    assets: list[ValidationAsset]
    enabled: bool
    error_count: int
    missing_required_assets: list[str]
    release_gate: str
    revision_id: str
    status: str
    warning_count: int


class VariantCatalogDiagnostic(TypedDict, total=False):
    """A catalog-builder diagnostic, in today's key order."""
    code: str | None
    detail: Any
    message: str | None
    path: str | None
    severity: str | None
    source: str | None


class VariantCatalogEntry(TypedDict, total=True):
    """One named design variant in the catalog order."""
    description: str | None
    name: str
    sources: list[str]


class ViewerSupportFile(TypedDict, total=True):
    content: str
    filename: str


class ViewerSupportFiles(TypedDict, total=True):
    files: list[ViewerSupportFile]


class WebGpu3dGenerateRequest(TypedDict, total=False):
    commit: str | None
    force: bool


class WorkflowRequest(TypedDict, total=False):
    author: str | None
    force: bool
    type: str


class WorkflowStageCount(TypedDict, total=True):
    count: int
    workflow_stage: str


class WorkflowSummary(TypedDict, total=True):
    stages: list[WorkflowStageCount]


class WorkspaceBootstrap(TypedDict, total=True):
    """Everything the workspace needs to paint before its first refresh."""
    folders: list[FolderNode]
    projects: list[Project]
    systems: list[dict[str, Any]]
    version: int


class app__api__catalog_admin_models__JobEvent(TypedDict, total=True):
    created_at: str
    details: dict[str, Any]
    event_type: str
    id: int
    percent: float | None
    stage: str


class app__api__jobs__JobEvent(TypedDict, total=True):
    created_at: str
    details: dict[str, Any]
    event_type: str
    id: int
    percent: float | None
    stage: str | None


class GeneratedClient:
    """One method per operation in the /api/v1 OpenAPI document."""

    def about(self) -> dict[str, str]:
        """About"""
        return self._request(
            "GET",
            "/api/v1/health/about",
        )

    def accept_project_import_proposal(self, proposal_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Accept Project Import Proposal"""
        return self._request(
            "POST",
            "/api/v1/catalog/import-proposals/{proposal_id}/accept",
            path_params={"proposal_id": proposal_id},
            body=body,
        )

    def acknowledge_project_tracker(self, project_id: str, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
        """Acknowledge Project Tracker"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/tracker/acknowledge",
            path_params={"project_id": project_id},
            body=body,
        )

    def add_comment_reaction(self, project_id: str, comment_id: str, reaction: str, *, replyId: str | None = None) -> Any:
        """Add Comment Reaction"""
        return self._request(
            "PUT",
            "/api/v1/projects/{project_id}/comments/{comment_id}/reactions/{reaction}",
            path_params={"project_id": project_id, "comment_id": comment_id, "reaction": reaction},
            query={"replyId": replyId},
        )

    def add_mate(self, component_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Add Mate"""
        return self._request(
            "POST",
            "/api/v1/catalog/components/{component_id}/mates-with",
            path_params={"component_id": component_id},
            body=body,
        )

    def add_reply(self, project_id: str, comment_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Add Reply"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/comments/{comment_id}/replies",
            path_params={"project_id": project_id, "comment_id": comment_id},
            body=body,
        )

    def admin_revoke_identity(self, connector_id: str, user_id: str) -> dict[str, Any]:
        """Admin Revoke Identity"""
        return self._request(
            "POST",
            "/api/v1/admin/trackers/connectors/{connector_id}/identities/{user_id}/revoke",
            path_params={"connector_id": connector_id, "user_id": user_id},
        )

    def agent_token(self) -> TokenExchangeResponse:
        """Token"""
        return self._request(
            "POST",
            "/api/v1/agent/token",
        )

    def analyze_repository(self, *, body: dict[str, Any] | None = None) -> Any:
        """Analyze Repository"""
        return self._request(
            "POST",
            "/api/v1/projects/analyze",
            body=body,
        )

    def append_design_compare_debug_log(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Append Design Compare Debug Log"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/design-compare/debug-log",
            path_params={"project_id": project_id},
            body=body,
        )

    def apply_metadata_batch(self, batch_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Apply Metadata Batch"""
        return self._request(
            "POST",
            "/api/v1/catalog/metadata/batches/{batch_id}/apply",
            path_params={"batch_id": batch_id},
            body=body,
        )

    def approve_build(self, project_id: str, build_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Approve Build"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/approvals",
            path_params={"project_id": project_id, "build_id": build_id},
            body=body,
        )

    def approve_metadata_batch_fields(self, batch_id: str) -> Any:
        """Approve Metadata Batch Fields"""
        return self._request(
            "POST",
            "/api/v1/catalog/metadata/batches/{batch_id}/approve-fields",
            path_params={"batch_id": batch_id},
        )

    def archive_metadata_field(self, field_id: str) -> Any:
        """Archive Metadata Field"""
        return self._request(
            "POST",
            "/api/v1/catalog/metadata/fields/{field_id}/archive",
            path_params={"field_id": field_id},
        )

    def begin_oauth(self, connector_id: str, *, returnTo: str = '/') -> OAuthBeginResponse:
        """Begin Oauth"""
        return self._request(
            "POST",
            "/api/v1/trackers/connectors/{connector_id}/oauth/begin",
            path_params={"connector_id": connector_id},
            query={"returnTo": returnTo},
        )

    def benchmark_metrics(self, *, since: str = '') -> BenchmarkMetrics:
        """Queue latency and job write-rate metrics"""
        return self._request(
            "GET",
            "/api/v1/jobs/benchmark-metrics",
            query={"since": since},
        )

    def browse_library_assets(self, *, asset_type: str, q: str = '', limit: int = 50) -> AssetBrowseResult:
        """Browse stored library assets"""
        return self._request(
            "GET",
            "/api/v1/catalog/assets/browse",
            query={"asset_type": asset_type, "q": q, "limit": limit},
        )

    def bulk_accept_project_import_proposals(self, session_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Bulk Accept Project Import Proposals"""
        return self._request(
            "POST",
            "/api/v1/catalog/import-sessions/{session_id}/proposals/bulk-accept",
            path_params={"session_id": session_id},
            body=body,
        )

    def cancel_job(self, job_id: str) -> Any:
        """Cancel Job"""
        return self._request(
            "POST",
            "/api/v1/jobs/{job_id}/cancel",
            path_params={"job_id": job_id},
        )

    def catalog_health(self, *, check_files: bool = False) -> CatalogHealth:
        """Report catalog health"""
        return self._request(
            "GET",
            "/api/v1/catalog/health",
            query={"check_files": check_files},
        )

    def change_own_password(self, *, body: dict[str, Any] | None = None) -> Any:
        """Change Own Password"""
        return self._request(
            "POST",
            "/api/v1/auth/password/change",
            body=body,
        )

    def check_git_access(self, *, body: dict[str, Any] | None = None) -> Any:
        """Check Git Access"""
        return self._request(
            "POST",
            "/api/v1/settings/git-access/check",
            body=body,
        )

    def check_release_tag(self, project_id: str, tag: str) -> Any:
        """Check Release Tag"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/tags/{tag}",
            path_params={"project_id": project_id, "tag": tag},
        )

    def clear_project_thumbnail(self, project_id: str) -> Any:
        """Clear Project Thumbnail"""
        return self._request(
            "DELETE",
            "/api/v1/projects/{project_id}/thumbnail",
            path_params={"project_id": project_id},
        )

    def compare_component_revisions(self, component_id: str, *, before: str, after: str) -> RevisionComparison:
        """Compare component revisions"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}/revisions/compare",
            path_params={"component_id": component_id},
            query={"before": before, "after": after},
        )

    def complete_folder_snapshot(self, snapshot_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Complete Folder Snapshot"""
        return self._request(
            "POST",
            "/api/v1/catalog/import-snapshots/folders/{snapshot_id}/complete",
            path_params={"snapshot_id": snapshot_id},
            body=body,
        )

    def components_by_category(self, *, category: str, page: int = 1, page_size: int = 50, include_total: bool = False) -> Any:
        """Components By Category"""
        return self._request(
            "GET",
            "/api/v1/remote-provider/components-by-category",
            query={"category": category, "page": page, "page_size": page_size, "include_total": include_total},
        )

    def config(self) -> dict[str, bool]:
        """Config"""
        return self._request(
            "GET",
            "/api/v1/agent/config",
        )

    def connector_health(self, connector_id: str) -> dict[str, Any]:
        """Connector Health"""
        return self._request(
            "GET",
            "/api/v1/admin/trackers/connectors/{connector_id}/health",
            path_params={"connector_id": connector_id},
        )

    def convert_models(self, component_id: str, *, revisionId: str | None = None) -> Any:
        """Convert Models"""
        return self._request(
            "POST",
            "/api/v1/catalog/components/{component_id}/models/convert",
            path_params={"component_id": component_id},
            query={"revisionId": revisionId},
        )

    def create_candidate(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Create Candidate"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/release-studio/candidates",
            path_params={"project_id": project_id},
            body=body,
        )

    def create_catalog_component(self, *, body: dict[str, Any] | None = None) -> Any:
        """Create Catalog Component"""
        return self._request(
            "POST",
            "/api/v1/catalog/components",
            body=body,
        )

    def create_comment(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Create Comment"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/comments",
            path_params={"project_id": project_id},
            body=body,
        )

    def create_comparison_comment(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Create Comparison Comment"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/comparison-comments",
            path_params={"project_id": project_id},
            body=body,
        )

    def create_component_representation(self, component_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Create Component Representation"""
        return self._request(
            "POST",
            "/api/v1/catalog/components/{component_id}/representations",
            path_params={"component_id": component_id},
            body=body,
        )

    def create_connector(self, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
        """Create Connector"""
        return self._request(
            "POST",
            "/api/v1/admin/trackers/connectors",
            body=body,
        )

    def create_folder(self, *, body: dict[str, Any] | None = None) -> Any:
        """Create Folder"""
        return self._request(
            "POST",
            "/api/v1/folders/",
            body=body,
        )

    def create_folder_snapshot(self, *, body: dict[str, Any] | None = None) -> Any:
        """Create Folder Snapshot"""
        return self._request(
            "POST",
            "/api/v1/catalog/import-snapshots/folders",
            body=body,
        )

    def create_metadata_batch(self, *, body: dict[str, Any] | None = None) -> Any:
        """Create Metadata Batch"""
        return self._request(
            "POST",
            "/api/v1/catalog/metadata/batches",
            body=body,
        )

    def create_metadata_field(self, *, body: dict[str, Any] | None = None) -> Any:
        """Create Metadata Field"""
        return self._request(
            "POST",
            "/api/v1/catalog/metadata/fields",
            body=body,
        )

    def create_personal_token(self, *, body: dict[str, Any] | None = None) -> CreatedPersonalToken:
        """Create Personal Token"""
        return self._request(
            "POST",
            "/api/v1/auth/tokens",
            body=body,
        )

    def create_project_import_session(self, *, body: dict[str, Any] | None = None) -> Any:
        """Create Project Import Session"""
        return self._request(
            "POST",
            "/api/v1/catalog/import-sessions/projects",
            body=body,
        )

    def create_server_folder_snapshot(self, *, body: dict[str, Any] | None = None) -> Any:
        """Create Server Folder Snapshot"""
        return self._request(
            "POST",
            "/api/v1/catalog/import-snapshots/folders/server",
            body=body,
        )

    def create_service_client(self, *, body: dict[str, Any] | None = None) -> Any:
        """Create Service Client"""
        return self._request(
            "POST",
            "/api/v1/admin/service-clients",
            body=body,
        )

    def delete_access_user(self, email: str) -> Any:
        """Delete Access User"""
        return self._request(
            "DELETE",
            "/api/v1/settings/access/users/{email}",
            path_params={"email": email},
        )

    def delete_catalog_component(self, component_id: str) -> Any:
        """Delete Catalog Component"""
        return self._request(
            "DELETE",
            "/api/v1/catalog/components/{component_id}",
            path_params={"component_id": component_id},
        )

    def delete_comment(self, project_id: str, comment_id: str) -> Any:
        """Delete Comment"""
        return self._request(
            "DELETE",
            "/api/v1/projects/{project_id}/comments/{comment_id}",
            path_params={"project_id": project_id, "comment_id": comment_id},
        )

    def delete_component_representation(self, component_id: str, representation_id: str) -> Any:
        """Delete Component Representation"""
        return self._request(
            "DELETE",
            "/api/v1/catalog/components/{component_id}/representations/{representation_id}",
            path_params={"component_id": component_id, "representation_id": representation_id},
        )

    def delete_connector(self, connector_id: str) -> dict[str, Any]:
        """Delete Connector"""
        return self._request(
            "DELETE",
            "/api/v1/admin/trackers/connectors/{connector_id}",
            path_params={"connector_id": connector_id},
        )

    def delete_design_compare(self, project_id: str, job_id: str) -> Any:
        """Delete Design Compare"""
        return self._request(
            "DELETE",
            "/api/v1/projects/{project_id}/design-compare/{job_id}",
            path_params={"project_id": project_id, "job_id": job_id},
        )

    def delete_folder(self, folder_id: str, *, cascade: bool = True) -> Any:
        """Delete Folder"""
        return self._request(
            "DELETE",
            "/api/v1/folders/{folder_id}",
            path_params={"folder_id": folder_id},
            query={"cascade": cascade},
        )

    def delete_project_endpoint(self, project_id: str) -> Any:
        """Delete Project Endpoint"""
        return self._request(
            "DELETE",
            "/api/v1/projects/{project_id}",
            path_params={"project_id": project_id},
        )

    def delete_project_import_session(self, session_id: str) -> None:
        """Delete Project Import Session"""
        return self._request(
            "DELETE",
            "/api/v1/catalog/import-sessions/{session_id}",
            path_params={"session_id": session_id},
        )

    def delete_reply(self, project_id: str, comment_id: str, reply_id: str) -> Any:
        """Delete Reply"""
        return self._request(
            "DELETE",
            "/api/v1/projects/{project_id}/comments/{comment_id}/replies/{reply_id}",
            path_params={"project_id": project_id, "comment_id": comment_id, "reply_id": reply_id},
        )

    def delete_service_client(self, client_id: str) -> Any:
        """Delete Service Client"""
        return self._request(
            "DELETE",
            "/api/v1/admin/service-clients/{client_id}",
            path_params={"client_id": client_id},
        )

    def delete_setup(self, project_id: str, setup_id: str) -> None:
        """Delete Setup"""
        return self._request(
            "DELETE",
            "/api/v1/projects/{project_id}/sim/a0/setups/{setup_id}",
            path_params={"project_id": project_id, "setup_id": setup_id},
        )

    def delete_user_password(self, email: str) -> Any:
        """Delete User Password"""
        return self._request(
            "DELETE",
            "/api/v1/settings/access/users/{email}/password",
            path_params={"email": email},
        )

    def design_compare_result(self, project_id: str, job_id: str) -> Any:
        """Design Compare Result"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/design-compare/{job_id}",
            path_params={"project_id": project_id, "job_id": job_id},
        )

    def design_compare_sidecar(self, project_id: str, job_id: str, digest: str) -> Any:
        """Design Compare Sidecar"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/design-compare/{job_id}/sidecars/{digest}",
            path_params={"project_id": project_id, "job_id": job_id, "digest": digest},
        )

    def detach_component_asset(self, component_id: str, asset_type: str) -> Any:
        """Detach Component Asset"""
        return self._request(
            "DELETE",
            "/api/v1/catalog/components/{component_id}/assets/{asset_type}",
            path_params={"component_id": component_id, "asset_type": asset_type},
        )

    def detach_component_asset_by_id(self, component_id: str, asset_id: str) -> Any:
        """Detach Component Asset By Id"""
        return self._request(
            "DELETE",
            "/api/v1/catalog/components/{component_id}/assets/id/{asset_id}",
            path_params={"component_id": component_id, "asset_id": asset_id},
        )

    def detect_project_paths(self, project_id: str) -> Any:
        """Detect Project Paths"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/detect-paths",
            path_params={"project_id": project_id},
        )

    def discover_folder_snapshot(self, snapshot_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Discover Folder Snapshot"""
        return self._request(
            "POST",
            "/api/v1/catalog/import-snapshots/folders/{snapshot_id}/discover",
            path_params={"snapshot_id": snapshot_id},
            body=body,
        )

    def download_asset(self, asset_id: str, *, rev: str, representation: str = '', exp: int, sig: str) -> Any:
        """Download Asset"""
        return self._request(
            "GET",
            "/api/v1/remote-provider/assets/{asset_id}",
            path_params={"asset_id": asset_id},
            query={"rev": rev, "representation": representation, "exp": exp, "sig": sig},
        )

    def download_build_evidence(self, project_id: str, build_id: str) -> Any:
        """Download Build Evidence"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/build-evidence",
            path_params={"project_id": project_id, "build_id": build_id},
        )

    def download_build_log(self, project_id: str, build_id: str, step_id: str) -> Any:
        """Download Build Log"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/logs/{step_id}",
            path_params={"project_id": project_id, "build_id": build_id, "step_id": step_id},
        )

    def download_build_vendor_pack(self, project_id: str, build_id: str, vendor_id: str) -> Any:
        """Download Build Vendor Pack"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/vendor-packs/{vendor_id}",
            path_params={"project_id": project_id, "build_id": build_id, "vendor_id": vendor_id},
        )

    def download_dossier(self, project_id: str, build_id: str) -> Any:
        """Download Dossier"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/dossier",
            path_params={"project_id": project_id, "build_id": build_id},
        )

    def download_file(self, project_id: str, *, path: str, type: str = 'design', inline: bool = False, commit: str | None = None) -> Any:
        """Download one file from the project's output folders"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/download",
            path_params={"project_id": project_id},
            query={"path": path, "type": type, "inline": inline, "commit": commit},
        )

    def download_member(self, project_id: str, build_id: str, member_path: str, *, disposition: str = 'inline') -> Any:
        """Download Member"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/members/{member_path}",
            path_params={"project_id": project_id, "build_id": build_id, "member_path": member_path},
            query={"disposition": disposition},
        )

    def download_preview(self, preview_id: str) -> Any:
        """Download Preview"""
        return self._request(
            "GET",
            "/api/v1/remote-provider/previews/{preview_id}",
            path_params={"preview_id": preview_id},
        )

    def draft_setup(self, project_id: str, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
        """Draft Setup"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/sim/a0/setups",
            path_params={"project_id": project_id},
            body=body,
        )

    def export_import_proposals_csv(self, session_id: str) -> Any:
        """Export import proposals as CSV"""
        return self._request(
            "GET",
            "/api/v1/catalog/import-sessions/{session_id}/proposals.csv",
            path_params={"session_id": session_id},
        )

    def export_inventory_csv(self) -> Any:
        """Export the component inventory as CSV"""
        return self._request(
            "GET",
            "/api/v1/catalog/inventory/export.csv",
        )

    def export_kicad_dbl_bundle(self) -> Any:
        """Export Kicad Dbl Bundle"""
        return self._request(
            "POST",
            "/api/v1/catalog/exports/kicad-dbl",
        )

    def export_metadata_csv(self, *, field: list[str] | None = None) -> Any:
        """Export component metadata as CSV"""
        return self._request(
            "GET",
            "/api/v1/catalog/metadata/export.csv",
            query={"field": field},
        )

    def forget_git_host_key(self, host: str) -> Any:
        """Forget Git Host Key"""
        return self._request(
            "DELETE",
            "/api/v1/settings/git-access/host-keys/{host}",
            path_params={"host": host},
        )

    def generate_missing_previews(self) -> Any:
        """Generate Missing Previews"""
        return self._request(
            "POST",
            "/api/v1/catalog/previews/generate-missing",
        )

    def generate_semantic_index(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Generate Semantic Index"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/semantic-index/generate",
            path_params={"project_id": project_id},
            body=body,
        )

    def generate_ssh_key(self, *, body: dict[str, Any] | None = None) -> Any:
        """Generate Ssh Key"""
        return self._request(
            "POST",
            "/api/v1/settings/ssh-key/generate",
            body=body,
        )

    def generate_webgpu_3d(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Generate Webgpu 3D"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/webgpu-3d/generate",
            path_params={"project_id": project_id},
            body=body,
        )

    def get_asset_content(self, asset_id: str) -> Any:
        """Get Asset Content"""
        return self._request(
            "GET",
            "/api/v1/remote-provider/assets/{asset_id}/content",
            path_params={"asset_id": asset_id},
        )

    def get_auth_config(self) -> AuthConfig:
        """Get Auth Config"""
        return self._request(
            "GET",
            "/api/v1/auth/config",
        )

    def get_build(self, project_id: str, build_id: str) -> Any:
        """Get Build"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}",
            path_params={"project_id": project_id, "build_id": build_id},
        )

    def get_build_placement(self, project_id: str, build_id: str) -> Any:
        """Get Build Placement"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/placement",
            path_params={"project_id": project_id, "build_id": build_id},
        )

    def get_candidate(self, project_id: str, candidate_id: str) -> Any:
        """Get Candidate"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/candidates/{candidate_id}",
            path_params={"project_id": project_id, "candidate_id": candidate_id},
        )

    def get_catalog_asset_content(self, asset_id: str) -> Any:
        """Read a catalog asset file"""
        return self._request(
            "GET",
            "/api/v1/catalog/assets/{asset_id}/content",
            path_params={"asset_id": asset_id},
        )

    def get_catalog_component(self, component_id: str, *, representation: str = '') -> CatalogComponent:
        """Read a catalog component"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}",
            path_params={"component_id": component_id},
            query={"representation": representation},
        )

    def get_catalog_job(self, job_id: str) -> CatalogJobWithEvents:
        """Read a catalog job"""
        return self._request(
            "GET",
            "/api/v1/catalog/jobs/{job_id}",
            path_params={"job_id": job_id},
        )

    def get_catalog_preview(self, preview_id: str) -> Any:
        """Read a catalog preview"""
        return self._request(
            "GET",
            "/api/v1/catalog/previews/{preview_id}",
            path_params={"preview_id": preview_id},
        )

    def get_catalog_usage(self, project_id: str, *, commit: str | None = None) -> dict[str, Any]:
        """Get Catalog Usage"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/catalog-usage",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_comment_attachment(self, project_id: str, attachment_id: str) -> Any:
        """Get Comment Attachment"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/comment-attachments/{attachment_id}",
            path_params={"project_id": project_id, "attachment_id": attachment_id},
        )

    def get_comment_changes(self, project_id: str, *, after: int = 0) -> Any:
        """Get Comment Changes"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/comments/changes",
            path_params={"project_id": project_id},
            query={"after": after},
        )

    def get_comment_history(self, project_id: str, comment_id: str) -> Any:
        """Get Comment History"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/comments/{comment_id}/history",
            path_params={"project_id": project_id, "comment_id": comment_id},
        )

    def get_comment_thread(self, project_id: str, comment_id: str, *, revision: str | None = None) -> Any:
        """Get Comment Thread"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/comments/{comment_id}/thread",
            path_params={"project_id": project_id, "comment_id": comment_id},
            query={"revision": revision},
        )

    def get_comments(self, project_id: str, *, revision: str | None = None) -> Any:
        """Get Comments"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/comments",
            path_params={"project_id": project_id},
            query={"revision": revision},
        )

    def get_comparison_comments(self, project_id: str, *, base: str, compare: str, domain: str | None = None) -> Any:
        """Get Comparison Comments"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/comparison-comments",
            path_params={"project_id": project_id},
            query={"base": base, "compare": compare, "domain": domain},
        )

    def get_comparison_discussion_report(self, project_id: str, *, base: str, compare: str, domain: str | None = None) -> Any:
        """Get Comparison Discussion Report"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/comparison-comments/report",
            path_params={"project_id": project_id},
            query={"base": base, "compare": compare, "domain": domain},
        )

    def get_comparison_review(self, project_id: str, job_id: str, *, domain: str) -> ComparisonReviewOut:
        """Get Comparison Review"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/design-compare/{job_id}/review",
            path_params={"project_id": project_id, "job_id": job_id},
            query={"domain": domain},
        )

    def get_component(self, component_id: str, *, representation: str = '', revision: str = '') -> Any:
        """Get Component"""
        return self._request(
            "GET",
            "/api/v1/remote-provider/components/{component_id}",
            path_params={"component_id": component_id},
            query={"representation": representation, "revision": revision},
        )

    def get_component_revision(self, component_id: str, revision_id: str) -> CatalogComponent:
        """Read a component revision"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}/revisions/{revision_id}",
            path_params={"component_id": component_id, "revision_id": revision_id},
        )

    def get_component_validation(self, component_id: str) -> ComponentValidation:
        """Read a component's validation"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}/validation",
            path_params={"component_id": component_id},
        )

    def get_connector(self, connector_id: str) -> dict[str, Any]:
        """Get Connector"""
        return self._request(
            "GET",
            "/api/v1/admin/trackers/connectors/{connector_id}",
            path_params={"connector_id": connector_id},
        )

    def get_current_session_user(self) -> UserSession:
        """Get Current Session User"""
        return self._request(
            "GET",
            "/api/v1/auth/me",
        )

    def get_design_bundles(self, project_id: str) -> DesignBundleStatus:
        """The project's design-bundle counts, aliases and stored size"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/design-bundles",
            path_params={"project_id": project_id},
        )

    def get_design_component(self, project_id: str, ref: str, *, revision: str | None = None) -> DesignComponentOut:
        """Get Design Component"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/design/components/{ref}",
            path_params={"project_id": project_id, "ref": ref},
            query={"revision": revision},
        )

    def get_design_net(self, project_id: str, name: str, *, revision: str | None = None) -> DesignNetOut:
        """Get Design Net"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/design/nets/{name}",
            path_params={"project_id": project_id, "name": name},
            query={"revision": revision},
        )

    def get_doc_file_content(self, project_id: str, *, path: str, commit: str | None = None) -> DocFileContent:
        """Read one documentation file"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/docs/content",
            path_params={"project_id": project_id},
            query={"path": path, "commit": commit},
        )

    def get_docs_files(self, project_id: str, *, commit: str | None = None) -> list[FileItem]:
        """List the documentation folder"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/docs",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_fabrication_layer(self, project_id: str, build_id: str, layer_id: str) -> Any:
        """Get Fabrication Layer"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/fabrication-view/layers/{layer_id}.svg",
            path_params={"project_id": project_id, "build_id": build_id, "layer_id": layer_id},
        )

    def get_fabrication_view(self, project_id: str, build_id: str) -> Any:
        """Get Fabrication View"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/fabrication-view",
            path_params={"project_id": project_id, "build_id": build_id},
        )

    def get_folder_contents(self, *, folder_id: str | None = None) -> FolderContents:
        """Folders and projects directly inside one folder"""
        return self._request(
            "GET",
            "/api/v1/folders/contents",
            query={"folder_id": folder_id},
        )

    def get_folder_tree(self) -> list[FolderNode]:
        """The folder tree the workspace renders"""
        return self._request(
            "GET",
            "/api/v1/folders/tree",
        )

    def get_git_access(self) -> Any:
        """Get Git Access"""
        return self._request(
            "GET",
            "/api/v1/settings/git-access",
        )

    def get_inline_component(self, component_id: str, *, representation: str = '', revision: str = '') -> Any:
        """Get Inline Component"""
        return self._request(
            "GET",
            "/api/v1/remote-provider/components/{component_id}/inline",
            path_params={"component_id": component_id},
            query={"representation": representation, "revision": revision},
        )

    def get_job(self, job_id: str) -> JobStatus:
        """One job's status"""
        return self._request(
            "GET",
            "/api/v1/jobs/{job_id}",
            path_params={"job_id": job_id},
        )

    def get_job_artifact(self, job_id: str) -> Any:
        """Download a completed job's artifact"""
        return self._request(
            "GET",
            "/api/v1/jobs/{job_id}/artifact",
            path_params={"job_id": job_id},
        )

    def get_job_events(self, job_id: str, *, after: int = 0, limit: int = 200) -> JobEvents:
        """A job's progress events after a given id"""
        return self._request(
            "GET",
            "/api/v1/jobs/{job_id}/events",
            path_params={"job_id": job_id},
            query={"after": after, "limit": limit},
        )

    def get_job_logs(self, job_id: str, *, tail: int = 200) -> JobLogs:
        """The tail of a job's log"""
        return self._request(
            "GET",
            "/api/v1/jobs/{job_id}/logs",
            path_params={"job_id": job_id},
            query={"tail": tail},
        )

    def get_metadata_batch(self, batch_id: str) -> MetadataBatch:
        """Read a metadata batch"""
        return self._request(
            "GET",
            "/api/v1/catalog/metadata/batches/{batch_id}",
            path_params={"batch_id": batch_id},
        )

    def get_metadata_grid_preferences(self) -> MetadataGridPreferences:
        """Read metadata grid preferences"""
        return self._request(
            "GET",
            "/api/v1/catalog/metadata/grid-preferences",
        )

    def get_metadata_job(self, job_id: str) -> CatalogJob:
        """Read a metadata job"""
        return self._request(
            "GET",
            "/api/v1/catalog/metadata/jobs/{job_id}",
            path_params={"job_id": job_id},
        )

    def get_monorepo_structure(self, repo_name: str, *, subpath: str = '') -> MonorepoStructure:
        """Folders and projects under one monorepo path"""
        return self._request(
            "GET",
            "/api/v1/projects/monorepos/{repo_name}/structure",
            path_params={"repo_name": repo_name},
            query={"subpath": subpath},
        )

    def get_oauth_callback_url(self) -> dict[str, str]:
        """Get Oauth Callback Url"""
        return self._request(
            "GET",
            "/api/v1/admin/trackers/oauth-callback-url",
        )

    def get_output_fabrication_layer(self, project_id: str, layer_id: str, *, type: str = 'manufacturing', folder: str = '', commit: str | None = None) -> Any:
        """Get Output Fabrication Layer"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/fabrication-view/layers/{layer_id}.svg",
            path_params={"project_id": project_id, "layer_id": layer_id},
            query={"type": type, "folder": folder, "commit": commit},
        )

    def get_output_fabrication_view(self, project_id: str, *, type: str = 'manufacturing', folder: str = '', commit: str | None = None) -> Any:
        """Get Output Fabrication View"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/fabrication-view",
            path_params={"project_id": project_id},
            query={"type": type, "folder": folder, "commit": commit},
        )

    def get_output_placement(self, project_id: str, *, type: str = 'manufacturing', folder: str = '', commit: str | None = None) -> PlacementView:
        """Placed parts of a folder's position files, checked against its BOM"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/placement",
            path_params={"project_id": project_id},
            query={"type": type, "folder": folder, "commit": commit},
        )

    def get_part_manifest(self, part_id: str, *, representation: str = '', revision: str = '') -> Any:
        """Get Part Manifest"""
        return self._request(
            "GET",
            "/api/v1/remote-provider/parts/{part_id}",
            path_params={"part_id": part_id},
            query={"representation": representation, "revision": revision},
        )

    def get_preview_job(self, job_id: str) -> CatalogJob:
        """Read a preview generation job"""
        return self._request(
            "GET",
            "/api/v1/catalog/previews/jobs/{job_id}",
            path_params={"job_id": job_id},
        )

    def get_project_3d_model(self, project_id: str, *, commit: str | None = None) -> Any:
        """The project's committed 3D model"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/3d-model",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_project_asset(self, project_id: str, asset_path: str, *, commit: str | None = None) -> Any:
        """Serve an asset from the project checkout"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/asset/{asset_path}",
            path_params={"project_id": project_id, "asset_path": asset_path},
            query={"commit": commit},
        )

    def get_project_bom(self, project_id: str, *, commit: str | None = None, assembly: str = 'all') -> BomOut:
        """Get Project Bom"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/bom",
            path_params={"project_id": project_id},
            query={"commit": commit, "assembly": assembly},
        )

    def get_project_branches(self, project_id: str) -> ProjectBranches:
        """Branches that can be viewed for the project"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/branches",
            path_params={"project_id": project_id},
        )

    def get_project_comments_source_urls(self, project_id: str, *, base_url: str | None = None) -> Any:
        """Get Project Comments Source Urls"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/comments/source-urls",
            path_params={"project_id": project_id},
            query={"base_url": base_url},
        )

    def get_project_commit_distance(self, project_id: str, *, commit: str, ref: str | None = None) -> CommitDistance:
        """How many commits behind a revision is"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/commits/distance",
            path_params={"project_id": project_id},
            query={"commit": commit, "ref": ref},
        )

    def get_project_commit_file(self, project_id: str, commit_hash: str, *, path: str) -> Any:
        """Serve one file from a commit"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/commits/{commit_hash}/file",
            path_params={"project_id": project_id, "commit_hash": commit_hash},
            query={"path": path},
        )

    def get_project_commit_summary(self, project_id: str, commit_hash: str) -> ProjectCommitSummary:
        """Files changed in one commit"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/commits/{commit_hash}/summary",
            path_params={"project_id": project_id, "commit_hash": commit_hash},
        )

    def get_project_commits(self, project_id: str, *, limit: int = 50, offset: int = 0, ref: str | None = None, include_total: bool = True) -> ProjectCommits:
        """Paginated commit history of the project"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/commits",
            path_params={"project_id": project_id},
            query={"limit": limit, "offset": offset, "ref": ref, "include_total": include_total},
        )

    def get_project_config(self, project_id: str) -> ProjectPathConfig:
        """The project's path configuration and resolved paths"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/config",
            path_params={"project_id": project_id},
        )

    def get_project_description(self, project_id: str) -> ProjectDescription:
        """The project description"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/description",
            path_params={"project_id": project_id},
        )

    def get_project_detail(self, project_id: str) -> Project:
        """Get Project Detail"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}",
            path_params={"project_id": project_id},
        )

    def get_project_files(self, project_id: str, *, type: str = 'design', commit: str | None = None) -> list[FileItem]:
        """Get Project Files"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/files",
            path_params={"project_id": project_id},
            query={"type": type, "commit": commit},
        )

    def get_project_ibom(self, project_id: str, *, commit: str | None = None) -> Any:
        """The project's interactive BOM"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/ibom",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_project_import_session(self, session_id: str) -> ImportSession:
        """Read an import session"""
        return self._request(
            "GET",
            "/api/v1/catalog/import-sessions/{session_id}",
            path_params={"session_id": session_id},
        )

    def get_project_name(self, project_id: str) -> ProjectName:
        """The project's display name and fallback name"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/name",
            path_params={"project_id": project_id},
        )

    def get_project_overview(self, project_id: str, *, commit: str | None = None) -> ProjectOverview:
        """Project details and README in one payload"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/overview",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_project_pcb(self, project_id: str, *, commit: str | None = None) -> Any:
        """The revision's board file"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/pcb",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_project_properties(self, project_id: str) -> ProjectPropertiesResponse:
        """Get Project Properties"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/properties",
            path_params={"project_id": project_id},
        )

    def get_project_readme(self, project_id: str, *, commit: str | None = None) -> ProjectReadme:
        """The project README text"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/readme",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_project_releases(self, project_id: str, *, ref: str | None = None, limit: int = 9, offset: int = 0, include_total: bool = True) -> ProjectReleases:
        """Paginated Git tags of the project's repository"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/releases",
            path_params={"project_id": project_id},
            query={"ref": ref, "limit": limit, "offset": offset, "include_total": include_total},
        )

    def get_project_schematic(self, project_id: str, *, commit: str | None = None) -> Any:
        """The revision's root schematic"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/schematic",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_project_subsheets(self, project_id: str, *, commit: str | None = None, include: str | None = None) -> Subsheets:
        """The schematics below the root, optionally with their text"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/schematic/subsheets",
            path_params={"project_id": project_id},
            query={"commit": commit, "include": include},
        )

    def get_project_thumbnail(self, project_id: str) -> Any:
        """The project's thumbnail image"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/thumbnail",
            path_params={"project_id": project_id},
        )

    def get_project_thumbnail_version(self, project_id: str, thumbnail_digest: str) -> Any:
        """One immutable version of the project's thumbnail"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/thumbnail/{thumbnail_digest}",
            path_params={"project_id": project_id, "thumbnail_digest": thumbnail_digest},
        )

    def get_project_tracker(self, project_id: str) -> dict[str, Any]:
        """Get Project Tracker"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/tracker",
            path_params={"project_id": project_id},
        )

    def get_project_variants(self, project_id: str, *, commit: str | None = None) -> ProjectVariantCatalog:
        """The revision's ordered design-variant catalog"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/variants",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_project_viewer_support_files(self, project_id: str, *, commit: str | None = None) -> ViewerSupportFiles:
        """The project file and drawing sheet the viewer needs"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/viewer/support-files",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_reply_history(self, project_id: str, comment_id: str, reply_id: str) -> Any:
        """Get Reply History"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/comments/{comment_id}/replies/{reply_id}/history",
            path_params={"project_id": project_id, "comment_id": comment_id, "reply_id": reply_id},
        )

    def get_semantic_index_identity(self, project_id: str, *, commit: str | None = None) -> dict[str, Any]:
        """The revision's semantic-index document"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/semantic-index/identity",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_semantic_index_status(self, project_id: str, *, commit: str | None = None) -> SemanticIndexStatus:
        """Whether the revision's semantic index is ready"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/semantic-index/status",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_signed_comment_attachment(self, project_id: str, attachment_id: str, *, exp: int = 0, sig: str = '') -> Any:
        """Open one comment attachment through its signed link"""
        return self._request(
            "GET",
            "/api/v1/public/comment-attachments/{project_id}/{attachment_id}",
            path_params={"project_id": project_id, "attachment_id": attachment_id},
            query={"exp": exp, "sig": sig},
        )

    def get_source(self, project_id: str, *, commit_sha: str) -> Any:
        """Get Source"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/source",
            path_params={"project_id": project_id},
            query={"commit_sha": commit_sha},
        )

    def get_ssh_key(self) -> SSHKeyResponse:
        """Get Ssh Key"""
        return self._request(
            "GET",
            "/api/v1/settings/ssh-key",
        )

    def get_validation_job(self, job_id: str) -> CatalogJob:
        """Read a validation job"""
        return self._request(
            "GET",
            "/api/v1/catalog/validation/jobs/{job_id}",
            path_params={"job_id": job_id},
        )

    def get_validation_report(self, run_id: str, report_name: str) -> Any:
        """Read a validation report"""
        return self._request(
            "GET",
            "/api/v1/catalog/validation/runs/{run_id}/{report_name}",
            path_params={"run_id": run_id, "report_name": report_name},
        )

    def get_validation_run(self, run_id: str) -> ValidationRun:
        """Read a validation run"""
        return self._request(
            "GET",
            "/api/v1/catalog/validation/runs/{run_id}",
            path_params={"run_id": run_id},
        )

    def get_webgpu_3d_analytic(self, project_id: str, *, commit: str | None = None) -> Any:
        """Get Webgpu 3D Analytic"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/webgpu-3d/analytic",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_webgpu_3d_asset(self, project_id: str, source_revision_key: str, generator_build: str, asset_path: str) -> Any:
        """Get Webgpu 3D Asset"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/webgpu-3d/assets/{source_revision_key}/{generator_build}/{asset_path}",
            path_params={"project_id": project_id, "source_revision_key": source_revision_key, "generator_build": generator_build, "asset_path": asset_path},
        )

    def get_webgpu_3d_status(self, project_id: str, *, commit: str | None = None) -> Any:
        """Get Webgpu 3D Status"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/webgpu-3d/status",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def get_workspace_bootstrap(self) -> WorkspaceBootstrap:
        """Projects, folders and version for the workspace"""
        return self._request(
            "GET",
            "/api/v1/workspace/bootstrap",
        )

    def impedance_template(self, project_id: str) -> Any:
        """Impedance Template"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/impedance-template.csv",
            path_params={"project_id": project_id},
        )

    def import_access_help(self, *, body: dict[str, Any] | None = None) -> Any:
        """Import Access Help"""
        return self._request(
            "POST",
            "/api/v1/projects/access-help",
            body=body,
        )

    def import_auxiliary_asset(self, component_id: str, asset_type: str) -> Any:
        """Import Auxiliary Asset"""
        return self._request(
            "POST",
            "/api/v1/catalog/components/{component_id}/assets/{asset_type}",
            path_params={"component_id": component_id, "asset_type": asset_type},
        )

    def import_footprint(self, component_id: str) -> Any:
        """Import Footprint"""
        return self._request(
            "POST",
            "/api/v1/catalog/components/{component_id}/footprint-import",
            path_params={"component_id": component_id},
        )

    def import_inventory_csv(self) -> Any:
        """Import Inventory Csv"""
        return self._request(
            "POST",
            "/api/v1/catalog/inventory/sync-csv",
        )

    def import_project(self, *, body: dict[str, Any] | None = None) -> Any:
        """Import Project"""
        return self._request(
            "POST",
            "/api/v1/projects/import",
            body=body,
        )

    def import_proposals_csv(self, session_id: str) -> Any:
        """Import Proposals Csv"""
        return self._request(
            "POST",
            "/api/v1/catalog/import-sessions/{session_id}/proposals.csv",
            path_params={"session_id": session_id},
        )

    def import_symbol_library(self, component_id: str) -> Any:
        """Import Symbol Library"""
        return self._request(
            "POST",
            "/api/v1/catalog/components/{component_id}/symbol-import",
            path_params={"component_id": component_id},
        )

    def infer_power_tree(self, project_id: str, *, commit: str | None = None) -> dict[str, Any]:
        """Infer Power Tree"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/sim/a0/power-tree",
            path_params={"project_id": project_id},
            query={"commit": commit},
        )

    def link_library_asset(self, component_id: str, asset_type: str, *, body: dict[str, Any] | None = None) -> Any:
        """Link Library Asset"""
        return self._request(
            "POST",
            "/api/v1/catalog/components/{component_id}/assets/{asset_type}/link",
            path_params={"component_id": component_id, "asset_type": asset_type},
            body=body,
        )

    def list_access_users(self) -> list[RoleAssignmentResponse]:
        """List Access Users"""
        return self._request(
            "GET",
            "/api/v1/settings/access/users",
        )

    def list_all_personal_tokens(self) -> list[PersonalTokenView]:
        """List All Personal Tokens"""
        return self._request(
            "GET",
            "/api/v1/auth/tokens/all",
        )

    def list_build_logs(self, project_id: str, build_id: str) -> Any:
        """List Build Logs"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/logs",
            path_params={"project_id": project_id, "build_id": build_id},
        )

    def list_candidates(self, project_id: str, *, config_key: str | None = None) -> Any:
        """List Candidates"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/candidates",
            path_params={"project_id": project_id},
            query={"config_key": config_key},
        )

    def list_catalog_categories(self) -> CatalogCategories:
        """List released catalog categories"""
        return self._request(
            "GET",
            "/api/v1/catalog/categories",
        )

    def list_catalog_components(self, *, q: str = '', source: str | None = None, availability_state: str | None = None, workflow_stage: str | None = None, validation_status: str | None = None, category: str | None = None, include_inactive: bool = False, page: int = 1, page_size: int = 50, sort_by: str = '', sort_dir: str = 'asc', lightweight: bool = False) -> CatalogComponentPage:
        """List catalog components"""
        return self._request(
            "GET",
            "/api/v1/catalog/components",
            query={"q": q, "source": source, "availability_state": availability_state, "workflow_stage": workflow_stage, "validation_status": validation_status, "category": category, "include_inactive": include_inactive, "page": page, "page_size": page_size, "sort_by": sort_by, "sort_dir": sort_dir, "lightweight": lightweight},
        )

    def list_categories(self) -> Any:
        """List Categories"""
        return self._request(
            "GET",
            "/api/v1/remote-provider/categories",
        )

    def list_component_audit(self, component_id: str) -> AuditEventPage:
        """List component audit events"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}/audit",
            path_params={"component_id": component_id},
        )

    def list_component_releases(self, component_id: str) -> ComponentReleaseRecordPage:
        """List component release records"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}/releases",
            path_params={"component_id": component_id},
        )

    def list_component_reviews(self, component_id: str) -> ComponentReviewDecisionPage:
        """List component review decisions"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}/reviews",
            path_params={"component_id": component_id},
        )

    def list_component_revisions(self, component_id: str) -> ComponentRevisionPage:
        """List component revisions"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}/revisions",
            path_params={"component_id": component_id},
        )

    def list_component_usage(self, component_id: str, *, mode: str = 'current') -> ComponentUsagePage:
        """List where a component is used"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}/usage",
            path_params={"component_id": component_id},
            query={"mode": mode},
        )

    def list_connector_repositories(self, connector_id: str) -> list[dict[str, Any]]:
        """List Connector Repositories"""
        return self._request(
            "GET",
            "/api/v1/admin/trackers/connectors/{connector_id}/repositories",
            path_params={"connector_id": connector_id},
        )

    def list_connectors(self) -> list[dict[str, Any]]:
        """List Connectors"""
        return self._request(
            "GET",
            "/api/v1/admin/trackers/connectors",
        )

    def list_document_sheets(self, project_id: str, build_id: str) -> Any:
        """List Document Sheets"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/sheets",
            path_params={"project_id": project_id, "build_id": build_id},
        )

    def list_engines(self) -> list[dict[str, Any]]:
        """List Engines"""
        return self._request(
            "GET",
            "/api/v1/sim/a0/engines",
        )

    def list_events(self, *, after: int = 0, topic: list[str] | None = None, limit: int = 200) -> EventPage:
        """List events after a cursor"""
        return self._request(
            "GET",
            "/api/v1/events",
            query={"after": after, "topic": topic, "limit": limit},
        )

    def list_folder_import_roots(self) -> FolderImportRootPage:
        """List server import roots"""
        return self._request(
            "GET",
            "/api/v1/catalog/import-sources/folder-roots",
        )

    def list_identities(self) -> list[dict[str, Any]]:
        """List Identities"""
        return self._request(
            "GET",
            "/api/v1/trackers/identities",
        )

    def list_linkable_connectors(self) -> list[dict[str, Any]]:
        """List Linkable Connectors"""
        return self._request(
            "GET",
            "/api/v1/trackers/linkable-connectors",
        )

    def list_mates_with(self, component_id: str) -> MatePage:
        """List the parts this part mates with"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}/mates-with",
            path_params={"component_id": component_id},
        )

    def list_mention_candidates(self, project_id: str) -> list[MentionCandidate]:
        """List Mention Candidates"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/comments/mention-candidates",
            path_params={"project_id": project_id},
        )

    def list_metadata_fields(self, *, include_archived: bool = False) -> MetadataFieldPage:
        """List metadata fields"""
        return self._request(
            "GET",
            "/api/v1/catalog/metadata/fields",
            query={"include_archived": include_archived},
        )

    def list_models(self, component_id: str, *, revisionId: str | None = None) -> ModelPage:
        """List a part's STEP models"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}/models",
            path_params={"component_id": component_id},
            query={"revisionId": revisionId},
        )

    def list_monorepos(self) -> list[Monorepo]:
        """List Monorepos"""
        return self._request(
            "GET",
            "/api/v1/projects/monorepos",
        )

    def list_my_sessions(self) -> list[ActiveSession]:
        """List My Sessions"""
        return self._request(
            "GET",
            "/api/v1/auth/sessions",
        )

    def list_personal_tokens(self) -> list[PersonalTokenView]:
        """List Personal Tokens"""
        return self._request(
            "GET",
            "/api/v1/auth/tokens",
        )

    def list_project_import_proposals(self, session_id: str) -> ImportProposalPage:
        """List import proposals"""
        return self._request(
            "GET",
            "/api/v1/catalog/import-sessions/{session_id}/proposals",
            path_params={"session_id": session_id},
        )

    def list_project_import_sessions(self) -> ImportSessionPage:
        """List import sessions"""
        return self._request(
            "GET",
            "/api/v1/catalog/import-sessions",
        )

    def list_projects(self) -> list[Project]:
        """List Projects"""
        return self._request(
            "GET",
            "/api/v1/projects/",
        )

    def list_runs(self, project_id: str) -> list[dict[str, Any]]:
        """List Runs"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/sim/a0/runs",
            path_params={"project_id": project_id},
        )

    def list_service_clients(self) -> Any:
        """List Service Clients"""
        return self._request(
            "GET",
            "/api/v1/admin/service-clients",
        )

    def list_setups(self, project_id: str) -> list[dict[str, Any]]:
        """List Setups"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/sim/a0/setups",
            path_params={"project_id": project_id},
        )

    def list_tokens(self, *, all_users: bool = False) -> list[AgentTokenView]:
        """List Tokens"""
        return self._request(
            "GET",
            "/api/v1/agent/tokens",
            query={"all_users": all_users},
        )

    def list_vendor_profiles(self, project_id: str) -> Any:
        """List Vendor Profiles"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/vendor-profiles",
            path_params={"project_id": project_id},
        )

    def live(self) -> dict[str, Any]:
        """Live"""
        return self._request(
            "GET",
            "/api/v1/health/live",
        )

    def login(self, *, body: dict[str, Any] | None = None) -> UserSession:
        """Login"""
        return self._request(
            "POST",
            "/api/v1/auth/login",
            body=body,
        )

    def login_with_password(self, *, body: dict[str, Any] | None = None) -> PasswordLoginResponse:
        """Login With Password"""
        return self._request(
            "POST",
            "/api/v1/auth/login/password",
            body=body,
        )

    def logout(self) -> Any:
        """Logout"""
        return self._request(
            "POST",
            "/api/v1/auth/logout",
        )

    def metadata_batch_report(self, batch_id: str) -> Any:
        """Export a metadata batch report"""
        return self._request(
            "GET",
            "/api/v1/catalog/metadata/batches/{batch_id}/report.csv",
            path_params={"batch_id": batch_id},
        )

    def metadata_grid(self, *, q: str = '', availability_state: str | None = None, workflow_stage: str | None = None, validation_status: str | None = None, category: str | None = None, page: int = 1, page_size: int = 100, sort_by: str = 'updated_at', sort_dir: str = 'desc', field: list[str] | None = None) -> MetadataGridPage:
        """Read the metadata grid"""
        return self._request(
            "GET",
            "/api/v1/catalog/metadata/grid",
            query={"q": q, "availability_state": availability_state, "workflow_stage": workflow_stage, "validation_status": validation_status, "category": category, "page": page, "page_size": page_size, "sort_by": sort_by, "sort_dir": sort_dir, "field": field},
        )

    def model_glb(self, key: str) -> Any:
        """Read a converted model GLB"""
        return self._request(
            "GET",
            "/api/v1/catalog/models/{key}.glb",
            path_params={"key": key},
        )

    def model_preview(self, component_id: str, asset_id: str, *, view: str = 'front', offset: str | None = None, rotation: str | None = None, scale: float | None = None, partner: str | None = None) -> Any:
        """Render a model preview"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}/models/{asset_id}/preview.svg",
            path_params={"component_id": component_id, "asset_id": asset_id},
            query={"view": view, "offset": offset, "rotation": rotation, "scale": scale, "partner": partner},
        )

    def move_project_to_folder(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Move Project To Folder"""
        return self._request(
            "POST",
            "/api/v1/folders/projects/{project_id}/move",
            path_params={"project_id": project_id},
            body=body,
        )

    def move_projects_to_folder(self, *, body: dict[str, Any] | None = None) -> Any:
        """Move Projects To Folder"""
        return self._request(
            "POST",
            "/api/v1/folders/projects/move",
            body=body,
        )

    def oauth_callback(self, *, code: str = '', state: str = '') -> Any:
        """Oauth Callback"""
        return self._request(
            "GET",
            "/api/v1/trackers/oauth/callback",
            query={"code": code, "state": state},
        )

    def patch_setup(self, project_id: str, setup_id: str, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
        """Patch Setup"""
        return self._request(
            "PATCH",
            "/api/v1/projects/{project_id}/sim/a0/setups/{setup_id}",
            path_params={"project_id": project_id, "setup_id": setup_id},
            body=body,
        )

    def pause_connector(self, connector_id: str) -> dict[str, Any]:
        """Pause Connector"""
        return self._request(
            "POST",
            "/api/v1/admin/trackers/connectors/{connector_id}/pause",
            path_params={"connector_id": connector_id},
        )

    def pin_comment(self, project_id: str, comment_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Pin Comment"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/comments/{comment_id}/pin",
            path_params={"project_id": project_id, "comment_id": comment_id},
            body=body,
        )

    def plugin_version(self) -> dict[str, Any]:
        """Plugin Version"""
        return self._request(
            "GET",
            "/api/v1/plugin/version",
        )

    def preflight_setup(self, project_id: str, setup_id: str) -> dict[str, Any]:
        """Preflight Setup"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/sim/a0/setups/{setup_id}/preflight",
            path_params={"project_id": project_id, "setup_id": setup_id},
        )

    def preview_document_sheet(self, project_id: str, build_id: str, sheet_key: str) -> Any:
        """Preview Document Sheet"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/sheets/{sheet_key}.pdf",
            path_params={"project_id": project_id, "build_id": build_id, "sheet_key": sheet_key},
        )

    def preview_metadata_csv(self) -> Any:
        """Preview Metadata Csv"""
        return self._request(
            "POST",
            "/api/v1/catalog/metadata/import-csv/preview",
        )

    def project_tracker_health(self, project_id: str) -> dict[str, Any]:
        """Project Tracker Health"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/tracker/health",
            path_params={"project_id": project_id},
        )

    def promote_comment_to_tracker(self, project_id: str, comment_id: str) -> dict[str, Any]:
        """Promote Comment To Tracker"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/comments/{comment_id}/promote",
            path_params={"project_id": project_id, "comment_id": comment_id},
        )

    def publish_build(self, project_id: str, build_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Publish Build"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/publish",
            path_params={"project_id": project_id, "build_id": build_id},
            body=body,
        )

    def push_comments(self, project_id: str) -> Any:
        """Push Comments"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/comments/push",
            path_params={"project_id": project_id},
        )

    def read_catalog(self) -> dict[str, Any]:
        """Read Catalog"""
        return self._request(
            "GET",
            "/api/v1/sim/a0/catalog",
        )

    def read_layout(self, project_id: str, setup_id: str) -> dict[str, Any]:
        """Read Layout"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/sim/a0/setups/{setup_id}/layout",
            path_params={"project_id": project_id, "setup_id": setup_id},
        )

    def read_result(self, project_id: str, run_id: str) -> dict[str, Any]:
        """Read Result"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/sim/a0/runs/{run_id}/result",
            path_params={"project_id": project_id, "run_id": run_id},
        )

    def read_result_file(self, project_id: str, run_id: str, path: str) -> Any:
        """Read Result File"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/sim/a0/runs/{run_id}/files/{path}",
            path_params={"project_id": project_id, "run_id": run_id, "path": path},
        )

    def read_run(self, project_id: str, run_id: str) -> dict[str, Any]:
        """Read Run"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/sim/a0/runs/{run_id}",
            path_params={"project_id": project_id, "run_id": run_id},
        )

    def read_run_materialization(self, project_id: str, run_id: str) -> Any:
        """Read Run Materialization"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/sim/a0/runs/{run_id}/materialization",
            path_params={"project_id": project_id, "run_id": run_id},
        )

    def read_run_setup(self, project_id: str, run_id: str) -> dict[str, Any]:
        """Read Run Setup"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/sim/a0/runs/{run_id}/setup",
            path_params={"project_id": project_id, "run_id": run_id},
        )

    def read_setup(self, project_id: str, setup_id: str) -> dict[str, Any]:
        """Read Setup"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/sim/a0/setups/{setup_id}",
            path_params={"project_id": project_id, "setup_id": setup_id},
        )

    def ready(self) -> dict[str, Any]:
        """Ready"""
        return self._request(
            "GET",
            "/api/v1/health/ready",
        )

    def reattach_comment(self, project_id: str, comment_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Reattach Comment"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/comments/{comment_id}/reattach",
            path_params={"project_id": project_id, "comment_id": comment_id},
            body=body,
        )

    def regenerate_component_previews(self, component_id: str) -> Any:
        """Regenerate Component Previews"""
        return self._request(
            "POST",
            "/api/v1/catalog/components/{component_id}/previews/regenerate",
            path_params={"component_id": component_id},
        )

    def regenerate_design_bundles(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Regenerate Design Bundles"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/design-bundles/regenerate",
            path_params={"project_id": project_id},
            body=body,
        )

    def regenerate_project_thumbnail(self, project_id: str) -> Any:
        """Regenerate Project Thumbnail"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/thumbnail/regenerate",
            path_params={"project_id": project_id},
        )

    def regenerate_project_thumbnails(self, *, body: dict[str, Any] | None = None) -> Any:
        """Regenerate Project Thumbnails"""
        return self._request(
            "POST",
            "/api/v1/projects/thumbnails/regenerate",
            body=body,
        )

    def reject_project_import_proposal(self, proposal_id: str) -> Any:
        """Reject Project Import Proposal"""
        return self._request(
            "POST",
            "/api/v1/catalog/import-proposals/{proposal_id}/reject",
            path_params={"proposal_id": proposal_id},
        )

    def release_queue(self, *, q: str = '', workflow_stage: str = 'all', page: int = 1, page_size: int = 50) -> ReleaseQueuePage:
        """List the release queue"""
        return self._request(
            "GET",
            "/api/v1/catalog/release-queue",
            query={"q": q, "workflow_stage": workflow_stage, "page": page, "page_size": page_size},
        )

    def remove_comment_reaction(self, project_id: str, comment_id: str, reaction: str, *, replyId: str | None = None) -> Any:
        """Remove Comment Reaction"""
        return self._request(
            "DELETE",
            "/api/v1/projects/{project_id}/comments/{comment_id}/reactions/{reaction}",
            path_params={"project_id": project_id, "comment_id": comment_id, "reaction": reaction},
            query={"replyId": replyId},
        )

    def remove_mate(self, component_id: str, other_id: str) -> Any:
        """Remove Mate"""
        return self._request(
            "DELETE",
            "/api/v1/catalog/components/{component_id}/mates-with/{other_id}",
            path_params={"component_id": component_id, "other_id": other_id},
        )

    def replace_setup(self, project_id: str, setup_id: str, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
        """Replace Setup"""
        return self._request(
            "PUT",
            "/api/v1/projects/{project_id}/sim/a0/setups/{setup_id}",
            path_params={"project_id": project_id, "setup_id": setup_id},
            body=body,
        )

    def repromote_comment_tracker(self, project_id: str, comment_id: str) -> dict[str, Any]:
        """Repromote Comment Tracker"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/comments/{comment_id}/tracker/repromote",
            path_params={"project_id": project_id, "comment_id": comment_id},
        )

    def restore_metadata_field(self, field_id: str) -> Any:
        """Restore Metadata Field"""
        return self._request(
            "POST",
            "/api/v1/catalog/metadata/fields/{field_id}/restore",
            path_params={"field_id": field_id},
        )

    def resume_connector(self, connector_id: str) -> dict[str, Any]:
        """Resume Connector"""
        return self._request(
            "POST",
            "/api/v1/admin/trackers/connectors/{connector_id}/resume",
            path_params={"connector_id": connector_id},
        )

    def retry_comment_sync(self, project_id: str, comment_id: str) -> dict[str, Any]:
        """Retry Comment Sync"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/comments/{comment_id}/tracker/retry",
            path_params={"project_id": project_id, "comment_id": comment_id},
        )

    def retry_project_import_follow_ups(self, project_id: str) -> Any:
        """Retry Project Import Follow Ups"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/import-follow-ups/retry",
            path_params={"project_id": project_id},
        )

    def revoke_connector(self, connector_id: str) -> dict[str, Any]:
        """Revoke Connector"""
        return self._request(
            "POST",
            "/api/v1/admin/trackers/connectors/{connector_id}/revoke",
            path_params={"connector_id": connector_id},
        )

    def revoke_other_sessions(self) -> Any:
        """Revoke Other Sessions"""
        return self._request(
            "POST",
            "/api/v1/auth/sessions/revoke-others",
        )

    def revoke_personal_token(self, token_id: str) -> None:
        """Revoke Personal Token"""
        return self._request(
            "DELETE",
            "/api/v1/auth/tokens/{token_id}",
            path_params={"token_id": token_id},
        )

    def revoke_token(self, jti: str) -> dict[str, str]:
        """Revoke Token"""
        return self._request(
            "DELETE",
            "/api/v1/agent/tokens/{jti}",
            path_params={"jti": jti},
        )

    def revoke_user_sessions(self, email: str) -> Any:
        """Revoke User Sessions"""
        return self._request(
            "POST",
            "/api/v1/auth/sessions/revoke-user/{email}",
            path_params={"email": email},
        )

    def rotate_service_client_secret(self, client_id: str) -> Any:
        """Rotate Service Client Secret"""
        return self._request(
            "POST",
            "/api/v1/admin/service-clients/{client_id}/rotate-secret",
            path_params={"client_id": client_id},
        )

    def run_artifact_maintenance(self) -> Any:
        """Run Artifact Maintenance"""
        return self._request(
            "POST",
            "/api/v1/catalog/artifacts/maintenance",
        )

    def save_import_proposal_drafts(self, session_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Save Import Proposal Drafts"""
        return self._request(
            "PUT",
            "/api/v1/catalog/import-sessions/{session_id}/proposals/drafts",
            path_params={"session_id": session_id},
            body=body,
        )

    def save_metadata_grid_preferences(self, *, body: dict[str, Any] | None = None) -> Any:
        """Save Metadata Grid Preferences"""
        return self._request(
            "PUT",
            "/api/v1/catalog/metadata/grid-preferences",
            body=body,
        )

    def save_source_defaults(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Save Source Defaults"""
        return self._request(
            "PUT",
            "/api/v1/projects/{project_id}/release-studio/source/defaults",
            path_params={"project_id": project_id},
            body=body,
        )

    def scan_catalog_usage(self, project_id: str, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
        """Scan Catalog Usage"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/catalog-usage/scan",
            path_params={"project_id": project_id},
            body=body,
        )

    def scan_git_host_key(self, *, body: dict[str, Any] | None = None) -> Any:
        """Scan Git Host Key"""
        return self._request(
            "POST",
            "/api/v1/settings/git-access/host-keys/scan",
            body=body,
        )

    def search_catalog_assets(self, *, asset_type: str = 'footprint', q: str = '', limit: int = 25) -> AssetSearchPage:
        """Search catalog assets"""
        return self._request(
            "GET",
            "/api/v1/catalog/assets/search",
            query={"asset_type": asset_type, "q": q, "limit": limit},
        )

    def search_components(self, *, q: str = '', page: int = 1, page_size: int = 50, include_total: bool = False) -> Any:
        """Search Components"""
        return self._request(
            "GET",
            "/api/v1/remote-provider/search",
            query={"q": q, "page": page, "page_size": page_size, "include_total": include_total},
        )

    def search_design(self, project_id: str, *, q: str, kind: list[str] | None = None, revision: str | None = None, limit: int = 50) -> DesignSearchOut:
        """Search Design"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/design/search",
            path_params={"project_id": project_id},
            query={"q": q, "kind": kind, "revision": revision, "limit": limit},
        )

    def search_projects(self, *, q: str = '', limit: int = 100) -> ProjectSearchResults:
        """Search projects by name, description or repository"""
        return self._request(
            "GET",
            "/api/v1/projects/search",
            query={"q": q, "limit": limit},
        )

    def set_model_alignment(self, component_id: str, asset_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Set Model Alignment"""
        return self._request(
            "PUT",
            "/api/v1/catalog/components/{component_id}/models/{asset_id}/alignment",
            path_params={"component_id": component_id, "asset_id": asset_id},
            body=body,
        )

    def set_service_client_enabled(self, client_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Set Service Client Enabled"""
        return self._request(
            "PATCH",
            "/api/v1/admin/service-clients/{client_id}",
            path_params={"client_id": client_id},
            body=body,
        )

    def set_user_password(self, email: str, *, body: dict[str, Any] | None = None) -> Any:
        """Set User Password"""
        return self._request(
            "PUT",
            "/api/v1/settings/access/users/{email}/password",
            path_params={"email": email},
            body=body,
        )

    def share_reply_to_tracker(self, project_id: str, comment_id: str, reply_id: str) -> dict[str, Any]:
        """Share Reply To Tracker"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/comments/{comment_id}/replies/{reply_id}/share",
            path_params={"project_id": project_id, "comment_id": comment_id, "reply_id": reply_id},
        )

    def start_design_compare(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Start Design Compare"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/design-compare",
            path_params={"project_id": project_id},
            body=body,
        )

    def start_login(self) -> LoginStartResponse:
        """Start Login"""
        return self._request(
            "POST",
            "/api/v1/auth/login/start",
        )

    def submit_setup(self, project_id: str, setup_id: str, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
        """Submit Setup"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/sim/a0/setups/{setup_id}/submit",
            path_params={"project_id": project_id, "setup_id": setup_id},
            body=body,
        )

    def sync_project_endpoint(self, project_id: str) -> Any:
        """Sync Project Endpoint"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/sync",
            path_params={"project_id": project_id},
        )

    def test_connector(self, connector_id: str) -> dict[str, Any]:
        """Test Connector"""
        return self._request(
            "POST",
            "/api/v1/admin/trackers/connectors/{connector_id}/test",
            path_params={"connector_id": connector_id},
        )

    def thread_sync_history(self, project_id: str, comment_id: str) -> dict[str, Any]:
        """Thread Sync History"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/comments/{comment_id}/tracker/history",
            path_params={"project_id": project_id, "comment_id": comment_id},
        )

    def thread_sync_status(self, project_id: str, comment_id: str) -> dict[str, Any]:
        """Thread Sync Status"""
        return self._request(
            "GET",
            "/api/v1/projects/{project_id}/comments/{comment_id}/tracker",
            path_params={"project_id": project_id, "comment_id": comment_id},
        )

    def token(self) -> Any:
        """Token"""
        return self._request(
            "POST",
            "/api/v1/oauth/token",
        )

    def tracker_webhook(self, provider: str, connector_id: str) -> Any:
        """Tracker Webhook"""
        return self._request(
            "POST",
            "/api/v1/trackers/webhooks/{provider}/{connector_id}",
            path_params={"provider": provider, "connector_id": connector_id},
        )

    def transition_release_status(self, component_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Transition Release Status"""
        return self._request(
            "POST",
            "/api/v1/catalog/components/{component_id}/release",
            path_params={"component_id": component_id},
            body=body,
        )

    def trigger_workflow(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Trigger Workflow"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/workflows",
            path_params={"project_id": project_id},
            body=body,
        )

    def trust_git_host_key(self, *, body: dict[str, Any] | None = None) -> Any:
        """Trust Git Host Key"""
        return self._request(
            "POST",
            "/api/v1/settings/git-access/host-keys/trust",
            body=body,
        )

    def unlink_comment_tracker(self, project_id: str, comment_id: str) -> dict[str, Any]:
        """Unlink Comment Tracker"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/comments/{comment_id}/tracker/unlink",
            path_params={"project_id": project_id, "comment_id": comment_id},
        )

    def unlink_identity(self, connector_id: str) -> None:
        """Unlink Identity"""
        return self._request(
            "DELETE",
            "/api/v1/trackers/identities/{connector_id}",
            path_params={"connector_id": connector_id},
        )

    def update_catalog_component(self, component_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Update Catalog Component"""
        return self._request(
            "PATCH",
            "/api/v1/catalog/components/{component_id}",
            path_params={"component_id": component_id},
            body=body,
        )

    def update_comment(self, project_id: str, comment_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Update Comment"""
        return self._request(
            "PATCH",
            "/api/v1/projects/{project_id}/comments/{comment_id}",
            path_params={"project_id": project_id, "comment_id": comment_id},
            body=body,
        )

    def update_component_representation(self, component_id: str, representation_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Update Component Representation"""
        return self._request(
            "PATCH",
            "/api/v1/catalog/components/{component_id}/representations/{representation_id}",
            path_params={"component_id": component_id, "representation_id": representation_id},
            body=body,
        )

    def update_connector(self, connector_id: str, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
        """Update Connector"""
        return self._request(
            "PATCH",
            "/api/v1/admin/trackers/connectors/{connector_id}",
            path_params={"connector_id": connector_id},
            body=body,
        )

    def update_folder(self, folder_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Update Folder"""
        return self._request(
            "PATCH",
            "/api/v1/folders/{folder_id}",
            path_params={"folder_id": folder_id},
            body=body,
        )

    def update_metadata_field(self, field_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Update Metadata Field"""
        return self._request(
            "PATCH",
            "/api/v1/catalog/metadata/fields/{field_id}",
            path_params={"field_id": field_id},
            body=body,
        )

    def update_project_config(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Update Project Config"""
        return self._request(
            "PUT",
            "/api/v1/projects/{project_id}/config",
            path_params={"project_id": project_id},
            body=body,
        )

    def update_project_description(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Update Project Description"""
        return self._request(
            "PUT",
            "/api/v1/projects/{project_id}/description",
            path_params={"project_id": project_id},
            body=body,
        )

    def update_project_name(self, project_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Update Project Name"""
        return self._request(
            "PUT",
            "/api/v1/projects/{project_id}/name",
            path_params={"project_id": project_id},
            body=body,
        )

    def update_project_tracker(self, project_id: str, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
        """Update Project Tracker"""
        return self._request(
            "PUT",
            "/api/v1/projects/{project_id}/tracker",
            path_params={"project_id": project_id},
            body=body,
        )

    def update_reply(self, project_id: str, comment_id: str, reply_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Update Reply"""
        return self._request(
            "PATCH",
            "/api/v1/projects/{project_id}/comments/{comment_id}/replies/{reply_id}",
            path_params={"project_id": project_id, "comment_id": comment_id, "reply_id": reply_id},
            body=body,
        )

    def upload_comment_attachment(self, project_id: str) -> Any:
        """Upload Comment Attachment"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/comment-attachments",
            path_params={"project_id": project_id},
        )

    def upload_folder_snapshot_file(self, snapshot_id: str) -> Any:
        """Upload Folder Snapshot File"""
        return self._request(
            "POST",
            "/api/v1/catalog/import-snapshots/folders/{snapshot_id}/files",
            path_params={"snapshot_id": snapshot_id},
        )

    def upload_project_thumbnail(self, project_id: str) -> Any:
        """Upload Project Thumbnail"""
        return self._request(
            "PUT",
            "/api/v1/projects/{project_id}/thumbnail",
            path_params={"project_id": project_id},
        )

    def upsert_access_user(self, email: str, *, body: dict[str, Any] | None = None) -> RoleAssignmentResponse:
        """Upsert Access User"""
        return self._request(
            "PUT",
            "/api/v1/settings/access/users/{email}",
            path_params={"email": email},
            body=body,
        )

    def validate_catalog(self) -> Any:
        """Validate Catalog"""
        return self._request(
            "POST",
            "/api/v1/catalog/validation/run",
        )

    def validate_component_klc(self, component_id: str) -> Any:
        """Validate Component Klc"""
        return self._request(
            "POST",
            "/api/v1/catalog/components/{component_id}/validate",
            path_params={"component_id": component_id},
        )

    def validate_setup(self, project_id: str, setup_id: str) -> dict[str, Any]:
        """Validate Setup"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/sim/a0/setups/{setup_id}/validate",
            path_params={"project_id": project_id, "setup_id": setup_id},
        )

    def verify_component_audit(self, component_id: str) -> AuditVerification:
        """Verify the component audit chain"""
        return self._request(
            "GET",
            "/api/v1/catalog/components/{component_id}/audit/verify",
            path_params={"component_id": component_id},
        )

    def withdraw_build_approval(self, project_id: str, build_id: str, *, body: dict[str, Any] | None = None) -> Any:
        """Withdraw Build Approval"""
        return self._request(
            "POST",
            "/api/v1/projects/{project_id}/release-studio/builds/{build_id}/approvals/withdraw",
            path_params={"project_id": project_id, "build_id": build_id},
            body=body,
        )

    def workflow_summary(self) -> WorkflowSummary:
        """Count components by workflow stage"""
        return self._request(
            "GET",
            "/api/v1/catalog/workflow/summary",
        )

    def write_layout(self, project_id: str, setup_id: str, *, body: dict[str, Any] | None = None) -> dict[str, Any]:
        """Write Layout"""
        return self._request(
            "PUT",
            "/api/v1/projects/{project_id}/sim/a0/setups/{setup_id}/layout",
            path_params={"project_id": project_id, "setup_id": setup_id},
            body=body,
        )
