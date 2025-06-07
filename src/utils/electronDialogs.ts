// utils/electronDialogs.ts

interface ConfirmDialogOptions {
  title: string
  message: string
  detail?: string
  buttons?: string[]
}

export const showConfirmDialog = async (options: ConfirmDialogOptions): Promise<boolean> => {
  // Si estamos en Electron, usar el diálogo nativo
  if (window.electron) {
    try {
      const result = await window.electron.showMessageBox({
        type: "question",
        buttons: options.buttons || ["Sí", "No"],
        title: options.title,
        message: options.message,
        detail: options.detail,
      })
      return result.response === 0 // El primer botón (Sí) es 0
    } catch (error) {
      console.error("Error mostrando diálogo de confirmación:", error)
    }
  }

  // Fallback para navegador web
  return window.confirm(`${options.title}\n\n${options.message}\n${options.detail || ""}`)
}
