import Mailjet from "node-mailjet";

export const sendReportReadyEmail = async (
  requestedByName: string,
  fileUrl: string,
  params: { dateFrom?: string; dateTo?: string; date?: string; status?: string },
): Promise<void> => {
  console.log("[email] sendReportReadyEmail called", { requestedByName, fileUrl, params });

  if (!process.env.MJ_APIKEY_PUBLIC || !process.env.MJ_APIKEY_PRIVATE) {
    console.warn("[email] MJ_APIKEY_PUBLIC or MJ_APIKEY_PRIVATE not set — skipping email.");
    return;
  }

  const TO = process.env.REPORT_EMAIL_TO || "softwarelifegroups@gmail.com";
  const CC = process.env.REPORT_EMAIL_CC || "";
  const FROM = process.env.SMTP_FROM || "app@lifegroups.in";

  console.log(`[email] From: ${FROM} | To: ${TO} | CC: ${CC || "none"}`);

  const dateLabel =
    params.dateFrom && params.dateTo
      ? `from ${params.dateFrom} to ${params.dateTo}`
      : params.date
        ? `for ${params.date}`
        : "";

  const statusLabel = params.status ? ` (${params.status})` : "";

  const mailjet = Mailjet.apiConnect(
    process.env.MJ_APIKEY_PUBLIC,
    process.env.MJ_APIKEY_PRIVATE,
  );

  const message: any = {
    From: { Email: FROM, Name: "Life Groups App" },
    To: [{ Email: TO }],
    Subject: `Billing Report${statusLabel} is Ready`,
    HTMLPart: `
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
  };

  if (CC) {
    message.Cc = [{ Email: CC }];
  }

  console.log("[email] Sending request to Mailjet API...");

  const result = await mailjet
    .post("send", { version: "v3.1" })
    .request({ Messages: [message] });

  console.log("[email] Mailjet full response:", JSON.stringify(result.body, null, 2));

  const msgResult = (result.body as any)?.Messages?.[0];
  const status = msgResult?.Status;

  if (status === "success") {
    console.log(`[email] Email sent successfully. MessageID: ${msgResult?.To?.[0]?.MessageID}`);
  } else {
    console.error("[email] Email send failed. Errors:", JSON.stringify(msgResult?.Errors, null, 2));
    throw new Error(`Mailjet send failed: ${JSON.stringify(msgResult?.Errors)}`);
  }
};
