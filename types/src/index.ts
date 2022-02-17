import { InstanceOf, Number, Record, Static, String } from "runtypes"

export const TraceSummary = Record({
  email: String,
  mode: String,
  duration: Number,
  fileRoot: Number,
  timestamp: InstanceOf(Date).Or(String),
})
export type TraceSummary = Static<typeof TraceSummary>
