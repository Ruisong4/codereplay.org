import type { NextPage } from "next"
import { useSession } from "next-auth/react"
import { useCallback, useEffect } from "react"
import LoginButton from "../components/LoginButton"

const Home: NextPage = () => {
  const { data } = useSession()
  useEffect(() => {
    fetch(process.env.NEXT_PUBLIC_API_URL, { credentials: "include" })
      .then((r) => r.json())
      .then((response) => {
        console.log(response)
      })
  }, [data])

  const testForm = useCallback(() => {
    const formData = new FormData()
    formData.append("trace", new Blob([JSON.stringify({ test: "me" })], { type: "application/json" }), "trace.json")
    formData.append(
      "audio",
      new Blob([new ArrayBuffer(1024 * 1024 * 64)], { type: "application/octet-stream" }),
      "audio.mp4"
    )
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload`, { method: "POST", body: formData, credentials: "include" }).then(
      async (r) => {
        console.log(r)
      }
    )
  }, [])

  const testForm2 = useCallback(() => {
    const formData = new FormData()
    formData.append("trace", new Blob([JSON.stringify({ test: "me" })], { type: "application/json" }), "trace.json")
    formData.append(
      "audio",
      new Blob([new ArrayBuffer(1024 * 1024 * 64)], { type: "application/octet-stream" }),
      "audio.mp4"
    )
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL}/upload`)
      xhr.onload = function () {
        if (this.status >= 200 && this.status < 300) {
          resolve(xhr.response)
        } else {
          reject({
            status: this.status,
            statusText: xhr.statusText,
          })
        }
      }
      xhr.upload.onprogress = () => {
        console.log("Progress")
      }
      xhr.onerror = function () {
        reject({
          status: this.status,
          statusText: xhr.statusText,
        })
      }
      xhr.send(formData)
    }).then((r) => {
      console.log(r)
    })
  }, [])

  return (
    <>
      <LoginButton />
      <button onClick={testForm2}>Test Upload</button>
    </>
  )
}

export default Home
