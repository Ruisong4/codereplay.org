declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NEXTAUTH_URL: string
      SECRET: string
      COOKIE_DOMAIN: string
      GOOGLE_CLIENT_ID: string
      GOOGLE_CLIENT_SECRET: string
      NEXT_PUBLIC_API_URL: string
      NEXT_PUBLIC_ILLINOIS_API_URL: string
    }
  }
}
export {}
