import { MultiRecordReplayer } from "@cs124/ace-recorder"
import type { NextPage } from "next"
import { useSession } from "next-auth/react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useState } from "react"
import { Array } from "runtypes"
import { TraceSummary } from "types.codereplay.org"
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

  const [source, setSource] = useState<MultiRecordReplayer.Content | undefined>()
  const getTrace = useCallback(async (trace: TraceSummary) => {
    const aceTrace = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/downloads/${trace.fileRoot}.json`).then((r) =>
      r.json()
    )
    setSource({ ace: aceTrace.trace, audio: `${process.env.NEXT_PUBLIC_API_URL}/downloads/${trace.fileRoot}.mp3` })
  }, [])

  return (
    <>
      <LoginButton />
      {data && <Recorder source={source} />}
      {traces.map((trace, key) => (
        <button onClick={() => getTrace(trace)} key={key}>
          {trace.email} {trace.timestamp} ({trace.mode})
        </button>
      ))}
    </>
  )
}

export default Home
