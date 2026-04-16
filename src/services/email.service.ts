import nodemailer from "nodemailer";

const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

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

  const transporter = createTransporter();

  await transporter.sendMail({
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
};
