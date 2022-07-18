import type { NextPage } from "next"
import dynamic from "next/dynamic"
import TopBanner from "../../components/TopBanner"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { MultiRecordReplayer } from "@codereplay/ace-recorder"
import { RecordingSummaryWithUser } from "@codereplay/types"
import { findRecording, getSavedTrace } from "../../api/api"

const Recorder = dynamic(() => import("../../components/Recorder"), { ssr: false })

/**
 * This page capture two types of path.
 * 1. /record to start a fresh recording
 * 2. /record/fork/:fileRoot to start a forked recording.
 */
const RecordHome: NextPage = () => {

  const router = useRouter()
  const { options } = router.query

  /** @TODO Check typing, this does not looks correct to me, should be SavedTrace? */
  const [source, setSource] = useState<{ trace: MultiRecordReplayer.Content; summary: RecordingSummaryWithUser } | undefined>()

  useEffect(() => {
    if (options === undefined || options[0] !== "fork") {
      return
    }
    const forkFrom = options[1]
    const getTrace = async () => {

      const trace = await getSavedTrace(Number(forkFrom))
      const summary = await findRecording(Number(forkFrom))

      setSource({
        summary: summary,
        trace: { ace: trace.trace, audio: `${process.env.NEXT_PUBLIC_API_URL}/downloads/${forkFrom}.mp3` },
      })
    }
    getTrace().then().catch(_ => location.href = "/recordings")
  }, [options])

  return (
    <>
      <TopBanner />
      <Recorder source={source} isEmbed={false} forkFromSource={source !== undefined}/>
    </>
  )
}

export default RecordHome
