import { Ace, MultiRecordReplayer } from "@codereplay/ace-recorder"
import { TraceSummary, SessionInfo } from "@codereplay/types"
import { Result, Submission } from "@cs124/playground-types"
import { useCallback, useEffect, useRef, useState } from "react"
import { IAceEditor } from "react-ace/lib/types"
import { uploadTrace } from "../lib/uploader"
import DefaultAceEditor from "./DefaultAceEditor"
import PlayerControls from "./PlayerControls"
import { ReflexContainer, ReflexSplitter, ReflexElement, HandlerProps } from "react-reflex"
import { useSession } from "next-auth/react"

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
  scala3: "Main.sc",
} as Record<language, string>

const Recorder: React.FC<{ source: { summary: TraceSummary; trace: MultiRecordReplayer.Content } | undefined }> = ({
  source,
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

  const [containerHeight, setContainerHeight] = useState(200)
  const [aceEditorHeight, setAceEditorHeight] = useState(1 / 2)
  const [aceOutputHeight, setAceOutputHeight] = useState(1 / 2)

  const [active, setActive] = useState<string>("main.py")
  const [sessions, setSessions] = useState<string>("main.py")

  const run = useCallback(async (runAll=false) => {
    if (!aceEditorRef.current) {
      return
    }
    const content = aceEditorRef.current.getValue()
    if (content.trim() === "") {
      return
    }

    let path = DEFAULT_FILES[mode]

    const submission = Submission.check({
      image: `cs124/playground-runner-${mode}`,
      filesystem: [{ path, contents: content }],
      timeout: 8000,
    })

    if (runAll) {
      let sessions = recordReplayer.current!.ace.recorders["code"].getSessionsInfo();
      submission.filesystem = sessions.map((session: SessionInfo) => {
        return {path: session.name, contents: session.contents}
      })
    }

    let endpoint = PLAYGROUND_ENDPOINT;
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
        "Content-Type": "application/json",
      },
      credentials: "include",
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
  }, [mode])

  useEffect(() => {
    if (running) {
      aceOutputRef.current?.setValue("Running...")
      aceOutputRef.current?.clearSelection()
    }
  }, [running])

  useEffect(() => {
    if (recordReplayer.current)
    recordReplayer.current!.ace.recorders["code"].setSession(active)
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

  const savedContainerHeight = useRef(containerHeight)
  useEffect(() => {
    savedContainerHeight.current = containerHeight
  }, [containerHeight])


  const [finishedInitialization, setFinishedInitialization] = useState(false)
  const finishInitialization = useCallback(() => {
    if (Object.keys(editors.current).length !== 2) {
      return
    }
    recordReplayer.current = new MultiRecordReplayer(editors.current, {
      filterRecord: (record, name) => {
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
      },
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
    recordReplayer.current.ace.recorders["code"].addSession({name: "main.py", contents: "", mode: "ace/mode/python"})
    recordReplayer.current.ace.recorders["code"].setSession("main.py")
    setActive("main.py")
    setFinishedInitialization(true)
  }, [])

  const [, setTick] = useState(true)
  const recordStartTime = useRef(0)

  useEffect(() => {
    if (state !== "recording") {
      return
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

  const [uploading, setUploading] = useState(false)
  const upload = useCallback(async () => {
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
    uploadTrace({ trace: ace, mode }, audio).then(() => {
      setUploading(false)
    })
  }, [mode])

  const initialLoad = useRef(true)
  useEffect(() => {
    if (!recordReplayer.current) {
      return
    }
    if (recordReplayer.current.state === "playing") {
      recordReplayer.current.pause()
    }
    recordReplayer.current.src = source?.trace
    initialLoad.current === false && recordReplayer.current.play()
    initialLoad.current = false
  }, [source])

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
    message = (
      <p>
        Use the record button to start recording, play to replay when you are finished, and clear to remove your
        recording.
      </p>
    )
  } else if (recorderState === "canUpload") {
    message = <p>You may upload your recorded trace using the button below, or clear it and start over.</p>
  } else {
    message = (
      <p>
        You are viewing a trace by {source?.summary.email} in {source?.summary.mode}.
      </p>
    )
  }
  return (
    <div>
      {message}
      {finishedInitialization && <PlayerControls recordReplayer={recordReplayer.current!} />}
      {state === "recording" && recordStartTime.current != 0 && (
        <div style={{ display: "flex" }}>{Math.floor((Date.now() - recordStartTime.current) / 1000)}</div>
      )}
      <div style={{ display: "flex", flexDirection: "row" }}>
        <button onClick={()=>run(false)}>Run</button>
        <button onClick={()=>run(true)}>Run All</button>
        <button onClick={toggleOutput}>{showOutput ? "Hide" : "Show"} Output</button>
        <select disabled={!(recorderState === "readyToRecord" && state === "paused")}  onChange={e => {
          recordReplayer.current!.ace.recorders["code"].clearSessions();
          setMode((e as React.ChangeEvent<HTMLSelectElement>).target.value as language);
          setSessions(DEFAULT_FILES[(e as React.ChangeEvent<HTMLSelectElement>).target.value as language])
        }}>
          {recorderState === "playingTrace" ?
            <option value={source?.summary.mode}>{source?.summary.mode}</option>
            : Object.keys(DEFAULT_FILES).map(ele => <option key={ele} value={ele}>{ele}</option>)
          }
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "row" }}>
        {sessions.split(",").map((str, idx) => {
          return <button key={idx} onClick={() => setActive(str)}>{str}</button>
        })}
        <button onClick={()=>{
          let newSession = "Another" + sessions.split(",").length + "." + DEFAULT_FILES[mode].split(".")[1]
          setSessions(sessions + "," + newSession)
          recordReplayer.current!.ace.recorders["code"].addSession( { name: newSession, contents: "", mode: "ace/mode/" + mode })
          setActive(newSession)
        }}>Create New File</button>
        {active}
      </div>

      <ReflexContainer orientation="horizontal" style={{height:showOutput ? containerHeight + 5 + "px" : containerHeight + "px", display:"flex", flexDirection:"column"}}>
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
        <ReflexSplitter style={{height:"5px", backgroundColor:"black", cursor:"row-resize", display: showOutput ? "block" : "none"}}/>
        <ReflexElement onResize={args => {
          if (args.component.props.flex) {
            setAceOutputHeight(args.component.props.flex)
          }
        }} maxSize={containerHeight} minSize={0} style={{display: showOutput ? "block" : "none"}}>
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
      {recorderState === "readyToRecord" && state === "paused" && (
        <div ref={containerResizerRef} style={{height: "5px", width:"100%", backgroundColor:"black", cursor: "row-resize"}} onMouseDown={e => {
          let start = e.pageY
          const clearEvents = (e: MouseEvent) => {
            document.removeEventListener("mouseup", clearEvents)
            document.removeEventListener("mousemove", resizeContainer)
          }
          const resizeContainer = (e: MouseEvent) => {
            setContainerHeight(containerHeight + e.pageY - start)
          }

          document.addEventListener('mouseup', clearEvents)
          document.addEventListener('mousemove', resizeContainer)
        }}>
        </div>
      )}
      {hasRecording && (
        <button onClick={upload} disabled={uploading}>
          Upload
        </button>
      )}
      {/*
      <DefaultAceEditor
        height={showOutput ? "64px" : "128px"}
        maxLines={0}
        mode={mode}
        onLoad={(ace) => {
          aceEditorRef.current = ace
          editors.current["code"] = ace
          finishInitialization()
        }}
      />
      <div style={{ display: showOutput ? "block" : "none" }}>
        <DefaultAceEditor
          height={"64px"}
          readOnly
          showGutter={false}
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
      </div>
      {hasRecording && (
        <button onClick={upload} disabled={uploading}>
          Upload
        </button>
      )}
      */}
    </div>
  )
}
export default Recorder