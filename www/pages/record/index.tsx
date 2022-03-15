import { TraceSummary } from "@codereplay/types"
import { MultiRecordReplayer } from "@codereplay/ace-recorder"
import type { NextPage } from "next"
import { useSession } from "next-auth/react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useState } from "react"
import { Array } from "runtypes"
import LoginButton from "../../components/LoginButton"

const Recorder = dynamic(() => import("../../components/Recorder"), { ssr: false })

const RecordHome: NextPage = () => {


  return (
    <>
      <LoginButton />
      <Recorder source={undefined}/>
    </>
  )
}

export default RecordHome
