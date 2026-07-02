import { useEffect, useRef } from "react"

// Cloudflare Turnstile widget — vanilla script approach, no npm dependency.
// Script URL and render API verified against Cloudflare's official docs
// (developers.cloudflare.com/turnstile) at implementation time.
//
// NOTE: Cloudflare's dashboard/API can change over time — if this stops
// working, check developers.cloudflare.com/turnstile for current syntax.

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js"

export default function TurnstileWidget({ siteKey, onVerify, onExpire }) {
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    const renderWidget = () => {
      if (cancelled || !window.turnstile || !containerRef.current) return
      if (widgetIdRef.current) return // already rendered

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        "expired-callback": onExpire,
        theme: "light",
      })
    }

    if (window.turnstile) {
      renderWidget()
    } else {
      // Script abhi load nahi hua — inject karo (sirf ek baar poore app mein)
      const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`)
      if (!existing) {
        const script = document.createElement("script")
        script.src = SCRIPT_SRC
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }
      // Poll karo jab tak window.turnstile available na ho jaaye
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval)
          renderWidget()
        }
      }, 200)
      return () => {
        cancelled = true
        clearInterval(interval)
      }
    }

    return () => { cancelled = true }
  }, [siteKey, onVerify, onExpire])

  return <div ref={containerRef} />
}