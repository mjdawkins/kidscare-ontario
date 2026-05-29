import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

interface AlertEmail {
  to: string;
  doctorName: string;
  doctorId: string;
}

/**
 * Send roster alert emails when a doctor flips to "accepting".
 * Non-blocking — fires and forgets. Failures are logged but don't
 * affect the API response.
 */
export async function sendRosterAlerts(alerts: AlertEmail[]) {
  if (!resend) {
    console.warn("Resend not configured — skipping alert emails");
    return;
  }

  const results = await Promise.allSettled(
    alerts.map((alert) =>
      resend.emails.send({
        from: "KidsCare Ontario <alerts@kidscareontario.ca>",
        to: alert.to,
        subject: `${alert.doctorName} is now accepting patients`,
        html: `
          <h2>Good news — ${alert.doctorName} is accepting patients</h2>
          <p>A parent just confirmed that this pediatrician is accepting new patients.</p>
          <p>
            <a href="https://kidscare-ontario.vercel.app/pediatricians/${alert.doctorId}">
              View on KidsCare Ontario
            </a>
          </p>
          <p style="color: #666; font-size: 12px;">
            KidsCare Ontario — helping Ontario parents find pediatricians.<br />
            You received this because you subscribed to roster alerts.
          </p>
        `,
      })
    )
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.error(`Failed to send ${failed}/${alerts.length} alert emails`);
  }
}
