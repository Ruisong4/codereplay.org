import type { NextPage } from "next"
import { useSession } from "next-auth/react"
import dynamic from "next/dynamic"
import { useCallback, useEffect } from "react"
import LoginButton from "../components/LoginButton"
import { uploadTrace } from "../lib/uploader"

const Recorder = dynamic(() => import("../components/Recorder"), { ssr: false })

const Home: NextPage = () => {
  const { data } = useSession()
  useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_API_URL, { credentials: "include" })
      .then((r) => r.json())
      .then((response) => {
        console.log(response)
      })
  }, [data])

  const testUpload = useCallback(() => {
    uploadTrace({ test: "me" }, new ArrayBuffer(1024 * 1024 * 32), (loaded) => console.log(loaded))
  }, [])

  return (
    <>
      <LoginButton />
      <button onClick={testUpload}>Test Upload</button>
      <Recorder />
    </>
  )
}

export default Home
