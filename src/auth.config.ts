import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Node-only imports). Used by middleware and extended in auth.ts.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      // /setup is public: it only does anything when no users exist yet
      // (first-run admin creation), and self-disables afterward.
      const isOnSetup = nextUrl.pathname.startsWith("/setup");
      if (isOnSetup) return true;
      if (isOnLogin) {
        // Logged-in users hitting /login get bounced to the dashboard.
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", nextUrl));
        }
        return true;
      }
      // Everything else requires auth.
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  providers: [], // added in auth.ts
} satisfies NextAuthConfig;
