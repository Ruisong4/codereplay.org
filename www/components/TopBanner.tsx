import { Session } from "next-auth"
import { useSession } from "next-auth/react"
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import {
  alpha, AppBar,
  Avatar, Box, Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle, IconButton, InputBase, Link,
  Menu,
  MenuItem, styled,
  TextField, Toolbar, Typography
} from "@mui/material"
import SearchIcon from "@mui/icons-material/Search"
import { joinGroup } from "../api/api"
import { AccountCircle } from "@mui/icons-material"
import { Helmet } from "react-helmet"

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
  session: null
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

/** A styled div as input wrapper. */
const Search = styled("div")(({ theme }) => ({
  position: "relative",
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  "&:hover": {
    backgroundColor: alpha(theme.palette.common.white, 0.25)
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: "100%",
  [theme.breakpoints.up("sm")]: {
    marginLeft: theme.spacing(3),
    width: "auto"
  }
}))

/** The wrapper for left icon in search bar. */
const SearchIconWrapper = styled("div")(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: "100%",
  position: "absolute",
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
}))

/** The input used as search bar. */
const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: "inherit",
  "& .MuiInputBase-input": {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create("width"),
    width: "100%",
    [theme.breakpoints.up("md")]: {
      width: "20ch"
    }
  }
}))

const TopBanner: React.FC = () => {

  const { session, login, logout, busy } = useNewWindowLogin()

  /** The anchor for navigation menu on top banner */
  const [userMenuAnchor, setUserMenuAnchor] = useState<Element | null>(null)
  const open = Boolean(userMenuAnchor)

  /** Whether the Join-group dialog is open or not */
  const [dialogOpen, setDialogOpen] = useState(false)

  /** the group the user wants to join */
  const [groupId, setGroupId] = useState("")

  /** error state and error message when the user tries to join a group */
  const [error, setError] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  /** Search keyword */
  const [keyword, setKeyword] = useState("")

  /** Whether the search bar is focused or not */
  const [searchBarFocused, setSearchBarFocused] = useState(false)

  /** listen to keydown event, jump to list page. */
  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Enter" || keyword.trim() === "" || !searchBarFocused) {
      return
    }
    location.href = `/recordings?keyword=${encodeURIComponent(keyword)}`
  }, [keyword, searchBarFocused])

  /** @TODO maybe using form is more performant, but some article suggest it is the same thing under the hood */
  /** @TODO make sure this also works on mobile keyboard (who knows?) */
  useEffect(() => {
    window.addEventListener("keydown", handleKeydown)
    return () => {
      window.removeEventListener("keydown", handleKeydown)
    }
  }, [handleKeydown])

  /** onClick handler, open the Avtar menu, placed at the bottom of the event target. */
  const openAvatarMenu = (event: React.MouseEvent<Element, MouseEvent>) => {
    setUserMenuAnchor(event.currentTarget)
  }

  /** function that close the avatar menu. */
  const closeAvatarMenu = () => {
    setUserMenuAnchor(null)
  }

  /** Close the join group dialog */
  const closeJoinGroupDialog = () => {
    setError(false)
    setErrorMessage("")
    setDialogOpen(false)
  }

  /** Avatar in the top right corner when the user is logged in, also serves as a button to open avatar menu */
  const UserAvatar = <Avatar
    onClick={e => openAvatarMenu(e)}
    alt="U"
    sx={{ width: "40px", height: "40px", cursor: "pointer"}}
    src={session?.user?.image ? session.user.image : ""}
  />

  /** Login button displayed when the user is not Logged in. */
  const LoginButton = <IconButton
    size="large"
    edge="end"
    aria-label="Login button"
    aria-haspopup="true"
    onClick={busy ? () => {
    } : login}
    color="inherit"
    sx={{ p: 0, m: 0 }}
  >
    <AccountCircle sx={{ width: "40px", height: "40px" }} />
  </IconButton>

  const AvatarMenu = <Menu
    id="basic-menu"
    anchorEl={userMenuAnchor}
    open={open}
    onClose={closeAvatarMenu}
    MenuListProps={{
      "aria-labelledby": "basic-button",
      "autoFocusItem": false
    }}
    anchorOrigin={{
      vertical: "bottom",
      horizontal: "right"
    }}
    transformOrigin={{
      vertical: "top",
      horizontal: "right"
    }}
  >
    <MenuItem onClick={() => {
      location.href = "/user"
    }}><Typography variant="subtitle1">Manage</Typography></MenuItem>
    <MenuItem onClick={() => {
      location.href = "/record"
    }}><Typography variant="subtitle1">Record</Typography></MenuItem>
    <MenuItem onClick={() => {
      location.href = "/recordings"
    }}><Typography variant="subtitle1">Explore</Typography></MenuItem>
    <MenuItem onClick={() => {
      closeAvatarMenu()
      setDialogOpen(true)
    }}><Typography variant="subtitle1">Join Group</Typography></MenuItem>
    <MenuItem onClick={() => {
      closeAvatarMenu()
      logout()
    }}><Typography variant="subtitle1">Logout</Typography></MenuItem>
  </Menu>

  const JoinGroupDialog = <Dialog open={dialogOpen} onClose={closeJoinGroupDialog}>
    <DialogTitle>Join a Group</DialogTitle>
    <DialogContent>
      <DialogContentText>
        To Join a Group, enter the group ID below and click submit. Join the group allows you to submit recording in the
        group.
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
      <Button onClick={closeJoinGroupDialog}>Cancel</Button>
      <Button onClick={async () => {
        setError(false)
        joinGroup(groupId).then(status => {
          if (status == "success") {
            closeJoinGroupDialog()
            window.location.reload()
          } else {
            setErrorMessage(status)
            setError(true)
          }
        })
      }}>Join</Button>
    </DialogActions>
  </Dialog>

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Helmet>
        { /** DO NOT CHANGE, SUPER IMPORTANT FOR AVATARS TO LOAD */}
        <meta name="referrer" content="no-referrer" />
      </Helmet>
      <AppBar position="fixed">
        <Toolbar>
          <Link href="/" underline="none" color="inherit">
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              CodeReplay
            </Typography>
          </Link>
          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              onFocus={() => { console.log("ssss")
                setSearchBarFocused(true) }}
              onBlur={() => { setSearchBarFocused(false) }}
              onChange={(event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
                setKeyword(event.target.value)
              }}
              placeholder="Search…"
              inputProps={{ "aria-label": "search" }}
            />
          </Search>
          <Box sx={{ flexGrow: 1 }} />
          {session ? UserAvatar : LoginButton}
          {AvatarMenu}
          {JoinGroupDialog}
        </Toolbar>
      </AppBar>
    </Box>
  )
}
export default TopBanner
