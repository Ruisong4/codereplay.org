import { InstanceOf, Number, Record, Static, String } from "runtypes"
import { AceTraceContent } from "@cs124/ace-recorder-types"

export const TraceSummary = Record({
  email: String,
  mode: String,
  duration: Number,
  fileRoot: Number,
  timestamp: InstanceOf(Date).Or(String),
})
export type TraceSummary = Static<typeof TraceSummary>

export const UploadedTrace = Record({
  mode: String,
  trace: Record({
    code: AceTraceContent,
    output: AceTraceContent,
  }),
})
export type UploadedTrace = Static<typeof UploadedTrace>

export const SavedTrace = UploadedTrace.And(
  Record({
    timestamp: InstanceOf(Date),
  })
)
export type SavedTrace = Static<typeof SavedTrace>