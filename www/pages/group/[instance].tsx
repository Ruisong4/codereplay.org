import type { NextPage } from "next"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { TraceSummary } from "@codereplay/types"
import { MultiRecordReplayer } from "@codereplay/ace-recorder"
import { useRouter } from "next/router"
import dynamic from "next/dynamic"


const Recorder = dynamic(() => import("../../components/Recorder"), { ssr: false })

const GroupEmbedHome: NextPage = () => {
  const router = useRouter()
  const { instance } = router.query
  const { data } = useSession()

  let [source, setSource] = useState<{ trace: MultiRecordReplayer.Content; summary: TraceSummary } | undefined>()
  let [traces, setTraces] = useState<TraceSummary[]>([])

  useEffect(() => {


  }, [instance])

  return (
    <>
      <Recorder isEmbed={true} source={source} isGroup={true}/>
      <div>

      </div>
    </>
  )
}

export default GroupEmbedHome