import cors from "@koa/cors"
import Router from "@koa/router"
import hkdf from "@panva/hkdf"
import assert from "assert"
import { jwtDecrypt } from "jose"
import Koa from "koa"

const ENCRYPTION_KEY = hkdf("sha256", process.env.SECRET, "", "NextAuth.js Generated Encryption Key", 32)

type User = {
  email: string
  name: string
  picture: string
}
const router = new Router<Record<string, unknown>, { user?: User }>()

router.get("/", async (ctx: Koa.Context) => {
  ctx.body = { user: ctx.user }
})

const decryptToken = async (ctx: Koa.Context, next: () => Promise<unknown>) => {
  const cookieName = !(!process.env.NEXTAUTH_URL || process.env.NEXTAUTH_URL.startsWith("http://"))
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token"

  try {
    const tokenString = ctx.cookies.get(cookieName)
    assert(tokenString)
    const token = await jwtDecrypt(tokenString, await ENCRYPTION_KEY, { clockTolerance: 15 })
    const { email, name, picture } = token.payload
    ctx.user = { email, name, picture }
  } catch (err) {}
  next()
}

const server = new Koa()
  .use(cors({ credentials: true }))
  .use(decryptToken)
  .use(router.routes())
  .use(router.allowedMethods())
Promise.resolve().then(async () => {
  console.log(`Started codereplay...`)
  server.listen(process.env.PORT || 8888)
})
