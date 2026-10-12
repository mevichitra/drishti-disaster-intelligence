import { useEffect, useRef, useState } from 'react'

export async function api(path, opts) {
  const r = await fetch('/api' + path, opts)
  if (!r.ok) throw new Error(`${path} -> ${r.status}`)
  return r.json()
}

// poll an endpoint; returns { data, error, reload }
export function usePoll(path, intervalMs = 6000) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const alive = useRef(true)
  const load = () =>
    api(path)
      .then((d) => alive.current && (setData(d), setError(null)))
      .catch((e) => alive.current && setError(e))
  useEffect(() => {
    alive.current = true
    setData(null)
    load()
    const t = intervalMs ? setInterval(load, intervalMs) : null
    return () => {
      alive.current = false
      if (t) clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, intervalMs])
  return { data, error, reload: load }
}
