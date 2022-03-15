export const uploadTrace = async (
  trace: object,
  audio: ArrayBuffer,
  metadata: object = {},
  progress: (loaded: number) => void = () => {}
): Promise<any> => {
  const formData = new FormData()
  formData.append("trace", new Blob([JSON.stringify(trace)], { type: "application/json" }), "trace.json")
  formData.append("audio", new Blob([audio], { type: "application/octet-stream" }), "audio.mp4")
  formData.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }), "metadata.json")
  /*
  // Example with fetch
  fetch(`${process.env.NEXT_PUBLIC_API_URL}/upload`, { method: "POST", body: formData, credentials: "include" }).then(
      async (r) => {
        console.log(r)
      }
    )
  */

  // XHR to monitor progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.withCredentials = true
    xhr.open("POST", `${process.env.NEXT_PUBLIC_API_URL}/upload`)
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        resolve(xhr.response)
      } else {
        reject({
          status: this.status,
          statusText: xhr.statusText,
        })
      }
    }
    xhr.upload.onprogress = (e) => {
      progress(e.loaded)
    }
    xhr.onerror = function () {
      reject({
        status: this.status,
        statusText: xhr.statusText,
      })
    }
    xhr.send(formData)
  }).then((r) => {
    console.log(r)
  })
}
