import { google } from "googleapis";

export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

export function createOAuthClient(redirectUri?: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri ?? `${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/oauth/callback`
  );
}
