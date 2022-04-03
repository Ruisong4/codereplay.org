import { Session } from "next-auth"
import { useSession } from "next-auth/react"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import {
  Avatar, Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Menu,
  MenuItem,
  TextField
} from "@mui/material"

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


  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);


  const [dialogOpen, setDialogOpen] = useState(false)
  const [groupId, setGroupId] = useState("")
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  // @ts-ignore
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  const closeDialog = () => {
    setError(false)
    setErrorMessage("")
    setDialogOpen(false)
  }

  const profileButton = <Avatar onClick={handleClick} alt="U" sx={{width: "40px", height: "40px"}} src={session?.user?.image ? session.user.image : ""}/>

  return (
    <>
      <div className={"login_menu_container"}>
        <div className={"login_menu_title"}><a href={"/"}>CodeReplay</a></div>
        {
          session? <div className={"login_menu_profile"}> {profileButton} </div> :
            <div className={"login_menu_action"} onClick={busy ? ()=>{} : login}>
              Sign in
            </div>
        }

      </div>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          'aria-labelledby': 'basic-button',
          'autoFocusItem': false
        }}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => {
          location.href = "/user"
        }}>Home</MenuItem>
        <MenuItem onClick={() => {
          location.href = "/record"
        }}>Record</MenuItem>
        <MenuItem onClick={() => {
          handleClose()
          setDialogOpen(true)
        }}>Join Group</MenuItem>
        <MenuItem onClick={() => {
          handleClose()
          logout()
        }}>Logout</MenuItem>
      </Menu>
      <Dialog open={dialogOpen} onClose={closeDialog}>
        <DialogTitle>Join a Group</DialogTitle>
        <DialogContent>
          <DialogContentText>
            To Join a Group, enter the group ID below and click submit. Join the group allows you to submit recording in the group.
          </DialogContentText>
          <TextField
            onChange={e => setGroupId(e.target.value)}
            autoFocus
            margin="dense"
            id="id"
            label="Group id"
            type="text"
            error={error}
            helperText={error ? errorMessage : null}
            fullWidth
            variant="standard"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={async () => {
            setError(false)
            await fetch(`${process.env.NEXT_PUBLIC_API_URL}/join_group`, {
              method: "post",
              body: JSON.stringify({groupId: groupId}),
              headers: {
                "Content-Type": "application/json"
              },
              credentials: "include"
            }).then(async (r) => {
              const response = await r.json()
              if (response.status === "fail") {
                setErrorMessage(response.msg)
                setError(true)
              } else {
                closeDialog()
                window.location.reload();
              }
            })
          }}>Join</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
export default LoginButton
