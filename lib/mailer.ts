/**
 * AWS SES mailer — server-only.
 *
 * Credentials are passed explicitly to the SESClient constructor so that
 * Vercel/Lambda runtime ambient AWS_* environment variables (which may be
 * scoped to a different AWS account or role) do not shadow the SES-specific
 * keys configured for this service.
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

/** HTML-escape a value before interpolating it into an email body. */
function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let _sesClient: SESClient | null = null;

function getSesClient(): SESClient {
  if (_sesClient) return _sesClient;

  const region = process.env.SES_AWS_REGION;
  const accessKeyId = process.env.SES_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SES_AWS_SECRET_ACCESS_KEY;

  if (!region) {
    throw new Error("mailer: SES_AWS_REGION environment variable is not set.");
  }
  if (!accessKeyId) {
    throw new Error(
      "mailer: SES_AWS_ACCESS_KEY_ID environment variable is not set."
    );
  }
  if (!secretAccessKey) {
    throw new Error(
      "mailer: SES_AWS_SECRET_ACCESS_KEY environment variable is not set."
    );
  }

  _sesClient = new SESClient({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return _sesClient;
}

export async function sendFormLink(params: {
  to: string;
  formUrl: string;
  companyName?: string;
}): Promise<void> {
  const fromEmail = process.env.ONBOARDING_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error(
      "mailer: ONBOARDING_FROM_EMAIL environment variable is not set."
    );
  }

  // Only emit https links — guards against javascript:/data: URIs ever reaching
  // a recipient's mail client if formUrl is ever derived from external data.
  if (new URL(params.formUrl).protocol !== "https:") {
    throw new Error("mailer: formUrl must be an https URL.");
  }

  const greeting = params.companyName
    ? `Hello ${params.companyName} team,`
    : "Hello,";

  const htmlBody = `
<html>
  <body>
    <p>${esc(greeting)}</p>
    <p>Please complete your onboarding by filling in the form at the link below:</p>
    <p><a href="${esc(params.formUrl)}">${esc(params.formUrl)}</a></p>
    <p>If you did not expect this email, please disregard it.</p>
  </body>
</html>
`.trim();

  const textBody = [
    greeting,
    "",
    "Please complete your onboarding by filling in the form at the link below:",
    "",
    params.formUrl,
    "",
    "If you did not expect this email, please disregard it.",
  ].join("\n");

  const command = new SendEmailCommand({
    Source: fromEmail,
    Destination: {
      ToAddresses: [params.to],
    },
    Message: {
      Subject: {
        Data: "Complete your onboarding",
        Charset: "UTF-8",
      },
      Body: {
        Html: {
          Data: htmlBody,
          Charset: "UTF-8",
        },
        Text: {
          Data: textBody,
          Charset: "UTF-8",
        },
      },
    },
  });

  await getSesClient().send(command);
}
