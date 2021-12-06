import type { NextPage } from "next"
import { useSession } from "next-auth/react"
import { useEffect } from "react"
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
  return <LoginButton />
}

export default Home
