import NextAuth from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export default NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: process.env.SECRET,
  /*
  ...(process.env.NODE_ENV !== "development" && {
    cookies: {
      sessionToken: {
        name: "__Secure-next-auth.session-token",
        options: {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          // domain: process.env.COOKIE_DOMAIN,
          secure: true,
        },
      },
    },
  }),
  */
})
