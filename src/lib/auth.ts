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
          // Basic scopes only by default — Gmail scopes are requested separately in signup step 4.
          // When connecting Gmail, signIn() is called with the full scope list overriding this.
          scope: "openid email profile",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],

  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        const scope = (account.scope as string | undefined) ?? "";
        const hasGmail = scope.includes("gmail");
        const profileEmail = typeof profile?.email === "string" ? profile.email : undefined;

        token.provider = account.provider;
        if (!token.dbUserId) {
          token.dbUserId = profileEmail ?? (token.email as string) ?? "";
        }

        const googleIdToken =
          (account as { id_token?: string; idToken?: string }).id_token ??
          (account as { id_token?: string; idToken?: string }).idToken;
        if (account.provider === "google" && googleIdToken) {
          token.googleIdToken = googleIdToken;
        }

        if (hasGmail) {
          // Full Gmail sign-in — replace tokens with Gmail-scoped ones
          token.accessToken = account.access_token;
          token.refreshToken = account.refresh_token ?? token.refreshToken;
          token.expiresAt = account.expires_at ?? 0;
          token.scope = scope;
        } else {
          // Basic sign-in — only populate tokens if not already set
          if (!token.accessToken) {
            token.accessToken = account.access_token;
            token.refreshToken = account.refresh_token;
            token.expiresAt = account.expires_at ?? 0;
          }
          if (!token.scope) token.scope = scope;
        }

        return token;
      }

      // Only refresh tokens when we have Gmail scope — basic tokens don't need it
      const scope = (token.scope as string | undefined) ?? "";
      if (!scope.includes("gmail")) return token;

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
      const scope = (token.scope as string | undefined) ?? "";
      session.gmailConnected =
        token.provider === "google" &&
        !!token.accessToken &&
        !token.error &&
        scope.includes("gmail");
      session.error = token.error as string | undefined;
      return session;
    },
  },

  pages: { signIn: "/" },
});
