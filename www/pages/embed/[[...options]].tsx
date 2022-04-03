import type { NextPage } from "next"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useState } from "react"
import { TraceSummary } from "@codereplay/types"
import { MultiRecordReplayer } from "@codereplay/ace-recorder"
import { useRouter } from "next/router"
import dynamic from "next/dynamic"
import { Avatar } from "@mui/material"


const Recorder = dynamic(() => import("../../components/Recorder"), { ssr: false })

type Query = {
  $or?: Object[];
  fileRoot?: number;
  forkedFrom?: number;
  userGroups?: string;
}

const EmbedHome: NextPage = () => {
  const router = useRouter()
  const { options } = router.query
  const { data } = useSession()
  const [source, setSource] = useState<{ trace: MultiRecordReplayer.Content; summary: TraceSummary } | undefined>()
  const [traces, setTraces] = useState<TraceSummary[]>([])

  useEffect(() => {
    if (options === undefined) {
      return
    }

    let query: Query = {}
    // only show the original recording
    if (options.length == 1) {
      query["fileRoot"] = Number(options[0])
    } else if (options.length == 2) {
      if (options[1] === "allForks") {
        query["forkedFrom"] = Number(options[0])
      } else {
        query["$or"] = [
          {forkedFrom: Number(options[0]), userGroups: options[1]},{fileRoot: Number(options[0])}
        ]
      }
    }

    fetch(`${process.env.NEXT_PUBLIC_API_URL}/traces/${encodeURIComponent(JSON.stringify(query))}`, {
      credentials: "include"
    })
      .then((r) => r.json())
      .then((response) => {
        console.log(response.traces)
        setTraces(response.traces)
        getTrace(response.traces[0]).then()
      })
  }, [options])

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
      {
        source === undefined ? null : <Recorder source={source} isEmbed={true} forkFromSource={false} includeForks={traces.length > 1}/>
      }
      {
        <div className="embed_forks_list">
          {traces.map((t, i) => {
            return <Avatar key={i} onClick={() => getTrace(t)} alt="U" sx={{width: "50px", height: "50px", mr:"5px"}} src={t.picture}/>
          })}
        </div>
      }
    </>
  )
}

export default EmbedHome