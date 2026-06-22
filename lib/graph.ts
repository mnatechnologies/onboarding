/**
 * Microsoft Graph client — Phase 2 user provisioning.
 *
 * Uses the OAuth 2.0 client-credentials flow to obtain an app token, then
 * calls the Graph API to create a new Azure AD / Entra ID user.
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getAppToken(): Promise<string> {
  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;

  if (!tenantId) {
    throw new Error(
      "graph: MS_GRAPH_TENANT_ID environment variable is not set."
    );
  }
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
      `graph: token request failed with HTTP ${res.status}: ${text}`
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
  input: ProvisionUserInput
): Promise<ProvisionUserResult> {
  const token = await getAppToken();

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
