import nodemailer from "nodemailer";
import { config } from "./config.js";

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  requireTLS: config.SMTP_PORT === 587,
  auth: {
    user: config.SMTP_USER,
    pass: config.SMTP_PASSWORD,
  },
});

export async function sendAccountEmail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  await transporter.sendMail({
    from: config.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });
}

export async function verifyMailTransport(): Promise<void> {
  await transporter.verify();
}
