import dns from "dns";
import nodemailer from "nodemailer";

// Resolve SMTP hostname to IPv4 at startup to avoid IPv6 on production servers
// that have outbound IPv6 blocked (ENETUNREACH on IPv6 address).
let resolvedSmtpHost: string | undefined;
async function getSmtpHost(): Promise<string> {
  if (resolvedSmtpHost) return resolvedSmtpHost;
  const host = process.env.SMTP_HOST;
  if (!host) return "";
  try {
    const addresses = await dns.promises.resolve4(host);
    resolvedSmtpHost = addresses[0];
    console.log(`[email] DNS resolved ${host} → ${resolvedSmtpHost} (IPv4)`);
  } catch (err: any) {
    resolvedSmtpHost = host;
    console.warn(`[email] DNS resolve failed for ${host} (${err.message}), using hostname as-is`);
  }
  return resolvedSmtpHost;
}

const createTransporter = async () => {
  const host = await getSmtpHost();
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT) || 2525,
    secure:false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    requireTLS: true,
    tls: {
      rejectUnauthorized: false,
    },
  } as any);
};

export const sendReportReadyEmail = async (
  requestedByName: string,
  fileUrl: string,
  params: { dateFrom?: string; dateTo?: string; date?: string; status?: string },
): Promise<void> => {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP not configured — skipping report email.");
    return;
  }

  // Fixed recipients — email always goes to company inbox regardless of who requested
  const TO = process.env.REPORT_EMAIL_TO || "sureshkumarbhagavan@gmail.com";
  const CC = process.env.REPORT_EMAIL_CC || "";

  const dateLabel =
    params.dateFrom && params.dateTo
      ? `from ${params.dateFrom} to ${params.dateTo}`
      : params.date
        ? `for ${params.date}`
        : "";

  const statusLabel = params.status ? ` (${params.status})` : "";

  console.log(`[email] Sending report email to: ${TO}${CC ? ` (CC: ${CC})` : ""}`);
  const transporter = await createTransporter();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: TO,
    ...(CC ? { cc: CC } : {}),
    subject: `Billing Report${statusLabel} is Ready`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Billing Report Ready</h2>
        <p>Requested by: <strong>${requestedByName}</strong></p>
        <p>The billing report ${dateLabel}${statusLabel} has been generated successfully.</p>
        <p>
          <a href="${fileUrl}"
             style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;
                    border-radius:6px;text-decoration:none;font-weight:bold;">
            Download Report
          </a>
        </p>
        <p style="color:#888;font-size:12px;margin-top:24px;">
          This link is valid while the file is stored. If you have any issues, please contact the admin.
        </p>
      </div>
    `,
  });
  console.log(`[email] Report email sent successfully. Message ID: ${info.messageId}`);
};
