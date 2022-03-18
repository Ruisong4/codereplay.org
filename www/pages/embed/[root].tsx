import type { NextPage } from "next"
import { useSession } from "next-auth/react"
import LoginButton from "../../components/LoginButton"
import { useEffect, useState } from "react"
import { TraceSummary } from "@codereplay/types"
import { MultiRecordReplayer } from "@codereplay/ace-recorder"
import { useRouter } from "next/router"
import dynamic from "next/dynamic"


const Recorder = dynamic(() => import("../../components/Recorder"), { ssr: false })

const EmbedHome: NextPage = () => {
  const router = useRouter()
  const { root } = router.query
  const { data } = useSession()
  const [source, setSource] = useState<{ trace: MultiRecordReplayer.Content; summary: TraceSummary } | undefined>()

  useEffect(() => {
    if (root === undefined) {
      return
    }
    const getTrace = async () => {
      const trace = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/downloads/${root}.json`).then((r) =>
        r.json()
      )
      const summary = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/info/${root}`).then((r) =>
        r.json()
      )

      setSource({
        summary: summary.trace,
        trace: { ace: trace.trace, audio: `${process.env.NEXT_PUBLIC_API_URL}/downloads/${root}.mp3` },
      })
    }
    getTrace().then()
  }, [root])

  return (
    <>
      {
        source === undefined ? null : <Recorder source={source} isEmbed={true}/>
      }
    </>
  )
}

export default EmbedHome