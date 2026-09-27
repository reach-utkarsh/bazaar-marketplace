import { logger } from '../../lib/logger.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

/** Transport-agnostic email interface. Swap ConsoleEmailService for an SMTP/SES adapter in production. */
export interface EmailService {
  send(message: EmailMessage): Promise<void>;
}

export class ConsoleEmailService implements EmailService {
  public readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<void> {
    this.sent.push(message);
    if (this.sent.length > 200) this.sent.shift();
    logger.info(
      `\n📧 ─── EMAIL (console transport) ───\nTo:      ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n────────────────────────────────`,
    );
  }
}

export const emailService: EmailService & { sent?: EmailMessage[] } = new ConsoleEmailService();

/** Fire-and-forget: notification failures must never break the business operation. */
export function notify(message: EmailMessage): void {
  emailService.send(message).catch((err) => logger.error('Failed to send email', err));
}
