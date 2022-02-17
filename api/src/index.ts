import { AceTraceContent } from "@cs124/ace-recorder-types"
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
import { MongoClient as mongo } from "mongodb"
import mongodbUri from "mongodb-uri"
import { InstanceOf, Record, String } from "runtypes"
import { TraceSummary } from "types.codereplay.org"

const fetch = retryBuilder(originalFetch)

const client = mongo.connect(process.env.MONGODB as string)
const database = client.then((c) => c.db(mongodbUri.parse(String.check(process.env.MONGODB)).database))
const playgroundCollection = database.then((d) => d.collection(process.env.MONGODB_COLLECTION || "playground"))
const traceCollection = database.then((d) => d.collection(process.env.MONGODB_COLLECTION || "trace"))

const ENCRYPTION_KEY = hkdf("sha256", process.env.SECRET, "", "NextAuth.js Generated Encryption Key", 32)

type User = {
  email: string
  name: string
  picture: string
}
type Context = ParameterizedContext<
  DefaultState,
  DefaultContext & {
    email?: string
    user?: User
  }
>
const router = new Router<Context>()

router.get("/", async (ctx: Context) => {
  ctx.body = { user: ctx.user }
})

const UploadedTrace = Record({
  mode: String,
  trace: Record({
    code: AceTraceContent,
    output: AceTraceContent,
  }),
})
const SavedTrace = UploadedTrace.And(
  Record({
    timestamp: InstanceOf(Date),
  })
)

const processUpload = async (ctx: Context) => {
  const collection = await traceCollection
  const now = new Date()
  const files = ctx.request.files as { [key: string]: File[] }

  try {
    const traceFile = files["trace"][0].path

    const trace = UploadedTrace.check(JSON.parse((await fs.readFile(traceFile)).toString()))
    ctx.assert(Math.abs(trace.trace.code.duration - trace.trace.output.duration) <= 100, 400)

    const audioRoot = `/downloads/${now.valueOf()}`
    const audioInputFile = files["audio"][0].path
    await exec(`ffmpeg -i ${audioInputFile} ${audioRoot}.webm`)
    await exec(`ffmpeg -i ${audioInputFile} ${audioRoot}.mp4`)
    await exec(`ffmpeg -i ${audioInputFile} ${audioRoot}.mp3`)

    await fs.writeFile(
      `/downloads/${now.valueOf()}.json`,
      JSON.stringify(SavedTrace.check({ timestamp: now, ...trace }))
    )
    await collection.insertOne(
      TraceSummary.check({
        email: ctx.email,
        mode: trace.mode,
        duration: trace.trace.code.duration,
        fileRoot: now.valueOf(),
        timestamp: now,
      })
    )
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
  async (ctx: Context) => {
    ctx.assert(ctx.email, 401)
    processUpload(ctx)
    ctx.body = {}
  }
)

const PLAYGROUND_SERVER = String.check(process.env.PLAYGROUND_SERVER)

router.get("/traces", async (ctx: Context) => {
  const collection = await traceCollection

  const traces = (await collection.find({}).toArray()).map((t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (t as any)._id
    return TraceSummary.check(t)
  })

  ctx.body = { traces }
})

router.post("/playground", async (ctx: Context) => {
  const start = new Date()
  const collection = await playgroundCollection
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
    collection?.insertOne({
      type: "submission",
      succeeded: false,
      request,
      start,
      end: new Date(),
      ip: ctx.request.ip,
      err,
      ...(ctx.email && { email: ctx.email }),
      ...(ctx.headers.origin && { origin: ctx.headers.origin }),
    })
    return ctx.throw(400, err.toString())
  }
  ctx.body = response
  collection?.insertOne({
    type: "submission",
    succeeded: true,
    request,
    response,
    start,
    end: new Date(),
    ip: ctx.request.ip,
    ...(ctx.email && { email: ctx.email }),
    ...(ctx.headers.origin && { origin: ctx.headers.origin }),
  })
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
    ctx.email = email
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
