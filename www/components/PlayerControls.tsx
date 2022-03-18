import { IRecordReplayer } from "@codereplay/types"
import { MultiRecordReplayer } from "@codereplay/ace-recorder"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useRef, useState } from "react"
import { IconButton, Tooltip } from "@mui/material"
import PlayCircleFilledOutlinedIcon from "@mui/icons-material/PlayCircleFilledOutlined"
import PauseCircleFilledOutlinedIcon from "@mui/icons-material/PauseCircleFilledOutlined"
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined"
import RadioButtonCheckedOutlinedIcon from "@mui/icons-material/RadioButtonCheckedOutlined"
import UndoOutlinedIcon from "@mui/icons-material/UndoOutlined"

const PlayerControls: React.FC<{
  recordReplayer: MultiRecordReplayer,
  outputSwitch: IconButton,
  share: IconButton,
  modeSwitch: HTMLSelectElement,
  replayOnly: Boolean
}> = ({ recordReplayer, outputSwitch, modeSwitch, replayOnly ,share}) => {
  const { data } = useSession()
  const [wasPlaying, setWasPlaying] = useState(false)
  const [value, setValue] = useState(0)
  const [state, setState] = useState<IRecordReplayer.State>("paused")
  const [hasSource, setHasSource] = useState(false)
  const [duration, setDuration] = useState(-1.0)

  const [, setTick] = useState(true)
  const recordStartTime = useRef(0)

  useEffect(() => {
    if (state !== "recording" && state !== "playing") {
      return
    }

    if (recordReplayer.duration) {
      setDuration(recordReplayer.duration)
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

  useEffect(() => {
    recordReplayer.addStateListener((s) => {
      setState(s)
      console.log(s)
    })
    recordReplayer.addEventListener((e) => {
      if (e === "ended") {
        setValue(0)
      } else if (e === "srcChanged") {
        setHasSource(recordReplayer.src !== undefined)
      }
    })
  }, [recordReplayer])

  const handleChange = useCallback(
    (event) => {
      recordReplayer.percent = event.target.value
      setValue(event.target.value)
    },
    [recordReplayer]
  )

  const timer = useRef<ReturnType<typeof setInterval>>()
  useEffect(() => {
    if (state === "playing") {
      timer.current = setInterval(() => {
        setValue(recordReplayer.percent)
      }, 100)
    } else {
      timer.current && clearInterval(timer.current)
    }
  }, [state, recordReplayer])

  const [playbackRate, setPlaybackRate] = useState("1.0")
  useEffect(() => {
    recordReplayer.playbackRate = parseFloat(playbackRate)
  }, [playbackRate, recordReplayer])

  return (
    <div>
      <input
        disabled={state === "recording" || !hasSource}
        type="range"
        min="0"
        max="100"
        step="1"
        onChange={handleChange}
        onMouseDown={() => {
          if (state === "playing" && !wasPlaying) {
            setWasPlaying(true)
            recordReplayer.pause()
          }
        }}
        onMouseUp={() => {
          wasPlaying && recordReplayer.play()
          setWasPlaying(false)
        }}
        value={value}
      />
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
                    recordReplayer.play()
                  } else if (state === "recording") {
                    recordReplayer.stop()
                  } else {
                    recordReplayer.pause()
                  }
                }}>
              {
                state === "paused" ? <PlayCircleFilledOutlinedIcon sx={{ fontSize: "40px" }} />
                  : state === "recording" ? <StopCircleOutlinedIcon sx={{ fontSize: "40px" }} />
                    : <PauseCircleFilledOutlinedIcon sx={{ fontSize: "40px" }} />
              }
            </IconButton>
            </span>
          </Tooltip>

          {
            replayOnly ? null :
              <Tooltip title={!(!data || state !== "paused") ? "Press to Start Recording" : ""}>
                <span>
                  <IconButton
                    color="primary"
                    disabled={!data || state !== "paused"}
                    onClick={() => {
                      recordReplayer.record()
                    }}>
                  <RadioButtonCheckedOutlinedIcon sx={{ fontSize: "40px" }} />
                </IconButton>
                </span>

              </Tooltip>
          }

          {
            replayOnly ? null :
              <Tooltip title={!(!hasSource || state === "recording") ? "Press to Start over" : ""}>
                <span>
                  <IconButton
                    color="primary"
                    disabled={!hasSource || state === "recording"}
                    onClick={() => {
                      if (state === "playing") {
                        recordReplayer.pause()
                      }
                      recordReplayer.src = undefined
                    }}>
                  <UndoOutlinedIcon sx={{ fontSize: "40px" }} />
                </IconButton>
                </span>
              </Tooltip>
          }

        </div>

        {state === "recording" && recordStartTime.current != 0 && (
          <div className={"controls_time_string"}>{
            msToTime(Math.floor((Date.now() - recordStartTime.current)))
          } / {msToTime(Math.floor((Date.now() - recordStartTime.current)))}</div>
        )}

        {((state === "playing" && duration != -1) || value !== 0) && (
          <div className={"controls_time_string"}>{
            msToTime(duration * 1000)
          } / {msToTime(Math.floor(recordReplayer.currentTime * 1000))}</div>
        )}

        <div className={"controls_buttons_group"}>
          { replayOnly ?
            <Tooltip title={"copy embed code"}>
              {share}
            </Tooltip> : null
          }

          <Tooltip title={"show or hide output"}>
            {outputSwitch}
          </Tooltip>
          {
            modeSwitch
          }
          <select id="playbackRate" onChange={(e) => setPlaybackRate(e.target.value)} value={playbackRate.toString()}>
            <option value="0.5">0.5 Speed</option>
            <option value="1.0">1.0 Speed</option>
            <option value="2.0">2.0 Speed</option>
          </select>
        </div>
      </div>
    </div>
  )
}
export default PlayerControls


function msToTime(duration: number) {
  let seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor((duration / (1000 * 60 * 60)) % 24)

  let hoursStr = (hours < 10) ? "0" + hours : hours.toString(),
    minutesStr = (minutes < 10) ? "0" + minutes : minutes.toString(),
    secondsStr = (seconds < 10) ? "0" + seconds : seconds.toString()

  return hoursStr + ":" + minutesStr + ":" + secondsStr
}

{/**
 <button
 disabled={state !== "paused"}
 onClick={() => {
              Object.values(recordReplayer.ace.players).forEach((player) => {
                player.editor.setValue("")
                player.editor.clearSelection()
              })
            }}
 >
 Reset
 </button>
 **/
  /** out of Icons **/
}