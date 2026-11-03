import { Resend } from "resend";
import type { Database } from "./database.js";
import { HttpError } from "./validation.js";

export type MailTransport = (
  input: { from: string; to: string; subject: string; text: string },
  key: string,
) => Promise<string>;
export class InstitutionMail {
  constructor(
    readonly db: Database,
    readonly transport?: MailTransport,
  ) {}
  async list(reportId: string) {
    return {
      mails: (
        await this.db.query(
          'SELECT id,delivery_id AS "deliveryId",recipient,subject,body,state,provider_id AS "providerId",error,attempts,created_at AS "createdAt" FROM institution_mail WHERE report_id=$1 ORDER BY created_at DESC',
          [reportId],
        )
      ).rows,
    };
  }
  async dispatch(reportId: string) {
    if (
      !this.transport &&
      (!process.env.RESEND_API_KEY || !process.env.MAIL_FROM)
    )
      throw new HttpError(
        503,
        "E-posta hizmeti henüz yapılandırılmadı. Talep kurum kuyruğunda korunuyor.",
      );
    await this.db.query(
      "UPDATE institution_mail SET state='failed',attempts=3,error='Güvenli tekrar gönderim süresi doldu. Kurumla iletimi kontrol edin.',updated_at=now() WHERE report_id=$1 AND state<>'sent' AND created_at<=now()-interval '23 hours'",
      [reportId],
    );
    // Provider idempotency lasts 24 hours. Never retry an ambiguous old send with a fresh key.
    const result = await this.db.query(
      "UPDATE institution_mail SET state='sending',attempts=attempts+1,updated_at=now(),error=NULL WHERE report_id=$1 AND attempts<3 AND created_at>now()-interval '23 hours' AND (state IN ('queued','failed') OR (state='sending' AND updated_at<now()-interval '2 minutes')) AND delivery_id IN (SELECT id FROM institution_case WHERE report_id=$1 AND state<>'returned') RETURNING *",
      [reportId],
    );
    for (const mail of result.rows) {
      try {
        const input = {
          from: process.env.MAIL_FROM || "KentBağ <bildirim@lollore.com>",
          to: mail.recipient,
          subject: mail.subject,
          text: mail.body,
        };
        let providerId: string;
        if (this.transport) providerId = await this.transport(input, mail.id);
        else {
          const response = await new Resend(
            process.env.RESEND_API_KEY,
          ).emails.send(input, { idempotencyKey: mail.id });
          if (response.error || !response.data?.id)
            throw new Error("provider_rejected");
          providerId = response.data.id;
        }
        await this.db.query(
          "UPDATE institution_mail SET state='sent',provider_id=$1,updated_at=now() WHERE id=$2",
          [providerId, mail.id],
        );
      } catch {
        // No provider diagnostics or credentials leak to citizens, logs or the panel.
        await this.db.query(
          "UPDATE institution_mail SET state='failed',error='E-posta sağlayıcısı gönderimi doğrulayamadı. Gönderen alan adı doğrulamasını ve hizmet ayarlarını kontrol edin.',updated_at=now() WHERE id=$1",
          [mail.id],
        );
      }
    }
    return this.list(reportId);
  }
}
