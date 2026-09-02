import { useState } from 'react'
import AppChrome from './AppChrome.tsx'
import { defaultBlobParams } from './blobParams.ts'
import type { BlobParams } from './blobParams.ts'
import Scene from './Scene.tsx'
import './App.css'

function App() {
  const [params, setParams] = useState<BlobParams>(defaultBlobParams)

  return (
    <div className="app">
      <div className="viewport">
        <Scene params={params} />
      </div>
      <AppChrome
        params={params}
        onChange={(patch) => setParams((current) => ({ ...current, ...patch }))}
        onReset={() => setParams(defaultBlobParams)}
      />
    </div>
  )
}

export default App
