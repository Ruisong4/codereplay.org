declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SECRET: string
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      SECURE_COOKIE: any
      PLAYGROUND_SERVER: string
    }
  }
}
export {}
