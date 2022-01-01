declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SECRET: string
      SECURE_COOKIE: any
    }
  }
}
export {}
