import type { NextPage } from "next"
import TopBanner from "../../components/TopBanner"
import { useEffect, useState } from "react"
import { RecordingSummaryWithUser } from "@codereplay/types"
import { MultiRecordReplayer } from "@codereplay/ace-recorder"
import { useRouter } from "next/router"
import dynamic from "next/dynamic"
import { findRecording, getSavedTrace } from "../../api/api"


const Recorder = dynamic(() => import("../../components/Recorder"), { ssr: false })

/**
 * This page catches /replay/fileRoot and replay the recording with fileRoot
 * */
const ReplayHome: NextPage = () => {
  const router = useRouter()
  const { root } = router.query
  const [source, setSource] = useState<{ trace: MultiRecordReplayer.Content; summary: RecordingSummaryWithUser } | undefined>()

  useEffect(() => {
    if (root === undefined || !router.isReady) {
      return
    }
    const getTrace = async () => {
      const trace = await getSavedTrace(Number(root))
      const summary = await findRecording(Number(root))
      setSource({
        summary: summary,
        trace: { ace: trace.trace, audio: `${process.env.NEXT_PUBLIC_API_URL}/downloads/${root}.mp3` }
      })
    }
    getTrace().then().catch(_ => location.href = "/recordings")
  }, [root, router.isReady])

  return (
    <>
      <TopBanner />
      {
        source === undefined ? null :
          <Recorder source={source} isEmbed={false} forkFromSource={false}/>
      }
    </>
  )
}

export default ReplayHome