"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Download, RefreshCw, CheckCircle, AlertCircle, Info } from "lucide-react"
import Button from "../ui/Button"

interface UpdateInfo {
  version: string
  releaseDate: string
  releaseName?: string
  releaseNotes?: string
}

interface DownloadProgress {
  bytesPerSecond: number
  percent: number
  transferred: number
  total: number
}

const UpdaterSettings: React.FC = () => {
  const [currentVersion, setCurrentVersion] = useState<string>("")
  const [isChecking, setIsChecking] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [error, setError] = useState<string>("")
  const [message, setMessage] = useState<string>("")

  // Verificar si estamos en Electron
  const isElectron = typeof window !== "undefined" && window.electron

  useEffect(() => {
    if (!isElectron) {
      setCurrentVersion("1.0.0 (Web)")
      return
    }

    // Obtener versión actual solo si estamos en Electron
    if (window.electron?.getAppVersion) {
      window.electron
        .getAppVersion()
        .then(setCurrentVersion)
        .catch((error) => {
          console.error("Failed to get app version:", error)
          setCurrentVersion("Desconocida")
        })
    }

    // Configurar listeners solo si estamos en Electron
    if (window.electron?.onUpdaterChecking) {
      const removeChecking = window.electron.onUpdaterChecking(() => {
        setIsChecking(true)
        setError("")
        setMessage("Verificando actualizaciones...")
      })

      const removeUpdateAvailable = window.electron.onUpdateAvailable((info: UpdateInfo) => {
        setIsChecking(false)
        setUpdateAvailable(info)
        setMessage(`Nueva versión disponible: ${info.version}`)
      })

      const removeUpdateNotAvailable = window.electron.onUpdateNotAvailable(() => {
        setIsChecking(false)
        setMessage("Tu aplicación está actualizada")
      })

      const removeError = window.electron.onUpdaterError((errorMsg: string) => {
        setIsChecking(false)
        setIsDownloading(false)
        setError(`Error al verificar actualizaciones: ${errorMsg}`)
      })

      const removeDownloadProgress = window.electron.onDownloadProgress((progress: DownloadProgress) => {
        setDownloadProgress(progress)
      })

      const removeUpdateDownloaded = window.electron.onUpdateDownloaded(() => {
        setIsDownloading(false)
        setUpdateDownloaded(true)
        setMessage("Actualización descargada. ¡Listo para instalar!")
      })

      // Cleanup
      return () => {
        removeChecking()
        removeUpdateAvailable()
        removeUpdateNotAvailable()
        removeError()
        removeDownloadProgress()
        removeUpdateDownloaded()
      }
    }
  }, [isElectron])

  const handleCheckForUpdates = async () => {
    if (!isElectron) {
      setError("Las actualizaciones solo están disponibles en la aplicación de escritorio")
      return
    }

    setError("")
    setMessage("")
    setUpdateAvailable(null)
    setUpdateDownloaded(false)

    try {
      if (window.electron?.checkForUpdates) {
        const result = await window.electron.checkForUpdates()
        if (!result.available && result.message) {
          setMessage(result.message)
        } else if (result.error) {
          setError(result.error)
        }
      }
    } catch (err: any) {
      setError(`Error al verificar actualizaciones: ${err.message}`)
    }
  }

  const handleDownloadUpdate = async () => {
    if (!isElectron || !window.electron?.downloadUpdate) return

    setIsDownloading(true)
    setDownloadProgress(null)

    try {
      const result = await window.electron.downloadUpdate()
      if (!result.success) {
        setError(result.error || "Error al descargar la actualización")
        setIsDownloading(false)
      }
    } catch (err: any) {
      setError(`Error al descargar: ${err.message}`)
      setIsDownloading(false)
    }
  }

  const handleInstallUpdate = () => {
    if (!isElectron || !window.electron?.installUpdate) return
    window.electron.installUpdate()
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  if (!isElectron) {
    return (
      <div className="bg-background-secondary rounded-lg p-6">
        <h3 className="text-lg font-medium text-text-primary mb-4">Actualizaciones</h3>
        <div className="flex items-center p-4 bg-background-tertiary rounded-lg">
          <Info size={20} className="text-blue-400 mr-3" />
          <div>
            <p className="text-text-secondary mb-2">
              Las actualizaciones automáticas solo están disponibles en la aplicación de escritorio.
            </p>
            <p className="text-text-tertiary text-sm">Versión actual: {currentVersion}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background-secondary rounded-lg p-6">
      <h3 className="text-lg font-medium text-text-primary mb-4">Actualizaciones</h3>

      <div className="space-y-4">
        {/* Versión actual */}
        <div className="flex items-center justify-between">
          <span className="text-text-secondary">Versión actual:</span>
          <span className="text-text-primary font-medium">{currentVersion}</span>
        </div>

        {/* Botón de verificar actualizaciones */}
        <Button
          onClick={handleCheckForUpdates}
          disabled={isChecking || isDownloading}
          leftIcon={<RefreshCw size={18} className={isChecking ? "animate-spin" : ""} />}
          className="w-full"
        >
          {isChecking ? "Verificando..." : "Verificar actualizaciones"}
        </Button>

        {/* Mensajes de estado */}
        {message && (
          <div className="flex items-center p-3 bg-blue-900/20 border border-blue-800 rounded-md">
            <CheckCircle size={18} className="text-blue-400 mr-2" />
            <p className="text-blue-300 text-sm">{message}</p>
          </div>
        )}

        {/* Errores */}
        {error && (
          <div className="flex items-center p-3 bg-red-900/20 border border-red-800 rounded-md">
            <AlertCircle size={18} className="text-red-400 mr-2" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Información de actualización disponible */}
        {updateAvailable && (
          <div className="bg-background-tertiary rounded-lg p-4">
            <h4 className="text-text-primary font-medium mb-2">Nueva versión disponible: {updateAvailable.version}</h4>
            {updateAvailable.releaseName && (
              <p className="text-text-secondary text-sm mb-2">{updateAvailable.releaseName}</p>
            )}
            {updateAvailable.releaseNotes && (
              <div className="text-text-secondary text-sm mb-3">
                <p className="font-medium mb-1">Notas de la versión:</p>
                <div className="whitespace-pre-wrap">{updateAvailable.releaseNotes}</div>
              </div>
            )}

            {!updateDownloaded && (
              <Button
                onClick={handleDownloadUpdate}
                disabled={isDownloading}
                leftIcon={<Download size={18} />}
                className="w-full"
              >
                {isDownloading ? "Descargando..." : "Descargar actualización"}
              </Button>
            )}
          </div>
        )}

        {/* Progreso de descarga */}
        {isDownloading && downloadProgress && (
          <div className="bg-background-tertiary rounded-lg p-4">
            <div className="flex justify-between text-sm text-text-secondary mb-2">
              <span>Descargando actualización...</span>
              <span>{Math.round(downloadProgress.percent)}%</span>
            </div>
            <div className="w-full bg-background rounded-full h-2 mb-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-text-tertiary">
              <span>
                {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
              </span>
              <span>{formatBytes(downloadProgress.bytesPerSecond)}/s</span>
            </div>
          </div>
        )}

        {/* Botón de instalación */}
        {updateDownloaded && (
          <Button
            onClick={handleInstallUpdate}
            leftIcon={<CheckCircle size={18} />}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Instalar y reiniciar
          </Button>
        )}
      </div>
    </div>
  )
}

export default UpdaterSettings
