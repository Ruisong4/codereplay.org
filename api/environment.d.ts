declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SECRET: string
      NEXTAUTH_URL: string
    }
  }
}
export {}
