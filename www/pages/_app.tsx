import { SessionProvider } from "next-auth/react"
import type { AppProps } from "next/app"
import { NewWindowLoginProvider } from "../components/LoginButton"
import "../styles/globals.css"
import "semantic-ui-css/semantic.min.css"

function MyApp({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <SessionProvider session={session}>
      <NewWindowLoginProvider>
        <Component {...pageProps} />
      </NewWindowLoginProvider>
    </SessionProvider>
  )
}

export default MyApp
