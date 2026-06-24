import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

;(window as Window & { __APP_BOOTED__?: boolean }).__APP_BOOTED__ = true

ReactDOM.createRoot(document.getElementById('root')!).render(<App />)

