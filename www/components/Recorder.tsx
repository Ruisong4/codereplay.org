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
  const [recordReplayer, setRecordReplayer] = useState<MultiRecordReplayer | undefined>(undefined)
  const [state, setState] = useState<MultiRecordReplayer.State>("paused")

  const [recorderState, setRecorderState] = useState<"playingTrace" | "readyToRecord" | "canUpload">("readyToRecord")
  const [hasRecording, setHasRecording] = useState(false)
  useEffect(() => {
    recordReplayer?.addStateListener((s) => setState(s))
    recordReplayer?.addEventListener((e) => {
      if (e === "srcChanged") {
        if (recordReplayer.hasRecording) {
          setRecorderState("canUpload")
        } else if (recordReplayer.src === undefined) {
          setRecorderState("readyToRecord")
        } else {
          setRecorderState("playingTrace")
        }
        setHasRecording(recordReplayer.hasRecording)
      }
    })
  }, [recordReplayer, source])

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

  const finishInitialization = useCallback(() => {
    if (Object.keys(editors.current).length !== 2) {
      return
    }
    const newRecordReplayer = new MultiRecordReplayer(editors.current)
    setRecordReplayer(newRecordReplayer)
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
    if (!recordReplayer || !recordReplayer.src) {
      return
    }
    const { ace, audio: audioURL } = recordReplayer.src
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
  }, [recordReplayer, mode])

  const initialLoad = useRef(true)
  useEffect(() => {
    if (!recordReplayer) {
      return
    }
    if (recordReplayer.state === "playing") {
      recordReplayer.pause()
    }
    recordReplayer.src = source?.trace
    initialLoad.current === false && recordReplayer.play()
    initialLoad.current = false
  }, [recordReplayer, source])

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
      {recordReplayer && <PlayerControls recordReplayer={recordReplayer} />}
      {state === "recording" && recordStartTime.current != 0 && (
        <div style={{ display: "flex" }}>{Math.floor((Date.now() - recordStartTime.current) / 1000)}</div>
      )}
      <button onClick={run}>Run</button>
      <DefaultAceEditor
        mode={mode}
        onLoad={(ace) => {
          aceEditorRef.current = ace
          editors.current["code"] = ace
          finishInitialization()
        }}
      />
      <DefaultAceEditor
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
      {hasRecording && (
        <button onClick={upload} disabled={uploading}>
          Upload
        </button>
      )}
    </div>
  )
}
export default Recorder
