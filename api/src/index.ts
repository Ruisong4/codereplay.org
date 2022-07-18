import { Result, Submission } from "@cs124/playground-types"
import {
  SavedTrace,
  UploadedTrace,
  User,
  RecordingSummary,
  RecordingGroup,
  RecordingSummaryWithUser, ClientTraceMetadata, PendingRecord, PendingRecordWithUser
} from "@codereplay/types"
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
import { v4 as uuidv4 } from "uuid"

/** Playground backend server. */
const PLAYGROUND_SERVER = String.check(process.env.PLAYGROUND_SERVER)

/** Define encryption key user by next login. */
const ENCRYPTION_KEY = hkdf("sha256", process.env.SECRET, "", "NextAuth.js Generated Encryption Key", 32)

/** Define a list of valid origin, if none, open to all. */
const VALID_DOMAINS = process.env.VALID_DOMAINS?.split(",").map((s) => s.trim())

/** Storage memory used by rate limit middleware. */
const rateLimitOptionsDB = new Map()

/** Add retry functionality to fetch api package in case of network issue. */
const fetch = retryBuilder(originalFetch)

/** Middleware to handle "multi=part/form-data". */
const upload = multer({ dest: "/uploads/" })

/** Connect to MongoDB and create a new database. */
const client = mongo.connect(process.env.MONGODB as string)
const database = client.then((c) => c.db(mongodbUri.parse(String.check(process.env.MONGODB)).database))

/** Collection that stores all submissions, failed or successes. */
const PlaygroundCollection = database.then((d) => d.collection("playground"))

/** Collection that stores trace information. [TraceSummary] */
const RecordingSummaryCollection = database.then((d) => d.collection("recording"))

/** Collection that stores all grouping information. */
const GroupCollection = database.then((d) => d.collection("group"))

/** Collection that stores all user information. [User] */
const UserCollection = database.then((d) => d.collection("user"))

/** Collection of pending recording */
const PendingCollection = database.then((d) => d.collection("pending"))

/** Define a new [Router] */
const router = new Router<Context>()

/** The server start time. */
const started = new Date()

/** Number of submissions we got. */
let playgroundCount = 0

/** Define context type = default Context with email and User. */
type Context = ParameterizedContext<DefaultState,
  DefaultContext & {
  email?: string
  user?: User
}>

/** Server info route, no actual meaning. */
router.get("/", async (ctx: Context) => {
  ctx.body = { what: "api.codereplay.org", started, playgroundCount }
})
/**
 * Process an upload request.
 * This function convert audio source to different format.
 * Write converted audio and trace (JSON format) to download directory.
 * @param ctx the request context object.
 * @param requestTime the moment we received the request.
 * @return processingStatus "failed" if catch any error, "success" otherwise
 */
const processAudioAndTrace = async (ctx: Context, requestTime: Date): Promise<string> => {
  const groupCollection = await GroupCollection
  const recordingSummaryCollection = await RecordingSummaryCollection

  const uploadedFiles = ctx.request.files as { [key: string]: File[] }
  let processingResult = "success"
  try {
    const uploadedTracePath = uploadedFiles["trace"][0].path
    const uploadedTrace = UploadedTrace.check(JSON.parse((await fs.readFile(uploadedTracePath)).toString()))

    const uploadedMetadata = uploadedFiles["metadata"][0].path
    const clientSideMeta = JSON.parse((await fs.readFile(uploadedMetadata)).toString())

    if (Math.abs(uploadedTrace.trace.code.duration - uploadedTrace.trace.output.duration) > 100) {
      processingResult = "failed"
    } else {
      const audioRoot = `/downloads/${requestTime.valueOf()}`
      const audioRawInputFile = uploadedFiles["audio"][0].path
      await exec(`ffmpeg -i ${audioRawInputFile} ${audioRoot}.webm`)
      await exec(`ffmpeg -i ${audioRawInputFile} ${audioRoot}.mp4`)
      await exec(`ffmpeg -i ${audioRawInputFile} ${audioRoot}.mp3`)

      await fs.writeFile(
        `/downloads/${requestTime.valueOf()}.json`,
        JSON.stringify(SavedTrace.check({ timestamp: requestTime, ...uploadedTrace }))
      )

      const metadata = ClientTraceMetadata.check(clientSideMeta)
      const uploaderGroups = (await groupCollection.find({
        "email": ctx.email
      }).toArray()).map((g) => {
        return g.groupId as string
      })

      await recordingSummaryCollection.insertOne(RecordingSummary.check({
          email: ctx.email,
          mode: uploadedTrace.mode,
          duration: uploadedTrace.trace.code.duration,
          timestamp: requestTime,
          title: metadata.title,
          tag: metadata.tag,
          description: metadata.description,
          showFiles: metadata.showFiles,
          containerHeight: metadata.containerHeight,
          userGroups: uploaderGroups,
          forkedFrom: metadata.forkedFrom ? metadata.forkedFrom : requestTime.valueOf(),
          fileRoot: requestTime.valueOf()
        }
      ))
    }

  } catch (err) {
    console.log(err)
    await del([`/downloads/${requestTime}*`])
    processingResult = "failed"
  } finally {
    for (const key of Object.keys(uploadedFiles)) {
      for (const { path } of uploadedFiles[key]) {
        try {
          await fs.unlink(path)
        } catch (err) {
          console.log("failed in unlink files")
        }
      }
    }
  }
  return processingResult
}

/** post route that confirm a failed recording, marking it as confirmed */
router.post("/confirm/:fileRoot", async (ctx: Context) => {
  const pendingCollection = await PendingCollection
  pendingCollection.findOneAndUpdate({
    fileRoot: Number(ctx.params.fileRoot),
    email: ctx.email
  }, {
    $set: {
      processingStatus: "confirmed"
    }
  }).then()
  ctx.body = {}
})

/**
 * Insert a pending record while we are processing the video.
 * @param ctx the request context object.
 * @return Date object represent the request time or null if an error occurs.
 */
const insertPendingRecord = async (ctx: Context): Promise<Date | null> => {
  const pendingCollection = await PendingCollection

  const requestTime = new Date()
  const uploadedFiles = ctx.request.files as { [key: string]: File[] }

  try {
    const uploadedMetadata = uploadedFiles["metadata"][0].path
    const clientSideMeta = ClientTraceMetadata.check(JSON.parse((await fs.readFile(uploadedMetadata)).toString()))

    await pendingCollection.insertOne(PendingRecord.check({
      description: clientSideMeta.description,
      title: clientSideMeta.title,
      tag: clientSideMeta.tag,
      fileRoot: requestTime.valueOf(),
      processingStatus: "processing",
      email: ctx.email
    }))

  } catch (err) {
    console.log(err)
    return null
  }
  return requestTime
}

/**
 * Callback that update the processingStatus of a metadata record after processAudioAndTrace.
 * @param status "failed" or "success", returned by processAudioAndTrace.
 * @param fileRoot the fileRoot used by this submission.
 */
const changeUploadProcessingStatus = async (status: string, fileRoot: number): Promise<void> => {
  const pendingCollection = await PendingCollection

  // success record can be removed safely, failed ones will stay there for notification and logging purpose.
  if (status == "success") {
    await pendingCollection.findOneAndDelete({
      fileRoot: fileRoot
    })
  } else {
    await pendingCollection.findOneAndUpdate({
      fileRoot: fileRoot
    }, {
      $set: { processingStatus: status }
    })
  }
}

/**
 * A Post route that handles recording upload.
 */
router.post(
  "/upload",
  upload.fields([
    {
      name: "trace",
      maxCount: 1
    },
    {
      name: "audio",
      maxCount: 1
    },
    {
      name: "metadata",
      maxCount: 1
    }
  ]),
  async (ctx: Context) => {
    ctx.assert(ctx.email, 401, "Missing Uploader Credential")
    const requestTime = await insertPendingRecord(ctx)
    if (requestTime == null) {
      ctx.throw("something went wrong", 400)
    }
    processAudioAndTrace(ctx, requestTime).then(status => changeUploadProcessingStatus(status, requestTime.valueOf()))
    ctx.body = {
      fileRoot: requestTime!.valueOf()
    }
  }
)

/**
 * A post route that try to update the user table using the current login info.
 * This Route update the name/picture associated with an email address.
 */
router.post("/user", async (ctx: Context) => {
  ctx.assert(ctx.email, 401, "User not logged in")
  const userCollection = await UserCollection
  try {
    await userCollection.updateOne({ email: ctx.email }, { $set: ctx.user }, { upsert: true })
  } catch (err) {
    console.log(err)
    ctx.throw(500, "login status on server is not correct.")
  }
  ctx.body = {}
})

/**
 * A post route that create a new recording group for the current user.
 * @return the newly created group
 */
router.post("/recording_group", async (ctx: Context) => {
  ctx.assert(ctx.email, 403, "only logged in user can create group")
  const groupCollection = await GroupCollection

  const newGroup = {
    role: "creator",
    groupId: uuidv4(),
    email: ctx.email,
    active: true,
    name: ctx.request.body.name
  }

  await groupCollection.insertOne(RecordingGroup.check(newGroup))
  ctx.body = { newGroup }
})

/** A post route that modifies the active status of a group */
router.post("/update_group/:id/:status", async (ctx: Context) => {
  ctx.assert(ctx.email, 403, "only logged in user can create group")
  const groupCollection = await GroupCollection
  const status = ctx.params.status === 'true'
  groupCollection.findOneAndUpdate({
    email: ctx.email,
    role: "creator",
    groupId: ctx.params.id
  }, { $set: { active: status } }).then()

  ctx.body = {}
})

/**
 * A get route that returns all the recording groups that the current user is in.
 * @return an array of RecordingGroup
 */
router.get("/recording_group", async (ctx: Context) => {
  ctx.assert(ctx.email, 403, "Not logged in")
  const groupCollection = await GroupCollection
  const groups = (await groupCollection.find({
    "email": ctx.email
  }).toArray()).map((g) => {
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    delete (g as any)._id
    return g
  })
  ctx.body = { groups }
})

/**
 * A post route that insert a group record, indicating the current user joined the group.
 * @return the newly joined group
 */
router.post("/join_group", async (ctx: Context) => {
  ctx.assert(ctx.email, 403, "Must login to join a group")
  const groupCollection = await GroupCollection
  const groupId = ctx.request.body.groupId.trim()

  const currStatus = await groupCollection.findOne({
    email: ctx.email,
    groupId: groupId
  })

  ctx.assert(!currStatus, 400, "already a member")

  const targetGroup = await groupCollection.findOne({ groupId: groupId })
  ctx.assert(targetGroup, 400, "group does not exist")
  ctx.assert(targetGroup.active, 400, "Group is not active")

  const newGroup = {
    role: "member",
    groupId: groupId,
    email: ctx.email,
    active: true,
    name: targetGroup.name
  }
  await groupCollection.insertOne(RecordingGroup.check(newGroup))
  ctx.body = { newGroup }
})


const getUserInfo = async (email: string): Promise<User> => {
  const userCollection = await UserCollection
  const user = await userCollection.findOne({ email: email })
  if (user == null) {
    const fakeUser = {
      email: email,
      picture: "",
      name: "Unknown User"
    }
    return User.check(fakeUser)
  }
  delete (user as any)._id
  return User.check(user)
}

/** A get route that returns all the pending recording for this current user. */
router.get("/recordings/pending", async (ctx: Context) => {
  const pendingCollection = await PendingCollection
  if (ctx.email) {
    const user = await getUserInfo(ctx.email)
    const pendingRecordings = (await pendingCollection.find({
      $or: [{ processingStatus: "failed" }, { processingStatus: "processing" }]
    }).toArray()).map((t) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (t as any)._id
      return PendingRecordWithUser.check({ ...t, ...user })
    })
    ctx.body = { pendingRecordings }
  } else {
    ctx.body = { pendingRecordings: [] }
  }
})

/** A get route that returns all recording filtered by a query and with pagination */
router.get("/recordings/search/:query/:page", async (ctx: Context) => {
  const recordingSummaryCollection = await RecordingSummaryCollection
  const query = JSON.parse(decodeURIComponent(ctx.params.query))
  const page = Number(ctx.params.page)
  const limit = 10
  const skip = (page - 1) * limit
  let filteredByQuery = recordingSummaryCollection.find(query).sort({ fileRoot: -1, _id: 1 })
  if (page !== -1) {
    filteredByQuery = filteredByQuery.skip(skip).limit(limit)
  }
  const recordings = await Promise.all((await filteredByQuery.toArray()).map(async (t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (t as any)._id
    const user = await getUserInfo(t.email)
    return RecordingSummaryWithUser.check({ ...t, ...user })
  }))
  ctx.body = { recordings }
})



/** A Get route that returns a single recording's information based on fileRoot */
router.get("/recordings/find/:fileRoot", async (ctx: Context) => {
  const recordingSummaryCollection = await RecordingSummaryCollection
  const recording = await recordingSummaryCollection.findOne({ fileRoot: Number(ctx.params.fileRoot) })
  delete (recording as any)._id
  const user = await getUserInfo(recording?.email)
  ctx.body = { recording: { ...user, ...recording } }
})

/**
 * A get route that returns all the number of recordings matching a query.
 * We separate this from the query to avoid counting when not necessary.
 */
router.get("/recordings/count/:query", async (ctx: Context) => {
  const recordingSummaryCollection = await RecordingSummaryCollection
  const query = JSON.parse(decodeURIComponent(ctx.params.query))
  //@TODO not very familiar with mongodb, what is the alternative for count? aggregate?
  const count = await recordingSummaryCollection.find(query).count()
  ctx.body = { count }
})

/**
 * A post route for code run request.
 */
router.post("/playground", async (ctx: Context) => {
  const start = new Date()
  const playgroundCollection = await PlaygroundCollection
  const request = Submission.check(ctx.request.body)
  playgroundCount++
  request.timeout = 8000
  let response
  try {
    response = await fetch(PLAYGROUND_SERVER, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request)
    }).then(async (r) => {
      if (r.status === 200) {
        return Result.check(await r.json())
      } else {
        throw await r.text()
      }
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (err: any) {
    playgroundCollection?.insertOne({
      type: "submission",
      succeeded: false,
      request,
      start,
      end: new Date(),
      ip: ctx.request.ip,
      err,
      ...(ctx.email && { email: ctx.email }),
      ...(ctx.headers.origin && { origin: ctx.headers.origin })
    }).then()
    return ctx.throw(400, err.toString())
  }
  ctx.body = response
  playgroundCollection?.insertOne({
    type: "submission",
    succeeded: true,
    request,
    response,
    start,
    end: new Date(),
    ip: ctx.request.ip,
    ...(ctx.email && { email: ctx.email }),
    ...(ctx.headers.origin && { origin: ctx.headers.origin })
  }).then()
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const decryptToken = async (ctx: Koa.Context, next: () => Promise<any>) => {
  const cookieName = process.env.SECURE_COOKIE ? "__Secure-next-auth.session-token" : "next-auth.session-token"
  const token = ctx.cookies.get(cookieName)
  if (token) {
    const encryptionKey = await ENCRYPTION_KEY
    const {
      payload: { name, email, picture }
    } = await jwtDecrypt(token, encryptionKey, { clockTolerance: 15 })
    ctx.user = { name, email, picture }
    ctx.email = email
  }
  await next()
}

/** Define the server object with various options */
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
      credentials: true
    })
  )
  .use(
    ratelimit({
      driver: "memory",
      db: rateLimitOptionsDB,
      duration: process.env.RATE_LIMIT_MS ? parseInt(process.env.RATE_LIMIT_MS) : 100,
      headers: {
        remaining: "Rate-Limit-Remaining",
        reset: "Rate-Limit-Reset",
        total: "Rate-Limit-Total"
      },
      max: 1,
      whitelist: (ctx) => ctx.request.method === "GET"
    })
  )
  .use(logger())
  .use(
    cors({
      origin: (ctx) => ctx.headers.origin!,
      maxAge: 86400,
      credentials: true
    })
  )
  .use(decryptToken)
  .use(koaBody({ jsonLimit: "8mb" }))
  .use(router.routes())
  .use(router.allowedMethods())

/** Launch the server. */
Promise.resolve().then(async () => {
  console.log(`Started codereplay...`)
  playgroundCount = await (await PlaygroundCollection).countDocuments()
  server.listen(process.env.PORT || 8888)
})
