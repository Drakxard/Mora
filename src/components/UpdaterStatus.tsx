"use client"

import { useState } from "react"

function UpdaterStatus() {
  const [progress, setProgress] = useState<any>(null)
  const [message, setMessage] = useState<string>("")

  // Comentar estas líneas hasta que se implementen en el backend de Electron
  // window.electron.onDownloadProgress((progressObj) => {
  //   setProgress(progressObj)
  // })

  // window.electron.onUpdaterMessage((message) => {
  //   setMessage(message)
  // })

  return (
    <div>
      {progress && <div>Download Progress: {progress.percent}%</div>}
      {message && <div>Message: {message}</div>}
    </div>
  )
}

export default UpdaterStatus
