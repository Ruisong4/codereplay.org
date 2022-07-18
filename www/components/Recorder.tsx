import { Ace, MultiRecordReplayer } from "@codereplay/ace-recorder"
// @ts-ignore
import {
  SessionInfo,
  RecordingGroup,
  Language,
  RecordingSummaryWithUser,
  AceRecord,
  IRecordReplayer
} from "@codereplay/types"
import { Result, Submission } from "@cs124/playground-types"
import React, { useCallback, useEffect, useRef, useState } from "react"
import { IAceEditor } from "react-ace/lib/types"
import { uploadTrace } from "../lib/uploader"
import DefaultAceEditor from "./DefaultAceEditor"
import { ReflexContainer, ReflexSplitter, ReflexElement } from "react-reflex"
import { useSession } from "next-auth/react"
import {
  Box,
  Button,
  ClickAwayListener,
  Collapse, createTheme, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Divider, FormControl,
  IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText, MenuItem, Select,
  Popper, Slider, Switch,
  TextField, ThemeProvider,
  Tooltip, Typography, FormControlLabel
} from "@mui/material"
import Alert from "@mui/material/Alert"
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined"
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined"
import UploadIcon from "@mui/icons-material/Upload"
import AddIcon from "@mui/icons-material/Add"
import Chip from "@mui/material/Chip"
import CodeIcon from "@mui/icons-material/Code"
import PlayCircleFilledOutlinedIcon from "@mui/icons-material/PlayCircleFilledOutlined"
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined"
import PauseCircleFilledOutlinedIcon from "@mui/icons-material/PauseCircleFilledOutlined"
import RadioButtonCheckedOutlinedIcon from "@mui/icons-material/RadioButtonCheckedOutlined"
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined"
import SettingsIcon from "@mui/icons-material/Settings"
import { grey } from "@mui/material/colors"
import FolderIcon from "@mui/icons-material/Folder"
import SpeedIcon from "@mui/icons-material/Speed"
import LanguageIcon from "@mui/icons-material/Language"
import ExpandLess from "@mui/icons-material/ExpandLess"
import ExpandMore from "@mui/icons-material/ExpandMore"
import PlayCircleFilledIcon from "@mui/icons-material/PlayCircleFilled"
import ForkLeftIcon from "@mui/icons-material/ForkLeft"
import { DEFAULT_FILES, FILE_ENDINGS, PLAYGROUND_ENDPOINT } from "../utils/constant"
import { getRecordingGroups, submitCodeToPlayground } from "../api/api"
import { getRecordStatusSeverityAndMessage, isMarkdown, msToTime, processMarkDown } from "../utils/utils"
import MuiMarkdown from "mui-markdown"

/**
 * @TODO there are several design decision that I think needs discussion/consideration.
 *      - Ref or dependencies?
 *      - Separate component or configuration argument?
 *      - form or state?
 * */

/**
 * @TODO define a global color theme and support night/day mode
 *       - handle seeking bug (content) when session is created after the recording start (probably easier through frontend constraint)
 */

/** A theme used to override default color theme by MUI. For buttons */
const buttonTheme = createTheme({
  components: {
    MuiIconButton: {
      styleOverrides: {
        root: {
          color: grey[100],
          "&.Mui-disabled": {
            color: "#949393"
          }
        }
      }
    },
    MuiButtonBase: {
      styleOverrides: {
        root: {
          "&.Mui-disabled": {
            color: "#949393"
          }
        }
      }
    }
  }
})

const menuColor = {
  backgroundColor: grey[800],
  color: grey[50]
}

const Recorder: React.FC<{
  source: { summary: RecordingSummaryWithUser; trace: MultiRecordReplayer.Content } | undefined,
  isEmbed: boolean, forkFromSource: boolean
}> = ({
        source,
        isEmbed = false,
        forkFromSource = false
      }
) => {

  /** when there is a source and the source is not used for forking, user can only watch a recording. */
  const replayOnly = source !== undefined && !(forkFromSource)

  /** Used to calculate the height of the embed iframe when the user tries to generate one. */
  const embedRef = useRef<HTMLDivElement>(null)

  /** Ace Editor and their name, in this case we have code and output. */
  const editors = useRef<Record<string, Ace.Editor>>({})

  /** Ref to the code-typing editor. */
  const aceEditorRef = useRef<IAceEditor>()

  /** Ref to the output-displaying editor */
  const aceOutputRef = useRef<IAceEditor>()

  /** Ref to the horizontal resizer bar located at the top of recorder controls */
  const containerResizerRef = useRef<HTMLDivElement>(null)

  /** Ref to the MultiRecordReplayer, which is a wrapper class for two editors. */
  const recordReplayer = useRef<MultiRecordReplayer>()

  /** Timestamp of the start recording/replaying action. */
  const recordOrReplayStartTime = useRef(0)

  /** Whether this is the  initial load or not */
  const initialLoad = useRef(true)

  /** A ref to a timer. */
  const timer = useRef<ReturnType<typeof setInterval>>()

  /** State of the Ace recorder, playing, paused or recording */
  const [recordReplayerState, setRecordReplayerState] = useState<MultiRecordReplayer.State>("paused")

  /** Whether the output editor is displaying or not */
  const [showOutput, setShowOutput] = useState(false)
  const showOutputRef = useRef(showOutput)
  useEffect(() => {
    showOutputRef.current = showOutput
  }, [showOutput])

  /** Logged in user's session data. */
  const { data } = useSession()

  /** State of the RecordReplayer, this is the "usability states". */
  const [recorderState, setRecorderState] = useState<"playingTrace" | "readyToRecord" | "canUpload">("readyToRecord")

  /** Whether it is recording or not. */
  const [hasRecording, setHasRecording] = useState(false)

  /** The language we are using. */
  const [mode, setMode] = useState<Language>("python")

  /** Whether we are waiting for a playground submission. */
  const [running, setRunning] = useState(false)

  /** The result we get from playground server */
  const [result, setResult] = useState<{ result?: Result; error?: string } | undefined>()

  /** Height of the container in px, this is the output + the code area. */
  const [containerHeight, setContainerHeight] = useState(300)
  const containerHeightRef = useRef(containerHeight)
  useEffect(() => {
    containerHeightRef.current = containerHeight
  }, [containerHeight])

  /** Height of the top editor / height of the container. */
  const [aceEditorHeightFraction, setAceEditorHeightFraction] = useState(1 / 2)

  /** Height of the bottom output editor / height of the container. */
  const [aceOutputHeightFraction, setAceOutputHeightFraction] = useState(1 / 2)

  /** Whether display the file structure (allowing multiple sessions). */
  const [showFiles, setShowFiles] = useState<boolean>(false)
  const showFilesRef = useRef(showFiles)
  useEffect(() => {
    showFilesRef.current = showFiles
  }, [showFiles])

  /** Name of current active file */
  const [activeFile, setActiveFile] = useState<string>("main.py")

  /** All sessions we have, separated by "," */
  const [sessions, setSessions] = useState<string>("main.py")

  /** Title of this recording. */
  const [title, setTitle] = useState<string>(data ? data.user?.name + "'s Coding Example" : "")
  const titleRef = useRef(title)
  useEffect(() => {
    titleRef.current = title
  }, [title])

  /** Whether we should display a message at the top, below the banner. */
  const [displayTopMessage, setDisplayTopMessage] = useState<boolean>(true)

  /** The description of this recording. */
  const [description, setDescription] = useState<string>(data ? "this is a coding example recorded by " + data.user?.name : "")
  const descriptionRef = useRef(description)
  useEffect(() => {
    descriptionRef.current = description
  }, [description])

  /** Whether the language menu is open or not. */
  const [languageMenuOpen, setLanguageMenuOpen] = useState<boolean>(false)

  /** Whether the playback speed menu is open or not. */
  const [playbackMenuOpen, setPlaybackMenuOpen] = useState<boolean>(false)

  /** Whether the setting menu (overflow menu) is open or not, this is the parent menu of playback and language */
  const [settingMenuOpen, setSettingMenuOpen] = useState<boolean>(false)

  /** Define where the setting menu is attached. */
  const [settingMenuAnchor, setSettingMenuAnchor] = useState<null | HTMLElement>(null)

  /** The dialog to configuring iframe setting */
  const [iframeDialogOpen, setIframeDialogOpen] = useState(false)

  /** What groups to be included in this iframe. The iframe will display the original recording + fork from the group */
  const [iframeGroup, setIframeGroup] = useState("")

  /** Current user's group */
  const [groups, setGroups] = useState<RecordingGroup[]>([])

  /** The tags of this video. separate by common */
  const [tag, setTag] = useState<string>(mode)
  const tagRef = useRef(tag)
  useEffect(() => {
    tagRef.current = tag
  }, [tag])

  /** Current progress of this replay, ranging from 0 (not started) to 100 (completed) */
  const [currentProgress, setCurrentProgress] = useState(0)

  /** Whether there is a source (RecordingSummaryWithUser) passed to this component */
  const [hasSource, setHasSource] = useState(false)

  /** Duration of the current source, -1.0 means there is no valid source */
  const [duration, setDuration] = useState(-1.0)

  /** Whether there is a current "seek" action (user clicking the progress bar) */
  const [isSeeking, setIsSeeking] = useState(false)

  /** Current playback rate */
  const [playbackRate, setPlaybackRate] = useState("1.0")

  /** Whether the initialization is finished or not. */
  const [finishedInitialization, setFinishedInitialization] = useState(false)

  /** Whether we are uploading a recording or not. */
  const [uploading, setUploading] = useState(false)

  /** Whether the user is typing in markdown. */
  const [useMarkdown, setUseMarkdown] = useState(false)

  /** Showing markdown preview */
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false)

  /** @TODO what is this? looks like some magic code... I'm assuming it is used to refresh the ui? */
  const [, setTick] = useState(true)

  /**
   * Submit the current content to playground server and display the result when available
   * When the file structure is displayed (indicated by showFiles), compile all files together.
   * */
  const run = useCallback(async () => {
    if (!aceEditorRef.current) {
      return
    }

    const content = aceEditorRef.current.getValue()
    if (content.trim() === "") {
      return
    }

    let path = activeFile

    const submission = Submission.check({
      image: `cs124/playground-runner-${mode}`,
      filesystem: [{ path, contents: content }],
      timeout: 8000
    })

    if (showFiles) {
      let sessions = recordReplayer.current!.ace.recorders["code"].getSessionsInfo()
      if (replayOnly) {
        sessions = recordReplayer.current!.ace.players["code"].getSessionsInfo()
      }
      if (sessions.length !== 0) {
        submission.filesystem = sessions.map((session: SessionInfo) => {
          return { path: session.name, contents: session.contents }
        })
      }
    }

    /** @TODO here is the place to adjust the url, for example, if we want a private server for Internal users. */
    let endpoint = PLAYGROUND_ENDPOINT

    setRunning(true)
    setShowOutput(true)
    await submitCodeToPlayground(endpoint, submission)
      .then((result) => {
        if (result.timedOut) {
          setResult({ error: "Timeout" })
        } else {
          setResult({ result })
        }
      })
      .catch((err) => {
        setResult({ error: err.toString() })
      })
      .finally(() => {
        setRunning(false)
      })
  }, [activeFile, mode, replayOnly, showFiles])

  /** Upload the current recording to server */
  const upload = useCallback(async (e) => {
    e.preventDefault()
    if (!recordReplayer.current || !recordReplayer.current.src) {
      return
    }
    const { ace, audio: audioURL } = recordReplayer.current.src
    if (!ace) {
      return
    }
    const audio = await fetch(audioURL)
      .then((r) => r.blob())
      .then((r) => r.arrayBuffer())

    setUploading(true)
    uploadTrace({ trace: ace, mode }, audio, {
      description: forkFromSource ? source!.summary.description : processMarkDown(e.target.elements.description.value),
      title: forkFromSource ? source!.summary.title : e.target.elements.title.value,
      tag: forkFromSource ? source!.summary.tag : e.target.elements.tag.value,
      containerHeight: forkFromSource ? source!.summary.containerHeight : containerHeightRef.current,
      showFiles: forkFromSource ? source!.summary.showFiles : showFilesRef.current,
      forkedFrom: forkFromSource ? source!.summary.fileRoot : null
    }).then(() => {
      setUploading(false)
      window.location.href = "/recordings"
    })
  }, [forkFromSource, mode, source])

  /** Set up the environment using the current source */
  const setupSource = useCallback(() => {
    if (!recordReplayer.current || !source) {
      return
    }
    if (recordReplayer.current.state === "playing") {
      recordReplayer.current.pause()
    }

    if (!forkFromSource) {
      recordReplayer.current.src = source?.trace
    }

    !initialLoad.current && recordReplayer.current.play()

    initialLoad.current = false

    let traceSessions = ""
    if (forkFromSource) {
      recordReplayer.current!.ace.recorders["code"].clearSessions()
    }
    source!.trace!.ace!.code.sessionInfo.forEach((info: SessionInfo) => {
      traceSessions += traceSessions === "" ? info.name : `,${info.name}`
      if (forkFromSource) {
        recordReplayer.current!.ace.recorders["code"].addSession({
          name: info.name,
          contents: info.contents,
          mode: info.mode
        })
      }
    })
    setSessions(traceSessions)
    setActiveFile(source!.trace!.ace!.code.sessionName)
    setTitle(source!.summary.title)
    setTag(source!.summary.tag)
    setShowFiles(source!.summary.showFiles)
    setMode(source!.summary.mode as Language)
    setContainerHeight(source!.summary.containerHeight)
    setDescription(source!.summary.description)
    console.log("A new source has been loaded")
  }, [forkFromSource, source])

  /** finishing initializing the editor and variables when the editor loaded */
  const finishInitialization = useCallback(() => {
    if (Object.keys(editors.current).length !== 2) {
      return
    }
    recordReplayer.current = new MultiRecordReplayer(editors.current, {
      filterRecord: (record: AceRecord, name: string) => {

        if (name === "code" && (recordReplayer.current!.hasRecording || replayOnly)) {
          const r = record as any
          if (r.sessionName) {
            setActiveFile(r.sessionName)
          }
        }

        if (record.type !== "complete" && (record.type !== "external" || (record as any).external === undefined || name !== "output")) {
          return true
        }

        const r = record as any
        let filtered = true
        if (r.external && r.external.showOutput !== undefined) {
          setShowOutput(r.external.showOutput)
          filtered = false
        }

        return filtered || record.type === "complete"
      }
    })
    recordReplayer.current.addEventListener((e: IRecordReplayer.Event) => {
      if (e === "startedRecording") {
        recordReplayer.current!.ace.recorders["output"].external = {
          showOutput: showOutputRef.current,
          containerHeight: containerHeightRef.current
        }
      }
    })


    recordReplayer.current.addStateListener((s: IRecordReplayer.State) => setRecordReplayerState(s))

    recordReplayer.current.addEventListener((e: IRecordReplayer.Event) => {
      if (e === "ended") {
        setCurrentProgress(0)
      } else if (e === "srcChanged") {
        setHasSource(recordReplayer.current?.src !== undefined)
      }
    })

    recordReplayer.current.addEventListener((e: IRecordReplayer.Event) => {
      if (!recordReplayer.current) {
        return
      }
      if (e === "srcChanged") {
        if (recordReplayer.current.hasRecording) {
          setRecorderState("canUpload")
        } else if (recordReplayer.current.src === undefined) {
          setRecorderState("readyToRecord")
        } else {
          setRecorderState("playingTrace")
        }
        setHasRecording(recordReplayer.current.hasRecording)
      }
    })
    if (!replayOnly) {
      recordReplayer.current.ace.recorders["code"].addSession({
        name: "main.py",
        contents: "",
        mode: "ace/mode/python"
      })
      recordReplayer.current.ace.recorders["code"].setSession("main.py")
      setActiveFile("main.py")
    }
    setFinishedInitialization(true)
  }, [replayOnly])

  /** Handle user seek event initiated by clicking the progress bar */
  const handleSeekEvent = useCallback((event) => {
    if (recordReplayer.current == undefined) {
      return
    }
    recordReplayer.current.percent = event.target.value
    setCurrentProgress(event.target.value)
  }, [])

  /** Function that changes status of output editor. */
  const toggleOutput = useCallback(() => {
    setShowOutput((o) => !o)
  }, [])

  /** Load the logged-in user's current group if it is not embed view */
  useEffect(() => {
    if (isEmbed || data === null) {
      return
    }
    getRecordingGroups().then(currentGroups => setGroups(currentGroups))
  }, [data, isEmbed])

  /** Display a running indicator while waiting for response from playground server. */
  useEffect(() => {
    if (running) {
      aceOutputRef.current?.setValue("Running...")
      aceOutputRef.current?.clearSelection()
    }
  }, [running])

  /** Set the playback rate when changes */
  useEffect(() => {
    if (recordReplayer.current)
      recordReplayer.current.playbackRate = parseFloat(playbackRate)
  }, [playbackRate])

  /**
   * Keyboard shortcut binding. Bind ANY KEYBOARD SHORTCUT HERE
   * CTRL + r = start recording.
   * CTRL + ENTER = run code.
   * */
  useEffect(() => {
    let handleDown = (e: KeyboardEvent) => {
      if (e.key === "r" && e.ctrlKey) {
        e.preventDefault()
        if (data && recordReplayerState === "paused" && recordReplayer.current && !replayOnly) {
          recordReplayer.current.record().then()
        }
      } else if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault()
        run().then()
      }
    }

    document.addEventListener("keydown", handleDown)

    return () => {
      document.removeEventListener("keydown", handleDown)
    }
  }, [showFiles, data, recordReplayerState, replayOnly, run])

  /** When the user navigate away from the current file, switch recorder/replayer session */
  useEffect(() => {
    if (recordReplayer.current) {
      if (!recordReplayer.current.hasRecording && !replayOnly) {
        recordReplayer.current!.ace.recorders["code"].setSession(activeFile)
      } else {
        recordReplayer.current!.ace.players["code"].setSession(activeFile)
      }
    }
  }, [activeFile, replayOnly])

  /** Change the displayed result when a new result is available (returned from playground server or an error or a running indicator) */
  useEffect(() => {
    const output = result?.error || result?.result?.outputLines.map(({ line }) => line).join("\n") || ""
    aceOutputRef.current?.setValue(output)
    aceOutputRef.current?.clearSelection()
  }, [result])

  /** Configure duration and start time when the replay/recording start. */
  useEffect(() => {
    if (recordReplayerState !== "recording" && recordReplayerState !== "playing") {
      return
    }

    if (!recordReplayer.current) {
      return
    }

    if (recordReplayer.current.duration) {
      setDuration(recordReplayer.current.duration)
    }

    recordOrReplayStartTime.current = Date.now()

    setTick((t) => !t)
    const timer = setInterval(() => {
      setTick((t) => !t)
    }, 128)
    return () => {
      recordOrReplayStartTime.current = 0
      clearInterval(timer)
      setTick((t) => !t)
    }
  }, [recordReplayerState])

  /** Re-setup the source when the source changes */
  useEffect(() => {
    if (finishedInitialization) {
      setupSource()
    }
  }, [finishedInitialization, setupSource, source])

  /** When we start to play, set sync progress bar progress and the actual progress. */
  useEffect(() => {
    if (recordReplayerState === "playing") {
      timer.current = setInterval(() => {
        if (recordReplayer.current) {
          setCurrentProgress(recordReplayer.current.percent)
        }
      }, 100)
    } else {
      timer.current && clearInterval(timer.current)
    }
  }, [recordReplayerState])

  /** When creating a non-forked recording, switching mode changes the tag */
  useEffect(() => {
    if (!replayOnly && !forkFromSource) {
      setTag(mode)
    }
  }, [forkFromSource, mode, replayOnly])

  /** Record showOutput as an external event in the output editor's trace. */
  useEffect(() => {
    if (
      recordReplayerState !== "recording" ||
      !recordReplayer.current ||
      !recordReplayer.current?.ace?.recorders["output"].recording
    ) {
      return
    }
    recordReplayer.current.ace.recorders["output"].external = {
      showOutput: showOutputRef.current
    }
  }, [recordReplayerState, showOutput])

  /** When the user status or recorderState change, update the message. */
  useEffect(() => {
    setDisplayTopMessage(true)
  }, [recorderState, data])

  /** Define the top message component. */
  let message = <Collapse in={displayTopMessage}>
    <Alert
      onClose={() => {
        setDisplayTopMessage(false)
      }}
      severity={getRecordStatusSeverityAndMessage(recorderState, data !== null, source?.summary.email, source?.summary.mode).severity}
      variant={"filled"}
      sx={{ mb: 2 }}
    >
      {getRecordStatusSeverityAndMessage(recorderState, data !== null, source?.summary.email, source?.summary.mode).message}
    </Alert>
  </Collapse>

  /** Define the showOutput button. */
  const showOutputButton = <IconButton sx={{ p: "4px" }} color={"primary"} onClick={toggleOutput}>{
    showOutput ? <VisibilityOffOutlinedIcon sx={{ fontSize: "20px" }} /> :
      <VisibilityOutlinedIcon sx={{ fontSize: "20px" }} />
  }</IconButton>

  /** Define the setting button. */
  const settingButton = <IconButton
    sx={{ p: "4px" }}
    color={"primary"}
    onClick={(e) => {
      setSettingMenuAnchor(e.currentTarget)
      setSettingMenuOpen(true)
    }
    }>{
    <SettingsIcon sx={{ fontSize: "20px" }} />
  }</IconButton>


  /**
   * Define the share button, only visible for non-author
   * */
  const shareButton = <IconButton
    sx={{ p: "4px" }}
    color={"primary"}
    onClick={() => {
      setIframeDialogOpen(true)
    }}>
    <CodeIcon sx={{ fontSize: "20px" }} />
  </IconButton>

  /** Define the language menu within the setting menu. */
  const languageMenu = <Collapse
    timeout="auto"
    in={languageMenuOpen}
    unmountOnExit
  >
    <List sx={{ maxHeight: 100, overflow: "auto" }} component="div" disablePadding>
      {
        Object.entries(DEFAULT_FILES).map((languageAndFileName, index) => {
          const language = languageAndFileName[0]
          const defaultFileName = languageAndFileName[1]
          return <ListItemButton
            key={index}
            selected={mode === language}
            onClick={() => {
              if (recordReplayer.current) {
                recordReplayer.current!.ace.recorders["code"].clearSessions()
                setMode(language as Language)
                let firstSessionName = defaultFileName
                setSessions(firstSessionName)
                recordReplayer.current.ace.recorders["code"].addSession({
                  name: firstSessionName,
                  contents: "",
                  mode: "ace/mode/python"
                })
                recordReplayer.current.ace.recorders["code"].setSession(firstSessionName)
                setActiveFile(firstSessionName)
                setLanguageMenuOpen(false)
              }
            }
            }
          >
            {language}
          </ListItemButton>
        })
      }
    </List>
  </Collapse>

  /** Define the playback speed menu. */
  const playbackMenu = <Collapse
    timeout="auto"
    in={playbackMenuOpen}
    unmountOnExit
  >
    <List sx={{ maxHeight: 100, overflow: "auto" }} component="div" disablePadding>
      {
        ["0.5", "1.0", "2.0"].map((speed, index) => {
          return <ListItemButton
            key={index}
            selected={playbackRate === speed}
            onClick={() => {
              setPlaybackRate(speed)
              setPlaybackMenuOpen(false)
            }
            }
          >
            {speed}
          </ListItemButton>
        })
      }
    </List>
  </Collapse>

  /** Define the setting menu, this contains the playback and language menu. */
  const settingMenu = !settingMenuOpen ? null :
    <ClickAwayListener onClickAway={() => {
      setLanguageMenuOpen(false)
      setPlaybackMenuOpen(false)
      setSettingMenuOpen(false)
      setSettingMenuAnchor(null)
    }
    }>
      <Popper
        id="settingMenu"
        placement="top-end"
        anchorEl={settingMenuAnchor}
        open={settingMenuOpen}>
        <Box sx={{ ...menuColor }}>
          <List dense sx={{ ...menuColor, p: 0 }}>
            <ListItemButton
              disabled={replayOnly || forkFromSource || !(recorderState === "readyToRecord" && recordReplayerState === "paused")}>
              <ListItemIcon><FolderIcon sx={{ ...menuColor }} /></ListItemIcon>
              <ListItemText primary="Show File Structure" />
              <Switch checked={showFiles} onChange={() => setShowFiles(!showFiles)}
                      disabled={forkFromSource || replayOnly || !(recorderState === "readyToRecord" && recordReplayerState === "paused")}
                      sx={{ ...menuColor }} color="warning" edge={"end"} />
            </ListItemButton>
            <Divider sx={{ backgroundColor: grey[50] }} />
            <ListItemButton onClick={() => {
              if (!(recorderState === "readyToRecord" && recordReplayerState === "paused") || forkFromSource) return
              if (playbackMenuOpen) {
                setPlaybackMenuOpen(false)
              }
              setLanguageMenuOpen(!languageMenuOpen)
            }
            } style={{ cursor: "pointer" }}
                            disabled={!(recorderState === "readyToRecord" && recordReplayerState === "paused") || forkFromSource}>
              <ListItemIcon><LanguageIcon sx={{ ...menuColor }} /></ListItemIcon>
              <ListItemText primary={mode} />
              {languageMenuOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            {languageMenu}
            <Divider sx={{ backgroundColor: grey[50] }} />
            <ListItem style={{ cursor: "pointer" }} onClick={() => {
              if (languageMenuOpen) {
                setLanguageMenuOpen(false)
              }
              setPlaybackMenuOpen(!playbackMenuOpen)
            }}>
              <ListItemIcon><SpeedIcon sx={{ ...menuColor }} /></ListItemIcon>
              <ListItemText primary={"Playback Speed " + playbackRate} />
              {playbackMenuOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItem>
            {playbackMenu}
          </List>
        </Box>
      </Popper>
    </ClickAwayListener>


  /** Slider that controls the progress, support seeking event */
  const recordingSlider = <Slider
    sx={{ p: "0 !important", ml: 2, mr: 2 }}
    disabled={recordReplayerState === "recording" || !hasSource || duration === -1}
    min={0}
    max={100}
    step={1}
    size={"small"}
    onChange={handleSeekEvent}
    onMouseDown={() => {
      if (recordReplayerState === "playing" && !isSeeking) {
        if (recordReplayer.current !== undefined) {
          setIsSeeking(true)
          recordReplayer.current.pause()
        }
      }
    }}
    onMouseUp={() => {
      if (recordReplayer.current !== undefined) {
        isSeeking && recordReplayer.current.play()
        setIsSeeking(false)
      }
    }}
    value={currentProgress}
  />

  /** Defines the share dialog, allows user create iframe */
  const shareDialog = replayOnly && <Dialog open={iframeDialogOpen} onClose={() => setIframeDialogOpen(false)}>
    <DialogTitle>Create an Iframe</DialogTitle>
    <DialogContent>
      <DialogContentText>
        Create an Iframe and put it on your site! Use the below dropdown menu to select the recordings you want to
        include
      </DialogContentText>

      <FormControl sx={{ m: 1, minWidth: 120 }}>
        <Select
          value={iframeGroup}
          onChange={(e) => {
            setIframeGroup(e.target.value)
          }
          }
          displayEmpty
          inputProps={{ "aria-label": "Without label" }}
        >
          <MenuItem value="">Only This</MenuItem>
          <MenuItem value="allForks">allForks</MenuItem>
          {groups.map((g, key) => {
            return <MenuItem value={g.groupId} key={key}>{g.name}</MenuItem>
          })}
        </Select>
      </FormControl>

      <TextField
        autoFocus
        margin="dense"
        value={`<iframe src="http://localhost:3000/embed/${source!.summary.fileRoot}/${iframeGroup}" width="100%" height="${embedRef.current ? embedRef.current!.clientHeight + 60 : 0}px" style="border:none; overflow: hidden"> </iframe>`}
        id="id"
        label="iframe code"
        type="text"
        fullWidth
        variant="standard"
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={() => {
        setIframeDialogOpen(false)
      }}>Close</Button>
    </DialogActions>
  </Dialog>

  return (
    <Box sx={{ mt: isEmbed ? "0" : "100px" }}>

      <Box sx={{ width: isEmbed ? "100%" : "70%", m: "0 auto 0 auto" }}>
        {!isEmbed && message}
      </Box>

      <Box sx={{ width: isEmbed ? "100%" : "70%", m: "0 auto" }}>
        <Box ref={embedRef}>
          <Box sx={{ m: "auto", position: "relative" }}>
            <Box sx={{
              visibility: !showFiles ? "hidden" : "visible",
              display: !showFiles && replayOnly ? "none" : "flex",
              flexDirection: "row",
              mb: "15px"
            }}>
              {
                sessions.split(",").map((str, idx) => {
                  return <Box
                    sx={{
                      backgroundColor: activeFile === str ? "#EFEFEF" : "inherit",
                      width: "12%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textAlign: "center",
                      borderRadius: "5%",
                      height: "2rem",
                      lineHeight: "2rem",
                      cursor: "pointer",
                      ml: idx === 0 ? 0 : "2%"
                    }}
                    key={idx} onClick={() => setActiveFile(str)}>{str}</Box>
                })
              }


              {
                sessions.split(",").length < 5 && !forkFromSource && !replayOnly && !hasRecording &&
                <Tooltip title={"Create a new file here, you can create at most 5 files"}>
                  <IconButton sx={{ minHeight: 0, minWidth: 0, padding: 0 }} onClick={() => {
                    const currentMode = mode as Language
                    let startWithLower = DEFAULT_FILES[currentMode].split(".")[0][0] === DEFAULT_FILES[currentMode].split(".")[0][0].toLowerCase()
                    let fileName = startWithLower ? "another" : "Another"
                    fileName += sessions.split(",").length
                    let newSession = fileName + "." + FILE_ENDINGS[currentMode]
                    setSessions(sessions + "," + newSession)
                    recordReplayer.current!.ace.recorders["code"].addSession({
                      name: newSession,
                      contents: "",
                      mode: "ace/mode/" + mode
                    })
                    setActiveFile(newSession)
                  }}>
                    <AddIcon />
                  </IconButton>
                </Tooltip>
              }
            </Box>

            <ReflexContainer
              orientation="horizontal"
              style={{
                borderRight: "1px solid black",
                borderLeft: "1px solid black",
                display: "flex",
                flexDirection: "column",
                height: showOutput ? containerHeight + 5 + "px" : containerHeight + "px"
              }}>
              <ReflexElement onResize={args => {
                if (args.component.props.flex) {
                  setAceEditorHeightFraction(args.component.props.flex)
                }
              }} maxSize={containerHeight} minSize={0}>
                <DefaultAceEditor
                  height={showOutput ? aceEditorHeightFraction * containerHeight + "px" : containerHeight + "px"}
                  maxLines={0}
                  mode={mode}
                  onLoad={(ace) => {
                    aceEditorRef.current = ace
                    editors.current["code"] = ace
                    finishInitialization()
                  }}
                />
              </ReflexElement>
              <ReflexSplitter style={{
                height: "5px",
                backgroundColor: "black",
                cursor: "row-resize",
                display: showOutput ? "block" : "none"
              }} />
              <ReflexElement onResize={args => {
                if (args.component.props.flex) {
                  setAceOutputHeightFraction(args.component.props.flex)
                }
              }} maxSize={containerHeight} minSize={0} style={{ display: showOutput ? "block" : "none" }}>
                <DefaultAceEditor
                  readOnly
                  height={aceOutputHeightFraction * containerHeight + "px"}
                  showGutter={false}
                  maxLines={0}
                  showPrintMargin={false}
                  highlightActiveLine={false}
                  theme="ambiance"
                  mode={"text"}
                  onLoad={(ace) => {
                    aceOutputRef.current = ace
                    editors.current["output"] = ace
                    finishInitialization()
                    setShowOutput(true)
                    const renderer = ace.renderer as any
                    renderer.$cursorLayer.element.style.display = "none"
                  }}
                />
              </ReflexElement>
            </ReflexContainer>

            {
              !replayOnly && !forkFromSource &&
              <Box ref={containerResizerRef} sx={{
                height: "5px",
                backgroundColor: "#3d4141",
                cursor: "row-resize"
              }}
                   onMouseDown={recorderState === "readyToRecord" && recordReplayerState === "paused" ? e => {
                     let start = e.pageY
                     const clearEvents = () => {
                       document.removeEventListener("mouseup", clearEvents)
                       document.removeEventListener("mousemove", resizeContainer)
                     }
                     const resizeContainer = (e: MouseEvent) => {
                       if (containerHeight + e.pageY - start < 250) {
                         return
                       }
                       setContainerHeight(containerHeight + e.pageY - start)
                     }

                     document.addEventListener("mouseup", clearEvents)
                     document.addEventListener("mousemove", resizeContainer)
                   } : () => {
                   }}>
              </Box>
            }
            {
              <IconButton color="success" sx={{
                p: "4px",
                position: "absolute",
                right: "0",
                bottom: "8px"
              }} onClick={() => {
                run().then()
              }
              }>
                <PlayCircleFilledIcon sx={{ fontSize: "20px" }} />
              </IconButton>
            }
          </Box>
          <ThemeProvider theme={buttonTheme}>
            <Box sx={{
              backgroundColor: "#3d4141",
              m: "0 auto"
            }}>
              {showOutput ? null : <div style={{ height: "5px", width: "100%" }} />}
              {finishedInitialization &&
                <Box>
                  <Box sx={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    m: "0 auto"
                  }}>

                    <Tooltip
                      title={recordReplayerState === "paused" ? "press to start" : recordReplayerState === "recording" ? "press to stop recording" : "press to pause"}>
                      <span>
                        <IconButton sx={{ p: "4px" }}
                                    color={"primary"}
                                    disabled={recordReplayerState === "paused" && !hasSource}
                                    onClick={() => {
                                      if (recordReplayer.current) {
                                        if (recordReplayerState === "paused") {
                                          recordReplayer.current.play().then()
                                        } else if (recordReplayerState === "recording") {
                                          recordReplayer.current.stop().then()
                                        } else {
                                          recordReplayer.current.pause()
                                        }
                                      }
                                    }}>
                        {
                          recordReplayerState === "paused" ? <PlayCircleFilledOutlinedIcon sx={{ fontSize: "20px" }} />
                            : recordReplayerState === "recording" ? <StopCircleOutlinedIcon sx={{ fontSize: "20px" }} />
                              : <PauseCircleFilledOutlinedIcon sx={{ fontSize: "20px" }} />
                        }
                      </IconButton>
                      </span>
                    </Tooltip>

                    {
                      replayOnly || hasSource || recordReplayerState === "recording" ? null :
                        <Tooltip title={!(!data || recordReplayerState !== "paused") ? "Press to Start Recording" : ""}>
                          <span>
                            <IconButton sx={{ p: "4px" }} color="primary"
                                        disabled={!data || recordReplayerState !== "paused"}
                                        onClick={async () => {
                                          if (recordReplayer.current)
                                            await recordReplayer.current.record()
                                        }}>
                            <RadioButtonCheckedOutlinedIcon sx={{ fontSize: "20px" }} />
                          </IconButton>
                          </span>
                        </Tooltip>
                    }

                    {
                      replayOnly || (!hasSource && recordReplayerState != "recording") ? null :
                        <Tooltip
                          title={!(!hasSource || recordReplayerState === "recording") ? "Press to Start over" : ""}>
                            <span>
                              <IconButton sx={{ p: "4px" }}
                                          color="primary"
                                          disabled={!hasSource || recordReplayerState === "recording"}
                                          onClick={() => {
                                            if (recordReplayer.current) {
                                              if (recordReplayerState === "playing") {
                                                recordReplayer.current.pause()
                                              }
                                              recordReplayer.current.src = undefined
                                              setCurrentProgress(0)
                                            }
                                          }}>
                                <UndoOutlinedIcon sx={{ fontSize: "20px" }} />
                              </IconButton>
                            </span>
                        </Tooltip>
                    }

                    {recordingSlider}
                    {recordReplayerState === "recording" && recordOrReplayStartTime.current != 0 && (
                      <Box sx={{
                        display: "flex",
                        color: "#e8f0fe"
                      }}>
                        {msToTime(Math.floor((Date.now() - recordOrReplayStartTime.current)))}
                      </Box>
                    )}

                    {recordReplayer.current && recordReplayerState != "recording" && ((recordReplayerState === "playing" && duration != -1) || currentProgress !== 0) && (
                      <Box sx={{
                        display: "flex",
                        color: "#e8f0fe"
                      }}>
                        -{msToTime(duration * 1000 - Math.floor(recordReplayer.current.currentTime * 1000))}
                      </Box>
                    )}

                    {replayOnly && !isEmbed && data?.user?.email !== source?.summary.email ?
                      <Tooltip title={"fork this recording"}>
                        <IconButton sx={{ p: "4px" }}
                                    onClick={() => {
                                      window.location.href = "/record/fork/" + source?.summary.fileRoot
                                    }
                                    }
                        >
                          <ForkLeftIcon sx={{ fontSize: "20px" }} />
                        </IconButton>
                      </Tooltip> : null
                    }

                    {replayOnly && !isEmbed && data?.user?.email === source?.summary.email ?
                      <Tooltip title={"copy embed code"}>
                        {shareButton}
                      </Tooltip> : null
                    }
                    {shareDialog}

                    <Tooltip title={"show or hide output"}>
                      {showOutputButton}
                    </Tooltip>

                    {
                      forkFromSource ? <IconButton sx={{ p: "4px" }}
                                                   onClick={upload}
                                                   disabled={uploading || !hasRecording}
                                                   style={{ display: replayOnly ? "none" : "block" }}
                      >
                        <UploadIcon sx={{ fontSize: "20px" }} />
                      </IconButton> : <IconButton sx={{ p: "4px" }}
                                                  disabled={uploading || !hasRecording}
                                                  style={{ display: replayOnly ? "none" : "block" }}
                                                  type={"submit"}
                                                  form={"meta_data_form"}
                      >
                        <UploadIcon sx={{ fontSize: "20px" }} />
                      </IconButton>
                    }

                    {settingButton}
                    {settingMenu}
                  </Box>
                </Box>

              }
            </Box>
          </ThemeProvider>
        </Box>


        {
          !replayOnly && !forkFromSource && !isEmbed &&
          <Box sx={{ m: "auto" }}>
            <form id={"meta_data_form"} onSubmit={(e) => upload(e)}>
              <Box sx={{ width: "60%" }}>
                <Typography variant="h4" sx={{ m: "20px auto" }}>Title</Typography>
                <TextField name="title" label={"Title"} fullWidth required variant="outlined" />
              </Box>
              <Box sx={{ m: "20px auto" }}>
                <Typography variant="h4" sx={{ m: "20px auto" }}>Tag</Typography>
                {
                  tag.split(",").map((t, key) => {
                    if (t.trim() == "") return null
                    return <Chip key={key} className={"record_chip"} label={t} />
                  })
                }
              </Box>
              <Box sx={{ width: "60%" }}>
                {tag.split(",").length > 5 ?
                  <TextField required error helperText={"max tag size is 5"} fullWidth value={tag} name="tag"
                             label={"tags, separate by common"} variant="outlined"
                             onChange={event => setTag(event.target.value)} /> :
                  <TextField required fullWidth value={tag} name="tag" label={"tags, separate by common"}
                             variant="outlined" onChange={event => setTag(event.target.value)} />
                }
              </Box>
              <Box>
                <Typography variant="h4" sx={{ m: "20px auto" }}>Description</Typography>
                <FormControlLabel
                  sx={{ ml: 0 }}
                  value="useMarkdown"
                  control={<Switch color="primary" />}
                  label="Use Markdown"
                  labelPlacement="start"
                  checked={useMarkdown}
                  onChange={() => {
                    setShowMarkdownPreview(false)
                    setUseMarkdown(!useMarkdown)
                  }}
                />
                {
                  useMarkdown &&
                  <FormControlLabel
                    sx={{ ml: "10px" }}
                    value="showPreview"
                    control={<Switch color="primary" />}
                    label="Show Preview"
                    labelPlacement="start"
                    checked={showMarkdownPreview}
                    onChange={() => setShowMarkdownPreview(!showMarkdownPreview)}
                  />
                }
                {useMarkdown &&
                  <Alert sx={{ mb: "20px", mt: "20px" }} severity="warning">You are using an experimental feature, the
                    result might not look good on smaller device. Also, please be aware that we are disabling
                    H1-H4</Alert>}
                {
                  showMarkdownPreview ? <MuiMarkdown>{description}</MuiMarkdown> :
                    <textarea
                      onChange={(e: React.FormEvent<HTMLTextAreaElement>) => {
                        setDescription(e.currentTarget.value)
                      }
                      }
                      value={description}
                      name={"description"}
                      required={true}
                      style={{
                        height: "50vh",
                        resize: "none",
                        width: "100%",
                        fontSize: "1rem",
                        padding: "8px"
                      }} />
                }
              </Box>
            </form>
          </Box>
        }


        {
          (replayOnly || forkFromSource) && !isEmbed &&
          <Box>
            <Box sx={{
              display: "flex",
              flexDirection: "row",
              m: "50px auto 20px auto"
            }}>
              <Typography variant="h4">{title}</Typography>
            </Box>
            <Box sx={{ m: "0 auto" }}>
              {
                tag.split(",").map((t, index) => {
                  return <Chip key={index} sx={{ mt: "10px", mb: "10px", ml: index === 0 ? 0 : "10px" }} label={t} />
                })
              }
            </Box>
            <Box sx={{ m: "20px auto" }}>
              <Typography variant="h4">Description</Typography>
              <hr />
              {
                isMarkdown(description) ? <MuiMarkdown>{processMarkDown(description)}</MuiMarkdown> :
                  <Typography variant={"body1"}>{description}</Typography>
              }
            </Box>
          </Box>
        }
      </Box>
    </Box>
  )
}
export default Recorder



