import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function DustParticles({ count = 100 }) {
    const mesh = useRef<THREE.InstancedMesh>(null)

    // Generate random positions, speeds, and scales for the particles
    const particles = useMemo(() => {
        const temp = []
        for (let i = 0; i < count; i++) {
            const t = Math.random() * 100 // random starting time offset
            const factor = 0.5 + Math.random() // speed factor
            const speed = 0.01 + Math.random() / 200 // particle base speed

            // Spread the particles throughout the room
            const x = (Math.random() - 0.5) * 15
            const y = (Math.random() - 0.5) * 15
            const z = (Math.random() - 0.5) * 15

            temp.push({ t, factor, speed, x, y, z })
        }
        return temp
    }, [count])

    // Create a dummy object to hold the matrix calculation
    const dummy = useMemo(() => new THREE.Object3D(), [])

    useFrame(() => {
        if (!mesh.current) return

        // Run through each particle and update its position (drifting upwards and slightly sideways)
        particles.forEach((particle, i) => {
            const { factor, speed, x, y, z } = particle

            // Update time
            particle.t += speed / 2

            // Calculate gentle sine wave drift
            const newY = y + Math.sin(particle.t) * factor * 2
            const newX = x + Math.cos(particle.t) * factor

            // Apply to dummy object to calculate matrix
            dummy.position.set(newX, newY, z)
            // Slight rotation drift
            dummy.rotation.set(particle.t * factor, particle.t * factor, particle.t * factor)

            // Keep scales tiny and varying
            const scale = 0.05 + Math.abs(Math.sin(particle.t)) * 0.1
            dummy.scale.set(scale, scale, scale)

            dummy.updateMatrix()
            if (mesh.current) {
                mesh.current.setMatrixAt(i, dummy.matrix)
            }
        })

        // Tell Three.js that the matrices have updated
        if (mesh.current) {
            mesh.current.instanceMatrix.needsUpdate = true
        }
    })

    return (
        <instancedMesh ref={mesh} args={[undefined, undefined, count]} renderOrder={1}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshBasicMaterial
                color="#ffebef" // Soft warm pinkish-white dust
                transparent
                opacity={0.4}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
            />
        </instancedMesh>
    )
}
