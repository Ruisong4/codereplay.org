import { Session } from "next-auth"
import { useSession } from "next-auth/react"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

export interface NewWindowLoginContext {
  busy: boolean
  login: () => void
  logout: () => void
  session: Session | null
}

const NewWindowLoginContext = createContext<NewWindowLoginContext>({
  busy: true,
  login: () => {
    throw Error("NewWindowLoginContext not defined")
  },
  logout: () => {
    throw Error("NewWindowLoginContext not defined")
  },
  session: null,
})

export const NewWindowLoginProvider: React.FC = ({ children }) => {
  const { data, status } = useSession()
  const [busy, setBusy] = useState(false)
  const opened = useRef<Window | null>()
  const timer = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if ((event as MessageEvent).origin != window.location.origin) {
        return
      }
      opened.current?.close()
      setBusy(false)
      timer.current && clearInterval(timer.current)
    }
    window.addEventListener("message", listener)
    return () => {
      window.removeEventListener("message", listener)
      timer.current && clearInterval(timer.current)
    }
  }, [])

  const login = useCallback(() => {
    opened.current?.close()
    opened.current = window.open("/signin")
    setBusy(true)
    timer.current = setInterval(() => {
      if (opened.current?.closed) {
        setBusy(false)
      }
    }, 500)
  }, [])

  const logout = useCallback(() => {
    opened.current?.close()
    opened.current = window.open("/signout")
    setBusy(true)
    timer.current = setInterval(() => {
      if (opened.current?.closed) {
        setBusy(false)
      }
    }, 500)
  }, [])

  return (
    <NewWindowLoginContext.Provider value={{ login, logout, busy: status === "loading" || busy, session: data }}>
      {children}
    </NewWindowLoginContext.Provider>
  )
}
export const useNewWindowLogin = () => useContext(NewWindowLoginContext)

const LoginButton: React.FC<{ icon?: boolean; text?: boolean }> = ({ icon = false, text = false }) => {
  const { session, login, logout, busy } = useNewWindowLogin()
  return (
    <>
      <div className={"login_menu_container"}>
        <div className={"login_menu_title"}><a href={"/"}>CodeReplay</a></div>
        <div className={"login_menu_action"} onClick={busy ? ()=>{} : session ? logout : login}>
          {session ? "Sign Out" : "Sign in"}
        </div>
      </div>
    </>
  )
}
export default LoginButton
