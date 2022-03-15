import { SavedTrace, TraceSummary, UploadedTrace } from "@codereplay/types"
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
import ratelimit from "koa-ratelimit"
import { MongoClient as mongo } from "mongodb"
import mongodbUri from "mongodb-uri"
import { String } from "runtypes"

const fetch = retryBuilder(originalFetch)

const client = mongo.connect(process.env.MONGODB as string)
const database = client.then((c) => c.db(mongodbUri.parse(String.check(process.env.MONGODB)).database))
const playgroundCollection = database.then((d) => d.collection(process.env.MONGODB_COLLECTION || "playground"))
const traceCollection = database.then((d) => d.collection(process.env.MONGODB_COLLECTION || "trace"))

const ENCRYPTION_KEY = hkdf("sha256", process.env.SECRET, "", "NextAuth.js Generated Encryption Key", 32)
const VALID_DOMAINS = process.env.VALID_DOMAINS?.split(",").map((s) => s.trim())

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

const started = new Date()
let playgroundCount = 0
router.get("/", async (ctx: Context) => {
  ctx.body = { what: "api.codereplay.org", started, playgroundCount }
})

const processUpload = async (ctx: Context) => {
  const collection = await traceCollection
  const now = new Date()
  const files = ctx.request.files as { [key: string]: File[] }

  try {
    const traceFile = files["trace"][0].path

    const trace = UploadedTrace.check(JSON.parse((await fs.readFile(traceFile)).toString()))
    ctx.assert(Math.abs(trace.trace.code.duration - trace.trace.output.duration) <= 100, 400)

    const metadataFile = files["metadata"][0].path
    const metadata = JSON.parse((await fs.readFile(metadataFile)).toString())

    console.log(metadata)

    const audioRoot = `/downloads/${now.valueOf()}`
    const audioInputFile = files["audio"][0].path
    await exec(`ffmpeg -i ${audioInputFile} ${audioRoot}.webm`)
    await exec(`ffmpeg -i ${audioInputFile} ${audioRoot}.mp4`)
    await exec(`ffmpeg -i ${audioInputFile} ${audioRoot}.mp3`)

    await fs.writeFile(
      `/downloads/${now.valueOf()}.json`,
      JSON.stringify(SavedTrace.check({ timestamp: now, ...trace }))
    )
    console.log(ctx.user?.picture)
    await collection.insertOne(
      TraceSummary.check({
        email: ctx.email,
        mode: trace.mode,
        duration: trace.trace.code.duration,
        fileRoot: now.valueOf(),
        timestamp: now,
        picture: ctx.user?.picture,
        name: ctx.user?.name,
        title: metadata.title,
        tag: metadata.tag,
        description: metadata.description
      })
    )
  } catch (err) {
    console.log(err)
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
    {
      name: "metadata",
      maxCount: 1,
    }
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

router.get("/info/:fileRoot", async (ctx: Context) => {
  const collection = await traceCollection

  const url =  ctx.request.url.split("/")
  console.log(url[url.length-1])
  const trace = await collection.findOne({
    "fileRoot": Number(url[url.length-1])
  })

  delete (trace as any)._id

  ctx.body = { trace }
})

router.post("/playground", async (ctx: Context) => {
  const start = new Date()
  const collection = await playgroundCollection
  const request = Submission.check(ctx.request.body)
  playgroundCount++
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
      payload: { name, email, picture },
    } = await jwtDecrypt(token, encryptionKey, { clockTolerance: 15 })
    ctx.user = { name, email, picture }
    ctx.email = email
  }
  await next()
}

const db = new Map()
const server = new Koa({ proxy: true })
  .use(
    cors({
      origin: (ctx) => {
        if (
          !ctx.headers.origin ||
          (VALID_DOMAINS &&
            !VALID_DOMAINS.includes(ctx.headers.origin) &&
            !VALID_DOMAINS.includes(ctx.headers.origin.split(".").slice(-2).join(".")))
        ) {
          return ""
        } else {
          return ctx.headers.origin
        }
      },
      maxAge: 86400,
      credentials: true,
    })
  )
  .use(
    ratelimit({
      driver: "memory",
      db: db,
      duration: process.env.RATE_LIMIT_MS ? parseInt(process.env.RATE_LIMIT_MS) : 100,
      headers: {
        remaining: "Rate-Limit-Remaining",
        reset: "Rate-Limit-Reset",
        total: "Rate-Limit-Total",
      },
      max: 1,
      whitelist: (ctx) => ctx.request.method === "GET",
    })
  )
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
  playgroundCount = await (await playgroundCollection).countDocuments()
  server.listen(process.env.PORT || 8888)
})
