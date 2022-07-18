import { signIn, useSession } from "next-auth/react"
import React, { useEffect, useRef } from "react"
import { mayUpdateUserMetadata } from "../api/api"

const SignIn: React.FC = () => {
  const { data, status } = useSession()
  const tried = useRef(false)

  useEffect(() => {
    if (status === "loading") {
      return
    }
    if (!data && !tried.current) {
      tried.current = true
      signIn("google").then()
    } else {
      window.opener?.postMessage("complete", window.location.origin)
      // after login, try update/insert user data in case of picture/name update
      mayUpdateUserMetadata()
    }
  }, [data, status])
  return null
}

export default SignIn
