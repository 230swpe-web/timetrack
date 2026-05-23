import { useState, useRef } from 'react'
import useAppStore from '../store/useAppStore'

export default function Login() {
  const [buf, setBuf] = useState('')
  const [dots, setDots] = useState([false, false, false, false])
  const [errDots, setErrDots] = useState(false)
  const [errMsg, setErrMsg] = useState('')
  const [preview, setPreview] = useState('')
  const [shake, setShake] = useState(false)
  const [checking, setChecking] = useState(false)
  const loginWithPin = useAppStore(s => s.loginWithPin)
  const allStaff = useAppStore(s => s.allStaff)

  const updateUI = (newBuf) => {
    setDots([0, 1, 2, 3].map(i => i < newBuf.length))
    setErrDots(false)
    if (!newBuf) {
      setPreview('')
      return
    }
    if ('0000'.startsWith(newBuf)) { setPreview('管理者'); return }
    // Preview uses allStaff from store if loaded, otherwise blank (will be checked on submit)
  }

  const press = (d) => {
    if (buf.length >= 4 || checking) return
    const newBuf = buf + d
    setBuf(newBuf)
    updateUI(newBuf)
    if (newBuf.length === 4) {
      setTimeout(() => check(newBuf), 150)
    }
  }

  const del = () => {
    if (checking) return
    const newBuf = buf.slice(0, -1)
    setBuf(newBuf)
    setErrMsg('')
    updateUI(newBuf)
  }

  const check = async (pin) => {
    setChecking(true)
    const result = await loginWithPin(pin)
    if (!result.success) {
      setErrDots(true)
      setErrMsg('PINが違います')
      setShake(true)
      setTimeout(() => {
        setShake(false)
        setBuf('')
        setDots([false, false, false, false])
        setErrDots(false)
        setErrMsg('')
        setPreview('')
        setChecking(false)
      }, 600)
    }
  }

  const dotClass = (i) => {
    const on = dots[i]
    if (errDots) return 'pd err'
    if (on) return 'pd on'
    return 'pd'
  }

  const nums = ['1','2','3','4','5','6','7','8','9']

  return (
    <div className="login-wrap">
      <div style={{ textAlign: 'center' }}>
        <div className="logo"><span className="logo-mark">⏱</span>TimeTrack</div>
        <div className="logo-sub">PINを入力してください</div>
      </div>

      <div className="preview">{preview || ' '}</div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
        <div className="pin-dots">
          {[0,1,2,3].map(i => <div key={i} className={dotClass(i)} />)}
        </div>
        <div className="pin-err">{errMsg || ' '}</div>
      </div>

      <div className={`numpad${shake ? ' shake' : ''}`}>
        {nums.map(n => (
          <button key={n} className="nb" onClick={() => press(n)}>{n}</button>
        ))}
        <button className="nb dl" onClick={del}>⌫</button>
        <button className="nb z" onClick={() => press('0')}>0</button>
        <div />
      </div>

      <div className="adm-hint">管理者ログイン: 0000</div>
    </div>
  )
}
