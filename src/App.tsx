import { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { CozyRoom } from './components/CozyRoom'
import { Lighting } from './components/Lighting'
import { Character } from './components/Character'
import { CameraController } from './components/CameraController'

import * as THREE from 'three'

type ViewState = 'room' | 'desk' | 'bed'

function App() {
  const [view, setView] = useState<ViewState>('room')
  const [targetPosition, setTargetPosition] = useState<THREE.Vector3 | null>(null)
  const [skinColor, setSkinColor] = useState<string>('#ffcba4') // Default Peach

  const skinTones = ['#ffcba4', '#f1c27d', '#e0ac69', '#8d5524', '#c68642', '#3d2c23']

  return (
    <div style={{ width: '100vw', height: '100vh', backgroundColor: '#18122B', position: 'relative' }}>

      {/* HTML UI OVERLAY */}
      <div style={{
        position: 'absolute', top: 0, right: 0, padding: '20px',
        display: 'flex', flexDirection: 'column', gap: '10px', zIndex: 10
      }}>
        <button
          onClick={() => setView('room')}
          style={{ padding: '10px', background: '#453163', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontFamily: 'monospace' }}
        >
          🔍 View Room
        </button>
        <button
          onClick={() => {
            setView('desk')
            // The exact floor position in front of the desk
            setTargetPosition(new THREE.Vector3(-2.5, -2, -1.8))
          }}
          style={{ padding: '10px', background: '#ff6b6b', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontFamily: 'monospace' }}
        >
          ✉️ Write Letters
        </button>
        <button
          onClick={() => {
            setView('bed')
            // The exact floor position next to the bed
            setTargetPosition(new THREE.Vector3(2.5, -2, 0))
          }}
          style={{ padding: '10px', background: '#a388d4', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontFamily: 'monospace' }}
        >
          🛏️ Rest (Bed)
        </button>
      </div>

      {/* SKIN COLOR PALETTE */}
      <div style={{
        position: 'absolute', bottom: '20px', right: '20px', padding: '15px',
        background: 'rgba(0,0,0,0.5)', borderRadius: '10px', display: 'flex', gap: '8px', zIndex: 10,
        alignItems: 'center', backdropFilter: 'blur(5px)'
      }}>
        <span style={{ color: 'white', fontFamily: 'monospace', marginRight: '10px' }}>Skin Tone:</span>
        {skinTones.map(color => (
          <button
            key={color}
            onClick={() => setSkinColor(color)}
            style={{
              width: '30px', height: '30px', borderRadius: '50%', background: color, cursor: 'pointer',
              border: skinColor === color ? '2px solid white' : '2px solid transparent',
              transition: 'all 0.2s'
            }}
          />
        ))}
      </div>

      <Canvas shadows orthographic camera={{ position: [10, 10, 10], zoom: 40, near: 0.1, far: 100 }}>

        {/* Dynamic Camera Controller handles zooming/lerping taking over OrbitControls */}
        <CameraController view={view} />

        {/* The Scene Setup */}
        <Lighting />
        <CozyRoom onFloorClick={(pos: THREE.Vector3) => {
          setTargetPosition(pos)
          setView('room')
        }} />
        <Character view={view} targetPosition={targetPosition} skinColor={skinColor} />

        {/* Visual Target Indicator for Point and Click */}
        {targetPosition && view === 'room' && (
          <mesh position={[targetPosition.x, targetPosition.y + 0.05, targetPosition.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.2, 0.25, 32]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
          </mesh>
        )}

        <Environment preset="night" />
      </Canvas>

      <div style={{
        position: 'absolute', top: '20px', left: '20px',
        color: 'white', fontFamily: 'monospace', opacity: 0.5, pointerEvents: 'none'
      }}>
        Kind Woods - Post Processing & Cam Study
      </div>
    </div>
  )
}

export default App
