import { TraceSummary } from "@codereplay/types"
import { Ace, MultiRecordReplayer } from "@cs124/ace-recorder"
import { Result, Submission } from "@cs124/playground-types"
import { useCallback, useEffect, useRef, useState } from "react"
import { IAceEditor } from "react-ace/lib/types"
import { uploadTrace } from "../lib/uploader"
import DefaultAceEditor from "./DefaultAceEditor"
import PlayerControls from "./PlayerControls"

const PLAYGROUND_ENDPOINT = `${process.env.NEXT_PUBLIC_API_URL}/playground`

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
  const recordReplayer = useRef<MultiRecordReplayer>()
  const [state, setState] = useState<MultiRecordReplayer.State>("paused")
  const [showOutput, setShowOutput] = useState(false)

  const [recorderState, setRecorderState] = useState<"playingTrace" | "readyToRecord" | "canUpload">("readyToRecord")
  const [hasRecording, setHasRecording] = useState(false)

  const [mode, setMode] = useState<language>("python")
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ result?: Result; error?: string } | undefined>()

  const run = useCallback(async () => {
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

    setRunning(true)
    setShowOutput(true)
    await fetch(PLAYGROUND_ENDPOINT, {
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
    const output = result?.error || result?.result?.outputLines.map(({ line }) => line).join("\n") || ""
    aceOutputRef.current?.setValue(output)
    aceOutputRef.current?.clearSelection()
  }, [result])

  const savedShowOutput = useRef(showOutput)
  useEffect(() => {
    savedShowOutput.current = showOutput
  }, [showOutput])

  const [finishedInitialization, setFinishedInitialization] = useState(false)
  const finishInitialization = useCallback(() => {
    if (Object.keys(editors.current).length !== 2) {
      return
    }
    recordReplayer.current = new MultiRecordReplayer(editors.current, {
      filterRecord: (record, name) => {
        if (name !== "output" || record.type !== "external") {
          return true
        }
        const r = record as any
        if (r.showOutput !== undefined) {
          setShowOutput(r.showOutput)
          return false
        }
        return true
      },
    })
    recordReplayer.current.addEventListener((e) => {
      if (e === "startedRecording") {
        recordReplayer.current!.ace.recorders["output"].addExternalChange({ showOutput: savedShowOutput.current })
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
    recordReplayer.current.ace.recorders["output"].addExternalChange({
      showOutput,
    })
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
        <button onClick={run}>Run</button>
        <button onClick={toggleOutput}>{showOutput ? "Hide" : "Show"} Output</button>
      </div>
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
    </div>
  )
}
export default Recorder
