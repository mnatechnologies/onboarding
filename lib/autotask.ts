/**
 * Autotask REST API client.
 *
 * Authentication headers are sent on every request:
 *   ApiIntegrationCode, UserName, Secret
 *
 * The base URL (process.env.AUTOTASK_API_BASE_URL) is expected to already
 * include the versioned path segment, e.g.:
 *   https://webservices1.autotask.net/atservicesrest/v1.0
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AutotaskFilterItem {
  op: string;
  field: string;
  value?: unknown;
  udf?: boolean;
}

export interface AutotaskTicket {
  id: number;
  companyID: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Internal request helper
// ---------------------------------------------------------------------------

function getBaseUrl(): string {
  const raw = process.env.AUTOTASK_API_BASE_URL;
  if (!raw) {
    throw new Error(
      "autotask: AUTOTASK_API_BASE_URL environment variable is not set."
    );
  }
  return raw.replace(/\/+$/, "");
}

function getAuthHeaders(): Record<string, string> {
  const integrationCode = process.env.AUTOTASK_INTEGRATION_CODE;
  const userName = process.env.AUTOTASK_USERNAME;
  const secret = process.env.AUTOTASK_SECRET;

  if (!integrationCode) {
    throw new Error(
      "autotask: AUTOTASK_INTEGRATION_CODE environment variable is not set."
    );
  }
  if (!userName) {
    throw new Error(
      "autotask: AUTOTASK_USERNAME environment variable is not set."
    );
  }
  if (!secret) {
    throw new Error(
      "autotask: AUTOTASK_SECRET environment variable is not set."
    );
  }

  return {
    ApiIntegrationCode: integrationCode,
    UserName: userName,
    Secret: secret,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function request(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `${getBaseUrl()}${path}`;
  const headers = getAuthHeaders();

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable body)");
    throw new Error(
      `Autotask ${method} ${url} failed with HTTP ${res.status}: ${text}`
    );
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return res.json() as Promise<unknown>;
  }
  return res.text();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getZoneInformation(): Promise<unknown> {
  return request("GET", "/zoneInformation");
}

export async function queryTickets(
  filter: AutotaskFilterItem[]
): Promise<AutotaskTicket[]> {
  const data = (await request("POST", "/Tickets/query", {
    filter,
  })) as Record<string, unknown>;
  const items = data["items"];
  return Array.isArray(items) ? (items as AutotaskTicket[]) : [];
}

export async function getTicket(id: number): Promise<AutotaskTicket | null> {
  const data = (await request(
    "GET",
    `/Tickets/${id}`
  )) as Record<string, unknown>;
  const item = data["item"];
  return item != null ? (item as AutotaskTicket) : null;
}

export async function patchTicket(
  id: number,
  fields: Record<string, unknown>,
  udfs?: { name: string; value: unknown }[]
): Promise<void> {
  const body: Record<string, unknown> = { id, ...fields };
  if (udfs !== undefined) {
    body["userDefinedFields"] = udfs.map((u) => ({
      name: u.name,
      value: u.value,
    }));
  }
  await request("PATCH", "/Tickets", body);
}

export async function addTicketNote(
  ticketId: number,
  title: string,
  description: string
): Promise<void> {
  await request("POST", `/Tickets/${ticketId}/Notes`, {
    title,
    description,
    noteType: 1,
    publish: 1,
  });
}

/**
 * Creates a work item to represent a requisition/provisioning task.
 *
 * NOTE: this currently creates a child Ticket entity because Autotask's
 * "Task" entity is scoped to Projects, not Service Desk. The exact entity
 * type and required fields MUST be confirmed against the tenant's Autotask
 * configuration before using in production — required fields vary by
 * workflow rules and picklist values set up per tenant.
 *
 * Returns the numeric ID of the newly created item.
 */
export async function createTask(input: {
  companyId: number;
  title: string;
  description: string;
  queueId?: number;
}): Promise<number> {
  const body: Record<string, unknown> = {
    companyID: input.companyId,
    title: input.title,
    description: input.description,
    status: 1,
    priority: 3,
  };
  if (input.queueId !== undefined) {
    body["queueID"] = input.queueId;
  }

  const data = (await request("POST", "/Tickets", body)) as Record<
    string,
    unknown
  >;
  const itemId = data["itemId"];
  if (typeof itemId !== "number") {
    throw new Error(
      `autotask createTask: expected numeric itemId in response, got: ${JSON.stringify(data)}`
    );
  }
  return itemId;
}
