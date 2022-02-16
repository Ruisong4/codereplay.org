import { Result, Submission } from "@cs124/playground-types"
import { useCallback, useEffect, useRef, useState } from "react"
import { IAceEditor } from "react-ace/lib/types"
import DefaultAceEditor from "./DefaultAceEditor"

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

const Recorder: React.FC = () => {
  const aceEditorRef = useRef<IAceEditor>()
  const aceOutputRef = useRef<IAceEditor>()

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
    const result = await fetch(PLAYGROUND_ENDPOINT, {
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
    // TODO: Use safe change value
    aceOutputRef.current?.setValue(output)
    aceOutputRef.current?.clearSelection()
  }, [result])

  return (
    <div>
      <button onClick={run}>Run</button>
      <DefaultAceEditor
        mode={mode}
        onLoad={(ace) => {
          aceEditorRef.current = ace
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
          const renderer = ace.renderer as any
          renderer.$cursorLayer.element.style.display = "none"
        }}
      />
    </div>
  )
}
export default Recorder
