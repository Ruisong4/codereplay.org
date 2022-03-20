import { Ace, MultiRecordReplayer } from "@codereplay/ace-recorder"
import { TraceSummary, SessionInfo } from "@codereplay/types"
import { Result, Submission } from "@cs124/playground-types"
import { useCallback, useEffect, useRef, useState } from "react"
import { IAceEditor } from "react-ace/lib/types"
import { uploadTrace } from "../lib/uploader"
import DefaultAceEditor from "./DefaultAceEditor"
import { ReflexContainer, ReflexSplitter, ReflexElement, HandlerProps } from "react-reflex"
import { useSession } from "next-auth/react"
import {
  Box,
  Button,
  ClickAwayListener,
  Collapse, Divider,
  IconButton, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Popper, Switch,
  TextField,
  Tooltip
} from "@mui/material"
import Alert from "@mui/material/Alert"
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined"
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined"
import UploadIcon from "@mui/icons-material/Upload"
import AddIcon from "@mui/icons-material/Add"
import CloseIcon from "@mui/icons-material/Close"
import Chip from "@mui/material/Chip"
import CodeIcon from "@mui/icons-material/Code"
import PlayCircleFilledOutlinedIcon from "@mui/icons-material/PlayCircleFilledOutlined"
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined"
import PauseCircleFilledOutlinedIcon from "@mui/icons-material/PauseCircleFilledOutlined"
import RadioButtonCheckedOutlinedIcon from "@mui/icons-material/RadioButtonCheckedOutlined"
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined"
import SettingsIcon from "@mui/icons-material/Settings"
import { grey } from "@mui/material/colors"
import FolderIcon from '@mui/icons-material/Folder'
import SpeedIcon from '@mui/icons-material/Speed';
import LanguageIcon from '@mui/icons-material/Language';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';

const PLAYGROUND_ENDPOINT = `${process.env.NEXT_PUBLIC_API_URL}/playground`
const ILLINOIS_API_URL = `${process.env.NEXT_PUBLIC_ILLINOIS_API_URL}/playground`
type language = "python" | "cpp" | "haskell" | "java" | "julia" | "r" | "c" | "go" | "rust" | "scala3" | "kotlin"
const DEFAULT_FILES = {
  python: "main.py",
  cpp: "main.cpp",
  haskell: "main.hs",
  java: "Main.java",
  julia: "main.jl",
  r: "main.R",
  c: "main.c",
  go: "main.go",
  rust: "main.rs",
  kotlin: "Main.kt",
  scala3: "Main.sc"
} as Record<language, string>

const Recorder: React.FC<{ source: { summary: TraceSummary; trace: MultiRecordReplayer.Content } | undefined, isEmbed: boolean }> = ({
                                                                                                                                       source,
                                                                                                                                       isEmbed = false
                                                                                                                                     }) => {
  const editors = useRef<Record<string, Ace.Editor>>({})
  const aceEditorRef = useRef<IAceEditor>()
  const aceOutputRef = useRef<IAceEditor>()
  const containerResizerRef = useRef<HTMLDivElement>(null)
  const recordReplayer = useRef<MultiRecordReplayer>()
  const [state, setState] = useState<MultiRecordReplayer.State>("paused")
  const [showOutput, setShowOutput] = useState(false)
  const { data } = useSession()

  const [recorderState, setRecorderState] = useState<"playingTrace" | "readyToRecord" | "canUpload">("readyToRecord")
  const [hasRecording, setHasRecording] = useState(false)

  const [mode, setMode] = useState<language>("python")
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ result?: Result; error?: string } | undefined>()

  const [containerHeight, setContainerHeight] = useState(300)
  const [aceEditorHeight, setAceEditorHeight] = useState(1 / 2)
  const [aceOutputHeight, setAceOutputHeight] = useState(1 / 2)


  const [showFiles, setShowFiles] = useState<boolean>(false)
  const [active, setActive] = useState<string>("main.py")
  const [sessions, setSessions] = useState<string>("main.py")

  const [title, setTitle] = useState<string>(data ? data.user?.name + "'s Coding Example" : "")

  const [displayTopMessage, setDisplayTopMessage] = useState<boolean>(true)

  const [description, setDescription] = useState<string>(data ? "this is a coding example recorded by " + data.user?.name : "")

  const [languageMenuOpen, setLanguageMenuOpen] = useState<boolean>(false)

  const [playbackMenuOpen, setPlaybackMenuOpen] = useState<boolean>(false)

  const [settingMenuOpen, setSettingMenuOpen] = useState<boolean>(false)
  const [settingMenuAnchor, setSettingMenuAnchor] = useState<null | HTMLElement>(null)

  const [tag, setTag] = useState<string>(mode)

  const [wasPlaying, setWasPlaying] = useState(false)
  const [value, setValue] = useState(0)
  const [hasSource, setHasSource] = useState(false)
  const [duration, setDuration] = useState(-1.0)

  const [, setTick] = useState(true)
  const recordStartTime = useRef(0)

  const [playbackRate, setPlaybackRate] = useState("1.0")
  useEffect(() => {
    if (recordReplayer.current)
      recordReplayer.current.playbackRate = parseFloat(playbackRate)
  }, [playbackRate, recordReplayer.current])

  const replayOnly = source !== undefined

  //const embedRef: React.RefObject<HTMLDivElement> = createRef()
  const embedRef = useRef<HTMLDivElement>(null)

  const run = useCallback(async (runAll = false) => {
    if (!aceEditorRef.current) {
      return
    }
    const content = aceEditorRef.current.getValue()
    if (content.trim() === "") {
      return
    }

    let path = active

    const submission = Submission.check({
      image: `cs124/playground-runner-${mode}`,
      filesystem: [{ path, contents: content }],
      timeout: 8000
    })

    if (runAll) {
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

    let endpoint = PLAYGROUND_ENDPOINT
    /**
     if (data?.user?.email?.endsWith("illinois.edu")) {
      endpoint = ILLINOIS_API_URL
    }
     **/

    setRunning(true)
    setShowOutput(true)
    await fetch(endpoint, {
      method: "post",
      body: JSON.stringify(submission),
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include"
    })
      .then(async (r) => Result.check(await r.json()))
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
  }, [mode, active])

  useEffect(() => {
    if (running) {
      aceOutputRef.current?.setValue("Running...")
      aceOutputRef.current?.clearSelection()
    }
  }, [running])

  useEffect(() => {
    if (recordReplayer.current) {
      if (!recordReplayer.current.hasRecording && !replayOnly) {
        recordReplayer.current!.ace.recorders["code"].setSession(active)
      } else {
        recordReplayer.current!.ace.players["code"].setSession(active)
      }
    }
  }, [active])

  useEffect(() => {
    const output = result?.error || result?.result?.outputLines.map(({ line }) => line).join("\n") || ""
    aceOutputRef.current?.setValue(output)
    aceOutputRef.current?.clearSelection()
  }, [result])

  const savedShowOutput = useRef(showOutput)
  useEffect(() => {
    savedShowOutput.current = showOutput
  }, [showOutput])

  const savedShowFiles = useRef(showFiles)
  useEffect(() => {
    savedShowFiles.current = showFiles
  }, [showFiles])

  const savedContainerHeight = useRef(containerHeight)
  useEffect(() => {
    savedContainerHeight.current = containerHeight
  }, [containerHeight])

  const savedDescription = useRef(description)
  useEffect(() => {
    savedDescription.current = description
  }, [description])

  const savedTitle = useRef(title)
  useEffect(() => {
    savedTitle.current = title
  }, [title])


  const savedTag = useRef(tag)
  useEffect(() => {
    savedTag.current = tag
  }, [tag])

  useEffect(() => {
    if (state !== "recording" && state !== "playing") {
      return
    }

    if (!recordReplayer.current) {
      return
    }

    if (recordReplayer.current.duration) {
      setDuration(recordReplayer.current.duration)
    }

    recordStartTime.current = Date.now()
    setTick((t) => !t)
    const timer = setInterval(() => {
      setTick((t) => !t)
    }, 128)
    return () => {
      recordStartTime.current = 0
      clearInterval(timer)
      setTick((t) => !t)
    }
  }, [state])

  const [finishedInitialization, setFinishedInitialization] = useState(false)

  const initialLoad = useRef(true)

  function setupSource() {
    if (!recordReplayer.current) {
      return
    }
    if (recordReplayer.current.state === "playing") {
      recordReplayer.current.pause()
    }

    recordReplayer.current.src = source?.trace
    initialLoad.current === false && recordReplayer.current.play()
    initialLoad.current = false
    let traceSessions = ""
    source!.trace.ace.code.sessionInfo.forEach((info: { name: string, content: string, mode: string }) => {
      traceSessions += traceSessions === "" ? info.name : `,${info.name}`
    })
    setSessions(traceSessions)
    setActive(source!.trace.ace.code.sessionName)
    setTitle(source!.summary.title)
    setTag(source!.summary.tag)
    setShowFiles(source!.summary.showFiles)
    setContainerHeight(source!.summary.containerHeight)
    console.log(source)
  }

  const finishInitialization = useCallback(() => {
    if (Object.keys(editors.current).length !== 2) {
      return
    }
    recordReplayer.current = new MultiRecordReplayer(editors.current, {
      filterRecord: (record, name) => {

        if (name === "code" && (recordReplayer.current.hasRecording || replayOnly)) {
          const r = record as any
          if (r.sessionName) {
            setActive(r.sessionName)
          }
        }

        if (name !== "output" || (record.type !== "external" && record.type !== "complete") || record.external === undefined) {
          return true
        }

        const r = record as any
        let filtered = true
        if (r.external.showOutput !== undefined) {
          setShowOutput(r.external.showOutput)
          filtered = false
        }

        if (r.external.containerHeight !== undefined) {
          setContainerHeight(r.external.containerHeight)
          filtered = false
        }
        return filtered || record.type === "complete"
      }
    })
    recordReplayer.current.addEventListener((e) => {
      if (e === "startedRecording") {
        recordReplayer.current!.ace.recorders["output"].external = {
          showOutput: savedShowOutput.current,
          containerHeight: savedContainerHeight.current
        }
      }
    })


    recordReplayer.current.addStateListener((s) => setState(s))

    recordReplayer.current.addEventListener((e) => {
      if (e === "ended") {
        setValue(0)
      } else if (e === "srcChanged") {
        setHasSource(recordReplayer.current.src !== undefined)
      }
    })

    recordReplayer.current.addEventListener((e) => {
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
      setActive("main.py")
    }
    setFinishedInitialization(true)
  }, [])


  useEffect(() => {
    if (replayOnly) {
      setupSource()
    }
  }, [recordReplayer.current])


  const timer = useRef<ReturnType<typeof setInterval>>()
  useEffect(() => {
    if (state === "playing") {
      timer.current = setInterval(() => {
        setValue(recordReplayer.current.percent)
      }, 100)
    } else {
      timer.current && clearInterval(timer.current)
    }
  }, [state, recordReplayer.current])

  const handleChange = useCallback(
    (event) => {
      recordReplayer.current.percent = event.target.value
      setValue(event.target.value)
    },
    [recordReplayer.current]
  )

  const [uploading, setUploading] = useState(false)
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
      description: e.target.elements.description.value,
      title: e.target.elements.title.value,
      tag: e.target.elements.tag.value,
      containerHeight: savedContainerHeight.current,
      showFiles: savedShowFiles.current
    }).then(() => {
      setUploading(false)
      window.location.href = "/"
    })
  }, [mode])

  useEffect(() => {
    if (!replayOnly) {
      let split = savedTag.current.split(",")
      split[0] = mode
      setTag(split.join(","))
    }
  }, [mode])


  const toggleOutput = useCallback(() => {
    setShowOutput((o) => !o)
  }, [])

  useEffect(() => {
    if (
      state !== "recording" ||
      !recordReplayer.current ||
      !recordReplayer.current?.ace?.recorders["output"].recording
    ) {
      return
    }
    recordReplayer.current.ace.recorders["output"].external = {
      showOutput: savedShowOutput.current
    }
  }, [state, showOutput])

  let message
  if (recorderState === "readyToRecord") {
    if (!data) {
      message = <Collapse in={displayTopMessage}>
        <Alert
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => {
                setDisplayTopMessage(false)
              }}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
          severity="error"
          variant={"filled"}
          sx={{ mb: 2 }}
        >
          you must login to record a coding demo.
        </Alert>
      </Collapse>
    } else
      message = <Collapse in={displayTopMessage}>
        <Alert
          action={
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={() => {
                setDisplayTopMessage(false)
              }}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          }
          severity="info"
          variant={"filled"}
          sx={{ mb: 2 }}
        >
          Use the record button to start recording, play to replay when you are finished, and clear to remove your
          recording.
        </Alert>
      </Collapse>
  } else if (recorderState === "canUpload") {
    message = <Collapse in={displayTopMessage}>
      <Alert
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={() => {
              setDisplayTopMessage(false)
            }}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        }
        severity="success"
        variant={"filled"}
        sx={{ mb: 2 }}
      >
        You may upload your recorded trace using the button below, or clear it and start over.
      </Alert>
    </Collapse>
  } else {
    message = <Collapse in={displayTopMessage}>
      <Alert
        action={
          <IconButton
            aria-label="close"
            color="inherit"
            size="small"
            onClick={() => {
              setDisplayTopMessage(false)
            }}
          >
            <CloseIcon fontSize="inherit" />
          </IconButton>
        }
        severity="info"
        variant={"filled"}
        sx={{ mb: 2 }}
      >
        You are viewing a trace by {source?.summary.email} in {source?.summary.mode}.
      </Alert>
    </Collapse>
  }

  useEffect(() => {
    setDisplayTopMessage(true)
  }, [recorderState, data])


  const outputSwitch = <IconButton color={"primary"} onClick={toggleOutput}>{
    showOutput ? <VisibilityOffOutlinedIcon sx={{ fontSize: "35px" }} /> :
      <VisibilityOutlinedIcon sx={{ fontSize: "35px" }} />
  }</IconButton>

  const settingButton = <IconButton color={"primary"} onClick={(e) => {
    setSettingMenuAnchor(e.currentTarget)
    console.log(settingMenuAnchor)
    setSettingMenuOpen(true)
  }
  }>{
    <SettingsIcon sx={{ fontSize: "35px" }} />
  }</IconButton>


  const shareButton = <IconButton color={"primary"} onClick={() => {
    let height = embedRef.current!.clientHeight
    navigator.clipboard.writeText(`<iframe src="http://localhost:3000/embed/${source!.summary.fileRoot}" width="100%" height="${height}px" style="border:none; overflow: hidden" scrolling="no"> </iframe>`)
  }}>
    <CodeIcon sx={{ fontSize: "35px" }} />
  </IconButton>

  const languageMenu = <Collapse
    timeout="auto"
    in={languageMenuOpen}
    unmountOnExit
  >
    <List sx={{maxHeight: 100, overflow: "auto"}} component="div" disablePadding>
    {
      Object.keys(DEFAULT_FILES).map((language, index) => {
        return <ListItemButton
          key={language}
          selected={mode === language}
          onClick={e => {
            recordReplayer.current!.ace.recorders["code"].clearSessions()
            setMode(language as language)
            let firstSessionName = DEFAULT_FILES[language as language]
            setSessions(firstSessionName)
            recordReplayer.current.ace.recorders["code"].addSession({
              name: firstSessionName,
              contents: "",
              mode: "ace/mode/python"
            })
            recordReplayer.current.ace.recorders["code"].setSession(firstSessionName)
            setActive(firstSessionName)
            setLanguageMenuOpen(false)
          }
          }
        >
          {language}
        </ListItemButton>
      })
    }
    </List>
  </Collapse>

  const playbackMenu = <Collapse
    timeout="auto"
    in={playbackMenuOpen}
    unmountOnExit
  >
    <List sx={{maxHeight: 100, overflow: "auto"}} component="div" disablePadding>
      {
        ["0.5", "1.0", "2.0"].map((speed, index) => {
          return <ListItemButton
            key={speed}
            selected={playbackRate === speed}
            onClick={e => {
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
        <Box sx={{...menuColor}}>
          <List dense sx={{...menuColor, p:0}}>
            <ListItem disabled={replayOnly || !(recorderState === "readyToRecord" && state === "paused")}>
              <ListItemIcon><FolderIcon sx={{...menuColor}}/></ListItemIcon>
              <ListItemText primary="Show File Structure"/>
              <Switch checked={showFiles} onChange={() => setShowFiles(!showFiles)} disabled={replayOnly || !(recorderState === "readyToRecord" && state === "paused")} sx={{...menuColor}} color="warning" edge={"end"}/>
            </ListItem>
            <Divider sx={{bgcolor:grey[50]}}/>
            <ListItem onClick={e => {
                if (!(recorderState === "readyToRecord" && state === "paused")) return
                if(playbackMenuOpen) {
                  setPlaybackMenuOpen(false)
                }
                setLanguageMenuOpen(!languageMenuOpen)
              }
            } style={{cursor:"pointer"}} disabled={!(recorderState === "readyToRecord" && state === "paused")}>
              <ListItemIcon><LanguageIcon sx={{...menuColor}}/></ListItemIcon>
              <ListItemText primary={mode}/>
              {languageMenuOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItem>
            {languageMenu}
            <Divider sx={{bgcolor:grey[50]}}/>
            <ListItem style={{cursor:"pointer"}} onClick={e => {
              if (languageMenuOpen) {
                setLanguageMenuOpen(false)
              }
              setPlaybackMenuOpen(!playbackMenuOpen)
            }}>
              <ListItemIcon><SpeedIcon sx={{...menuColor}}/></ListItemIcon>
              <ListItemText primary={"Playback Speed " + playbackRate}/>
              {playbackMenuOpen ? <ExpandLess /> : <ExpandMore />}
            </ListItem>
            {playbackMenu}
          </List>
        </Box>
      </Popper>
    </ClickAwayListener>



  const recordingSlider = <input
    disabled={state === "recording" || !hasSource || duration===-1}
    type="range"
    min="0"
    max="100"
    step="1"
    onChange={handleChange}
    onMouseDown={() => {
      if (state === "playing" && !wasPlaying) {
        setWasPlaying(true)
        recordReplayer.current.pause()
      }
    }}
    onMouseUp={() => {
      wasPlaying && recordReplayer.current.play()
      setWasPlaying(false)
    }}
    value={value}
  />


  return (
    <div style={{ marginTop: isEmbed ? "0" : "48px" }}>
      {
        !isEmbed && message
      }
      <div className={isEmbed ? "record_embed_container" : "record_regular_container"}>
        <div ref={embedRef} style={{ height: "auto" }}>
          <div className={isEmbed ? "record_editor_container_embed" : "record_editor_container"}>
            <div style={!showFiles && replayOnly ? {display: "none"} : !showFiles ? {visibility: "hidden"} : {}} className={"record_file_tab_container"}>
              {
                sessions.split(",").map((str, idx) => {
                  return <div className={active === str ? "record_file_tab_active record_file_tab" : "record_file_tab"}
                              key={idx} onClick={() => setActive(str)}>{str}</div>
                })
              }


              {
                sessions.split(",").length < 5 && !replayOnly && !hasRecording &&
                <Tooltip title={"Create a new file here, you can create at most 5 files"}>
                  <IconButton sx={{ minHeight: 0, minWidth: 0, padding: 0 }} onClick={() => {
                    let startWithLower = DEFAULT_FILES[mode].split(".")[0][0] === DEFAULT_FILES[mode].split(".")[0][0].toLowerCase()
                    let fileName = startWithLower ? "another" : "Another"
                    fileName += sessions.split(",").length
                    let newSession = fileName + "." + DEFAULT_FILES[mode].split(".")[1]
                    setSessions(sessions + "," + newSession)
                    recordReplayer.current!.ace.recorders["code"].addSession({
                      name: newSession,
                      contents: "",
                      mode: "ace/mode/" + mode
                    })
                    setActive(newSession)
                  }}>
                    <AddIcon />
                  </IconButton>
                </Tooltip>
              }
            </div>

            <ReflexContainer className={"record_editors"} orientation="horizontal"
                             style={{ height: showOutput ? containerHeight + 5 + "px" : containerHeight + "px" }}>
              <ReflexElement onResize={args => {
                if (args.component.props.flex) {
                  setAceEditorHeight(args.component.props.flex)
                }
              }} maxSize={containerHeight} minSize={0}>
                <DefaultAceEditor
                  height={showOutput ? aceEditorHeight * containerHeight + "px" : containerHeight + "px"}
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
                  setAceOutputHeight(args.component.props.flex)
                }
              }} maxSize={containerHeight} minSize={0} style={{ display: showOutput ? "block" : "none" }}>
                <DefaultAceEditor
                  readOnly
                  height={aceOutputHeight * containerHeight + "px"}
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

                    const renderer = ace.renderer as any
                    renderer.$cursorLayer.element.style.display = "none"
                  }}
                />
              </ReflexElement>
            </ReflexContainer>

            {
              !replayOnly &&
              <div ref={containerResizerRef} className={"record_container_resizer"}
                   onMouseDown={recorderState === "readyToRecord" && state === "paused" ? e => {
                     let start = e.pageY
                     const clearEvents = (e: MouseEvent) => {
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
              </div>
            }

          </div>
          <div className={"record_controls_container"}>
            {showOutput ? null : <div style={{ height: "5px", width: "100%" }} />}
            {finishedInitialization &&
              <div>
                <div className={"controls_buttons_container"}>

                  <div className={"controls_buttons_group"}>
                    <Tooltip
                      title={state === "paused" ? "press to start" : state === "recording" ? "press to stop recording" : "press to pause"}>
                      <span>
                        <IconButton
                          color={"primary"}
                          disabled={state === "paused" && !hasSource}
                          onClick={() => {
                            if (state === "paused") {
                              recordReplayer.current.play()
                            } else if (state === "recording") {
                              recordReplayer.current.stop()
                            } else {
                              recordReplayer.current.pause()
                            }
                          }}>
                        {
                          state === "paused" ? <PlayCircleFilledOutlinedIcon sx={{ fontSize: "35px" }} />
                            : state === "recording" ? <StopCircleOutlinedIcon sx={{ fontSize: "35px" }} />
                              : <PauseCircleFilledOutlinedIcon sx={{ fontSize: "35px" }} />
                        }
                      </IconButton>
                      </span>
                    </Tooltip>

                    {
                      replayOnly || hasSource || state === "recording" ? null :
                        <Tooltip title={!(!data || state !== "paused") ? "Press to Start Recording" : ""}>
                          <span>
                            <IconButton color="primary"
                                        disabled={!data || state !== "paused"}
                                        onClick={() => {
                                          recordReplayer.current.record()
                                        }}>
                            <RadioButtonCheckedOutlinedIcon sx={{ fontSize: "35px" }} />
                          </IconButton>
                          </span>
                        </Tooltip>
                    }

                    {
                      replayOnly || (!hasSource && state != "recording") ? null :
                        <Tooltip title={!(!hasSource || state === "recording") ? "Press to Start over" : ""}>
                            <span>
                              <IconButton
                                color="primary"
                                disabled={!hasSource || state === "recording"}
                                onClick={() => {
                                  if (state === "playing") {
                                    recordReplayer.current.pause()
                                  }
                                  recordReplayer.current.src = undefined
                                  setValue(0)
                                }}>
                                <UndoOutlinedIcon sx={{ fontSize: "35px" }} />
                              </IconButton>
                            </span>
                        </Tooltip>
                    }

                  </div>

                  {recordingSlider}
                  {state === "recording" && recordStartTime.current != 0 && (
                    <div className={"controls_time_string"}>
                      {msToTime(Math.floor((Date.now() - recordStartTime.current)))}
                    </div>
                  )}

                  {state != "recording" && ((state === "playing" && duration != -1) || value !== 0) && (
                    <div className={"controls_time_string"}>
                      -{msToTime(duration * 1000 - Math.floor(recordReplayer.current.currentTime * 1000))}
                    </div>
                  )}

                  <div className={"controls_buttons_group"}>
                    {replayOnly && data?.user?.email === source?.summary.email ?
                      <Tooltip title={"copy embed code"}>
                        {shareButton}
                      </Tooltip> : null
                    }

                    <Tooltip title={"show or hide output"}>
                      {outputSwitch}
                    </Tooltip>
                    {
                      settingButton
                    }
                  </div>
                </div>
              </div>

            }
          </div>


          <div className={"record_run_container"}>
            <Button
              disabled={uploading || !hasRecording}
              style={{ visibility: replayOnly ? "hidden" : "visible" }}
              variant="contained"
              type={"submit"}
              form={"meta_data_form"}
              endIcon={<UploadIcon />}
              color={"error"}>Upload
            </Button>
            <div>
              {showFiles ? <Button variant="contained" color="success" onClick={() => run(true)}>Run All</Button> :
              <Button variant="contained" color="success" onClick={() => run(false)}>Run</Button>
              }
            </div>
          </div>

        </div>


        {
          !replayOnly && !isEmbed &&
          <div className={"record_metadata_container"}>
            <form id={"meta_data_form"} onSubmit={(e) => upload(e)}>
              <div className={"record_form_title_container"}>
                <div className={"record_metadata_section_title"}>Title</div>
                <TextField name="title" label={"Title"} fullWidth required variant="outlined" />
              </div>
              <div className={"record_form_tag_container"}>
                <div className={"record_metadata_section_title"}>Tag</div>
                {
                  tag.split(",").map((t, key) => {
                    if (t.trim() == "") return null
                    return <Chip key={key} className={"record_chip"} label={t} />
                  })
                }
              </div>
              <div className={"record_form_tag_input_container"}>
                {tag.split(",").length > 5 ?
                  <TextField required error helperText={"max tag size is 5"} fullWidth value={tag} name="tag"
                             label={"tags, separate by common"} variant="outlined"
                             onChange={event => setTag(event.target.value)} /> :
                  <TextField required fullWidth value={tag} name="tag" label={"tags, separate by common"}
                             variant="outlined" onChange={event => setTag(event.target.value)} />
                }
              </div>
              <div className={"record_form_description_container"}>
                <div className={"record_metadata_section_title"}>Description</div>
                <textarea name={"description"} required={true} className={"record_form_description_ta"} />
              </div>
            </form>
          </div>
        }


        {
          replayOnly && !isEmbed &&
          <div>
            <div className={"record_title_container"}>
              <div className={"record_title"}>{title}</div>
            </div>
            <div className={"record_tag_container"}>
              <span></span>
              {
                tag.split(",").map((t, key) => {
                  return <Chip key={key} className={"record_chip"} label={t} />
                })
              }
            </div>
            <div className={"record_description_container"}>
              <div className={"record_metadata_section_title"}>Description</div>
              <hr />
              <div>{description}</div>
            </div>
          </div>
        }
      </div>
      {settingMenu}
    </div>
  )
}
export default Recorder

function msToTime(duration: number) {
  let seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor((duration / (1000 * 60 * 60)) % 24)

  let hoursStr = (hours < 10) ? "0" + hours : hours.toString(),
    minutesStr = (minutes < 10) ? "0" + minutes : minutes.toString(),
    secondsStr = (seconds < 10) ? "0" + seconds : seconds.toString()

  return minutesStr + ":" + secondsStr
}

const menuColor = {
  bgcolor: grey[800],
  color: grey[50]
}