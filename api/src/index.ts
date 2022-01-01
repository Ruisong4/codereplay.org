import cors from "@koa/cors"
import Router from "@koa/router"
import hkdf from "@panva/hkdf"
import { jwtDecrypt } from "jose"
import Koa from "koa"

const ENCRYPTION_KEY = hkdf("sha256", process.env.SECRET, "", "NextAuth.js Generated Encryption Key", 32)

type User = {
  email: string
  name: string
}
const router = new Router<Record<string, unknown>, { user?: User }>()

router.get("/", async (ctx: Koa.Context) => {
  ctx.body = { user: ctx.user }
})

const decryptToken = async (ctx: Koa.Context, next: () => Promise<unknown>) => {
  const secureCookie = !(!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.startsWith("http://"))
  const cookieName = secureCookie ? "__Secure-next-auth.session-token" : "next-auth.session-token"
  const token = ctx.cookies.get(cookieName)
  if (token) {
    ctx.user = (await jwtDecrypt(token, await ENCRYPTION_KEY, { clockTolerance: 15 })).payload
  }
  next()
}

new Koa()
  .use(cors({ credentials: true }))
  .use(decryptToken)
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(process.env.PORT || 8888)
