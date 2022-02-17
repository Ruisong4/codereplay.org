import { Result, Submission } from "@cs124/playground-types"
import cors from "@koa/cors"
import multer, { File } from "@koa/multer"
import Router from "@koa/router"
import hkdf from "@panva/hkdf"
import { exec } from "child-process-promise"
import del from "del"
import retryBuilder from "fetch-retry"
import fs from "fs/promises"
import originalFetch from "isomorphic-fetch"
import { jwtDecrypt } from "jose"
import Koa, { DefaultContext, DefaultState, ParameterizedContext } from "koa"
import koaBody from "koa-body"
import logger from "koa-logger"
import { String } from "runtypes"
const fetch = retryBuilder(originalFetch)

const ENCRYPTION_KEY = hkdf("sha256", process.env.SECRET, "", "NextAuth.js Generated Encryption Key", 32)

type User = {
  email: string
  name: string
  picture: string
}
type Context = ParameterizedContext<
  DefaultState,
  DefaultContext & {
    user?: User
  }
>
const router = new Router<Context>()

router.get("/", async (ctx: Context) => {
  ctx.body = { user: ctx.user }
})

const processUpload = async (ctx: Context) => {
  const now = Date.now()
  const files = ctx.request.files as { [key: string]: File[] }

  try {
    const audioRoot = `/downloads/${now}`
    const audioInputFile = files["audio"][0].path
    await exec(`ffmpeg -i ${audioInputFile} ${audioRoot}.webm`)
    await exec(`ffmpeg -i ${audioInputFile} ${audioRoot}.mp4`)

    const traceFile = files["trace"][0].path
    await fs.copyFile(traceFile, `/downloads/${now}.json`)
  } catch (err) {
    await del([`/downloads/${now}*`])
  } finally {
    for (const key of Object.keys(files)) {
      for (const { path } of files[key]) {
        try {
          await fs.unlink(path)
        } catch (err) {}
      }
    }
  }
}

const upload = multer({ dest: "/uploads/" })
router.post(
  "/upload",
  upload.fields([
    {
      name: "trace",
      maxCount: 1,
    },
    {
      name: "audio",
      maxCount: 1,
    },
  ]),
  async (ctx: Koa.Context) => {
    processUpload(ctx)
    ctx.body = {}
  }
)

const PLAYGROUND_SERVER = String.check(process.env.PLAYGROUND_SERVER)

router.post("/playground", async (ctx) => {
  // const start = new Date()
  // const collection = await _collection
  console.log(ctx.request.body)
  const request = Submission.check(ctx.request.body)
  request.timeout = 8000
  let response
  try {
    response = await fetch(PLAYGROUND_SERVER, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }).then(async (r) => {
      if (r.status === 200) {
        return Result.check(await r.json())
      } else {
        throw await r.text()
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    /*
    collection?.insertOne({
      succeeded: false,
      ...request,
      start,
      end: new Date(),
      ip: ctx.request.ip,
      err,
      ...(ctx.email && { email: ctx.email }),
      ...(ctx.headers.origin && { origin: ctx.headers.origin }),
    })
    */
    return ctx.throw(400, err.toString())
  }
  console.log(response)
  ctx.body = response
  /*
  collection?.insertOne({
    succeeded: true,
    ...response,
    start,
    end: new Date(),
    ip: ctx.request.ip,
    ...(ctx.email && { email: ctx.email }),
    ...(ctx.headers.origin && { origin: ctx.headers.origin }),
  })
  */
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const decryptToken = async (ctx: Koa.Context, next: () => Promise<any>) => {
  const cookieName = process.env.SECURE_COOKIE ? "__Secure-next-auth.session-token" : "next-auth.session-token"
  const token = ctx.cookies.get(cookieName)
  if (token) {
    const encryptionKey = await ENCRYPTION_KEY
    const {
      payload: { name, email },
    } = await jwtDecrypt(token, encryptionKey, { clockTolerance: 15 })
    ctx.user = { name, email }
  }
  await next()
}

const server = new Koa()
  .use(logger())
  .use(
    cors({
      origin: (ctx) => ctx.headers.origin!,
      maxAge: 86400,
      credentials: true,
    })
  )
  .use(decryptToken)
  .use(koaBody({ jsonLimit: "8mb" }))
  .use(router.routes())
  .use(router.allowedMethods())

Promise.resolve().then(async () => {
  console.log(`Started codereplay...`)
  server.listen(process.env.PORT || 8888)
})
