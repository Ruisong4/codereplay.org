import cors from "@koa/cors"
import Router from "@koa/router"
import hkdf from "@panva/hkdf"
import { jwtDecrypt } from "jose"
import Koa from "koa"

const ENCRYPTION_KEY = hkdf("sha256", process.env.SECRET!, "", "NextAuth.js Generated Encryption Key", 32)

type User = {
  email: string
  name: string
}
const router = new Router<Record<string, unknown>, { user?: User }>()

router.get("/", async (ctx: Koa.Context) => {
  ctx.body = { user: ctx.user }
})

const decryptToken = async (ctx: Koa.Context, next: () => Promise<any>) => {
  console.log(ctx.request.header.cookie)

  const cookieName = process.env.SECURE_COOKIE ? "__Secure-next-auth.session-token" : "next-auth.session-token"
  const token = ctx.cookies.get(cookieName)
  if (token) {
    const encryptionKey = await ENCRYPTION_KEY
    const {
      payload: { name, email },
    } = await jwtDecrypt(token, encryptionKey, { clockTolerance: 15 })
    ctx.user = { name, email }
  }

  next()
}

const server = new Koa()
  .use(
    cors({
      origin: (ctx) => {
        return ctx.headers.origin!
      },
      maxAge: 86400,
      credentials: true,
    })
  )
  .use(decryptToken)
  .use(router.routes())
  .use(router.allowedMethods())

Promise.resolve().then(async () => {
  server.listen(process.env.PORT || 8888)
})
