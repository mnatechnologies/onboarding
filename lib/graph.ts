/**
 * Microsoft Graph client — Phase 2 user provisioning.
 *
 * Uses the OAuth 2.0 client-credentials flow (client credentials grant) to
 * obtain a per-tenant app token, then calls the Graph API to create a new
 * Azure AD / Entra ID user, read subscribed SKUs, and assign licenses.
 *
 * ONE multi-tenant app registration (MS_GRAPH_CLIENT_ID / MS_GRAPH_CLIENT_SECRET)
 * is admin-consented into each client tenant. The caller supplies the target
 * tenant_id at runtime — MS_GRAPH_TENANT_ID is no longer used.
 *
 * Required Graph application permissions (granted per client tenant via admin consent):
 *   - User.ReadWrite.All  — create user + assign license
 *   - Organization.Read.All — read subscribedSkus
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ProvisionUserInput {
  displayName: string;
  mailNickname: string;
  userPrincipalName: string;
  password: string;
}

export interface ProvisionUserResult {
  id: string;
  userPrincipalName: string;
}

export interface SubscribedSku {
  skuId: string;
  skuPartNumber: string;
  enabled: number;
  consumed: number;
  available: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getGraphToken(tenantId: string): Promise<string> {
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;

  if (!clientId) {
    throw new Error(
      "graph: MS_GRAPH_CLIENT_ID environment variable is not set."
    );
  }
  if (!clientSecret) {
    throw new Error(
      "graph: MS_GRAPH_CLIENT_SECRET environment variable is not set."
    );
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable body)");
    throw new Error(
      `graph: token request failed for tenant ${tenantId} with HTTP ${res.status}: ${text}`
    );
  }

  const data = (await res.json()) as Record<string, unknown>;
  const token = data["access_token"];
  if (typeof token !== "string" || !token) {
    throw new Error(
      `graph: token response did not contain a valid access_token: ${JSON.stringify(data)}`
    );
  }
  return token;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function provisionUser(
  tenantId: string,
  input: ProvisionUserInput
): Promise<ProvisionUserResult> {
  const token = await getGraphToken(tenantId);

  const res = await fetch("https://graph.microsoft.com/v1.0/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      accountEnabled: true,
      displayName: input.displayName,
      mailNickname: input.mailNickname,
      userPrincipalName: input.userPrincipalName,
      usageLocation: process.env.MS_USAGE_LOCATION ?? "AU",
      passwordProfile: {
        forceChangePasswordNextSignIn: true,
        password: input.password,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable body)");
    throw new Error(
      `graph: POST /v1.0/users failed with HTTP ${res.status}: ${text}`
    );
  }

  const user = (await res.json()) as Record<string, unknown>;

  const id = user["id"];
  const userPrincipalName = user["userPrincipalName"];

  if (typeof id !== "string" || !id) {
    throw new Error(
      `graph: created user response missing id: ${JSON.stringify(user)}`
    );
  }
  if (typeof userPrincipalName !== "string" || !userPrincipalName) {
    throw new Error(
      `graph: created user response missing userPrincipalName: ${JSON.stringify(user)}`
    );
  }

  return { id, userPrincipalName };
}

export async function listSubscribedSkus(
  tenantId: string
): Promise<SubscribedSku[]> {
  const token = await getGraphToken(tenantId);

  const res = await fetch("https://graph.microsoft.com/v1.0/subscribedSkus", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable body)");
    throw new Error(
      `graph: GET /v1.0/subscribedSkus failed with HTTP ${res.status}: ${text}`
    );
  }

  const data = (await res.json()) as Record<string, unknown>;
  const value = data["value"];

  if (!Array.isArray(value)) {
    throw new Error(
      `graph: subscribedSkus response missing value array: ${JSON.stringify(data)}`
    );
  }

  return value.map((item: unknown) => {
    const sku = item as Record<string, unknown>;
    const prepaidUnits = sku["prepaidUnits"] as Record<string, unknown>;
    const enabled =
      typeof prepaidUnits?.["enabled"] === "number"
        ? prepaidUnits["enabled"]
        : 0;
    const consumed =
      typeof sku["consumedUnits"] === "number"
        ? (sku["consumedUnits"] as number)
        : 0;
    return {
      skuId: typeof sku["skuId"] === "string" ? sku["skuId"] : "",
      skuPartNumber:
        typeof sku["skuPartNumber"] === "string" ? sku["skuPartNumber"] : "",
      enabled,
      consumed,
      available: enabled - consumed,
    };
  });
}

export async function findSkuByPartNumber(
  tenantId: string,
  partNumber: string
): Promise<SubscribedSku | null> {
  const skus = await listSubscribedSkus(tenantId);
  return skus.find((s) => s.skuPartNumber === partNumber) ?? null;
}

export async function assignLicense(
  tenantId: string,
  userId: string,
  skuId: string
): Promise<void> {
  const token = await getGraphToken(tenantId);

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userId}/assignLicense`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        addLicenses: [{ skuId, disabledPlans: [] }],
        removeLicenses: [],
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "(unreadable body)");
    throw new Error(
      `graph: POST /v1.0/users/${userId}/assignLicense failed with HTTP ${res.status}: ${text}`
    );
  }
}
