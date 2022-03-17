import type { NextPage } from "next"
import dynamic from "next/dynamic"
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
