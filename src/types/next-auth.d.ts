import "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    provider?: string;
    userId?: string;
    gmailConnected?: boolean;
    outlookConnected?: boolean;
    error?: string;
  }
}