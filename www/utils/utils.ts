import { USE_MARKDOWN_FLAG } from "./constant"

export const getRandomColor = () => {
  let letters = "BCDEF".split("")
  let color = "#"
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * letters.length)]
  }
  return color
}

export const getReadableTimeString = (timestamp: Date | string): string => {
  const date = new Date(timestamp)
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`
}

export const getProcessingStatusSeverityAndMessage = (processingStatus: string, title: string): { severity: "success" | "info" | "error", message: string } => {
  let severity: "success" | "info" | "error"
  let message: string

  if (processingStatus === "success") {
    severity = "success"
    message = `We had finished processing your recording ${title}`
  } else if (processingStatus === "processing") {
    severity = "info"
    message = `We are still processing your recording ${title}`
  } else {
    severity = "error"
    message = `Sorry, we failed to process your recording ${title}`
  }

  return { severity, message }
}

export const getRecordStatusSeverityAndMessage = (
  recorderStatus: "playingTrace" | "readyToRecord" | "canUpload",
  isLoggedIn: boolean,
  recorderEmail: string | undefined,
  recorderMode: string | undefined
): { severity: "success" | "info" | "error", message: string } => {
  let severity: "success" | "info" | "error"
  let message: string

  if (recorderStatus === "readyToRecord") {
    if (!isLoggedIn) {
      severity = "error"
      message = "you must login to record a coding demo."
    } else {
      severity = "info"
      message = "Use the record button to start recording, play to replay when you are finished, and clear to remove your recording."
    }
  } else if (recorderStatus === "canUpload") {
    severity = "success"
    message = "You may upload your recorded trace using the button below, or clear it and start over."
  } else {
    severity = "info"
    message = `You are viewing a trace by ${recorderEmail} in ${recorderMode}`
  }

  return { severity, message }
}

export const msToTime = (duration: number): string => {
  let seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60)
  //hours = Math.floor((duration / (1000 * 60 * 60)) % 24)

  //hoursStr = (hours < 10) ? "0" + hours : hours.toString(),
  let minutesStr = (minutes < 10) ? "0" + minutes : minutes.toString(),
    secondsStr = (seconds < 10) ? "0" + seconds : seconds.toString()

  return minutesStr + ":" + secondsStr
}

/** Add or remove the markdown flag from description */
export const processMarkDown = (content: string): string => {
  if (content.startsWith(USE_MARKDOWN_FLAG)) {
    return content.replace(USE_MARKDOWN_FLAG, "")
  }
  return USE_MARKDOWN_FLAG + content
}

/** check whether if the description is in markdown */
export const isMarkdown = (content: string): boolean => {
  return content.startsWith(USE_MARKDOWN_FLAG)
}

