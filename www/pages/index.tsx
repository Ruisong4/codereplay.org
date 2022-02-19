import { TraceSummary } from "@codereplay/types"
import { MultiRecordReplayer } from "@codereplay/ace-recorder"
import type { NextPage } from "next"
import { useSession } from "next-auth/react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useState } from "react"
import { Array } from "runtypes"
import LoginButton from "../components/LoginButton"

const Recorder = dynamic(() => import("../components/Recorder"), { ssr: false })

const Home: NextPage = () => {
  const { data } = useSession()

  const [traces, setTraces] = useState<TraceSummary[]>([])

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/traces`, { credentials: "include" })
      .then((r) => r.json())
      .then((response) => {
        setTraces(Array(TraceSummary).check(response.traces))
      })
  }, [data])

  const [source, setSource] = useState<{ trace: MultiRecordReplayer.Content; summary: TraceSummary } | undefined>()
  const getTrace = useCallback(async (summary: TraceSummary) => {
    const trace = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/downloads/${summary.fileRoot}.json`).then((r) =>
      r.json()
    )
    setSource({
      summary,
      trace: { ace: trace.trace, audio: `${process.env.NEXT_PUBLIC_API_URL}/downloads/${summary.fileRoot}.mp3` },
    })
  }, [])

  return (
    <>
      <LoginButton />
      <Recorder source={source} />
      {traces.map((trace, key) => (
        <div key={key}>
          <a onClick={() => getTrace(trace)}>
            {trace.email} {trace.timestamp} ({trace.mode})
          </a>
        </div>
      ))}
    </>
  )
}

export default Home
