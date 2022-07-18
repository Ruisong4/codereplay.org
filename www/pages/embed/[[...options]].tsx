import type { NextPage } from "next"
import { useCallback, useEffect, useState } from "react"
// @ts-ignore
import { RecordingSummaryWithUser, TraceSummary } from "@codereplay/types"
import { MultiRecordReplayer } from "@codereplay/ace-recorder"
import { useRouter } from "next/router"
import dynamic from "next/dynamic"
import { Avatar, Box } from "@mui/material"
import { getRecordingsByParent, getSavedTrace } from "../../api/api"


const Recorder = dynamic(() => import("../../components/Recorder"), { ssr: false })

const EmbedHome: NextPage = () => {
  const router = useRouter()
  const { options } = router.query
  const [source, setSource] = useState<{ trace: MultiRecordReplayer.Content; summary: RecordingSummaryWithUser } | undefined>()
  const [traces, setTraces] = useState<RecordingSummaryWithUser[]>([])

  const getTrace = useCallback(async (summary: RecordingSummaryWithUser) => {
    const trace = await getSavedTrace(summary.fileRoot)
    setSource({
      summary,
      trace: { ace: trace.trace, audio: `${process.env.NEXT_PUBLIC_API_URL}/downloads/${summary.fileRoot}.mp3` },
    })
  }, [])
  
  useEffect(() => {
    if (options === undefined || !router.isReady) {
      return
    }

    const validGroup = options.length == 2 ? options[1] : null
    getRecordingsByParent(options[0], options.length == 2, validGroup, -1).then(fetchedTraces => {
      setTraces(fetchedTraces)
      getTrace(fetchedTraces[0]).then()
    })

  }, [getTrace, options, router.isReady])

  return (
    <>
      {
        source === undefined ? null : <Recorder source={source} isEmbed={true} forkFromSource={false}/>
      }
      {
        <Box sx={{
          display: "flex",
          flexDirection: "row",
          maxHeight: "50px",
          height: "50px",
          mt: "10px",
          overflowX: "auto",
          overflowY: "hidden",
          scrollbarWidth: "none",
          msOverflowStyle: "none"
        }}>
          {traces.map((t, i) => {
            return <Avatar key={i} onClick={() => getTrace(t)} alt="U" sx={{width: "50px", height: "50px", mr:"5px"}} src={t.picture}/>
          })}
        </Box>
      }
    </>
  )
}

export default EmbedHome