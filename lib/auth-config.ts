import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * NextAuth.js v5 configuration — replaces Cognito JWT auth.
 *
 * Dev mode: set SKIP_AUTH=true to bypass auth entirely.
 * Production: Google OAuth + Email magic link.
 *
 * Amin will create the Google OAuth app later — just provide the
 * callback URL: {origin}/api/auth/callback/google
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth: session }) {
      // SKIP_AUTH=true bypasses all auth checks
      if (process.env.SKIP_AUTH === "true") return true;
      return !!session?.user;
    },
  },
});
