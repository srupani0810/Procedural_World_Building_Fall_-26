import AppChrome from './AppChrome.tsx'
import Scene from './Scene.tsx'
import './App.css'

function App() {
  return (
    <div className="app">
      <div className="viewport">
        <Scene />
      </div>
      <AppChrome />
    </div>
  )
}

export default App
