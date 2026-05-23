import { useState, useEffect } from 'react'
import { p2 } from '../utils/helpers'

export function useClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const days = ['日', '月', '火', '水', '木', '金', '土']
  const timeStr = `${p2(now.getHours())}:${p2(now.getMinutes())}:${p2(now.getSeconds())}`
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日（${days[now.getDay()]}）`

  return { now, timeStr, dateStr }
}
