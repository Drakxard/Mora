"use client"

import type React from "react"

interface ButtonProps {
  children: React.ReactNode
  onClick?: () => void
  variant?: "primary" | "secondary"
  size?: "sm" | "md" | "lg"
  disabled?: boolean
  leftIcon?: React.ReactNode
  className?: string
  type?: "button" | "submit" | "reset"
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = "primary",
  size = "md",
  disabled = false,
  leftIcon,
  className = "",
  type = "button",
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2"

  const variantClasses = {
    primary: "bg-primary text-white hover:bg-primary/90 focus:ring-primary",
    secondary:
      "bg-background-tertiary text-text-primary hover:bg-background-tertiary/80 focus:ring-background-tertiary",
  }

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  }

  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : ""

  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${disabledClasses} ${className}`

  return (
    <button type={type} className={classes} onClick={onClick} disabled={disabled}>
      {leftIcon && <span className="mr-2">{leftIcon}</span>}
      {children}
    </button>
  )
}

export default Button
