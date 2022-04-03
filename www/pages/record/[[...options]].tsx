import type { NextPage } from "next"
import dynamic from "next/dynamic"
import LoginButton from "../../components/LoginButton"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { MultiRecordReplayer } from "@codereplay/ace-recorder"
import { TraceSummary } from "@codereplay/types"

const Recorder = dynamic(() => import("../../components/Recorder"), { ssr: false })

const RecordHome: NextPage = () => {

  const router = useRouter()
  const { options } = router.query

  const [source, setSource] = useState<{ trace: MultiRecordReplayer.Content; summary: TraceSummary } | undefined>()

  useEffect(() => {
    if (options === undefined || options[0] !== "fork") {
      return
    }
    const forkFrom = options[1]
    const getTrace = async () => {

      const trace = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/downloads/${forkFrom}.json`).then((r) =>
        r.json()
      )

      const summary = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/info/${forkFrom}`).then((r) =>
        r.json()
      )

      console.log(summary)
      setSource({
        summary: summary.trace,
        trace: { ace: trace.trace, audio: `${process.env.NEXT_PUBLIC_API_URL}/downloads/${forkFrom}.mp3` },
      })
    }
    getTrace().then()
  }, [options])

  return (
    <>
      <LoginButton />
      <Recorder source={source} isEmbed={false} forkFromSource={source !== undefined} includeForks={false}/>
    </>
  )
}

export default RecordHome
