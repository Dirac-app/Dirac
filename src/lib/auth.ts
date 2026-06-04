import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { refreshGoogleToken } from "@/lib/token-refresh";
import { getAuthSecret } from "@/lib/auth-secret";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: getAuthSecret(),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        const profileEmail = typeof profile?.email === "string" ? profile.email : undefined;
        token.dbUserId = profileEmail ?? (token.email as string) ?? "";
        const next = {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: account.expires_at ?? 0,
          provider: account.provider,
        };
        const googleIdToken =
          (account as { id_token?: string; idToken?: string }).id_token ??
          (account as { id_token?: string; idToken?: string }).idToken;
        if (account.provider === "google" && googleIdToken) {
          next.googleIdToken = googleIdToken;
        }
        return next;
      }

      const expiresAt = (token.expiresAt as number) ?? 0;
      if (Date.now() / 1000 < expiresAt - 60) return token;

      if (!token.refreshToken) return { ...token, error: "NoRefreshToken" };

      try {
        const data = await refreshGoogleToken(token.refreshToken as string);
        const newExpiry = Math.floor(Date.now() / 1000) + data.expires_in;

        return {
          ...token,
          accessToken: data.access_token,
          expiresAt: newExpiry,
          refreshToken: data.refresh_token ?? token.refreshToken,
          error: undefined,
        };
      } catch {
        return { ...token, error: "RefreshTokenError" };
      }
    },

    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined;
      session.provider = token.provider as string | undefined;
      if (typeof token.dbUserId === "string") {
        session.userId = token.dbUserId;
      }
      session.gmailConnected =
        token.provider === "google" && !!token.accessToken && !token.error;
      session.error = token.error as string | undefined;
      return session;
    },
  },

  pages: { signIn: "/" },
});
