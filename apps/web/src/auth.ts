import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env["AUTH_GITHUB_ID"] ?? "",
      clientSecret: process.env["AUTH_GITHUB_SECRET"] ?? "",
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Persist the GitHub access token to the JWT token on initial sign-in
      if (account?.access_token !== undefined) {
        token["accessToken"] = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      // Copy the access token from JWT to the session object
      if (typeof token["accessToken"] === "string") {
        (session as unknown as Record<string, unknown>)["accessToken"] = token["accessToken"];
      }
      return session;
    },
  },
});
