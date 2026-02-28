import { useRef, useEffect } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

interface CharacterProps {
    view: 'room' | 'desk' | 'bed'
    targetPosition?: THREE.Vector3 | null
    skinColor?: string
}

export function Character({ view, targetPosition, skinColor = '#ffcba4' }: CharacterProps) {
    const group = useRef<THREE.Group>(null)

    // Load the Quaternius-style GLTF model from the user's folder
    const { scene, animations } = useGLTF('/Modelos%20da%20Internet/glTF/Suit_Male.gltf')
    const { actions, names } = useAnimations(animations, group)

    // Console log to see the available animation names
    useEffect(() => {
        console.log("Available animations in the GLTF:", names)
    }, [names])

    // Utility to smoothly crossfade animations
    const currentAnim = useRef<string>('Idle')

    const playAnim = (name: string) => {
        if (currentAnim.current !== name && actions[name]) {
            actions[currentAnim.current]?.fadeOut(0.2)

            const nextAction = actions[name]?.reset().fadeIn(0.2).play()
            if (name === 'SitDown' || name === 'Defeat') {
                nextAction!.clampWhenFinished = true
                nextAction!.loop = THREE.LoopOnce
            }

            currentAnim.current = name
        }
    }

    // Play initial animation
    useEffect(() => {
        actions['Idle']?.play()
    }, [actions])

    useFrame((_state) => {
        if (!group.current) return

        if (targetPosition) {
            // Clamp target Y to match character's floor level (-2 to avoid sinking/floating outside bounds)
            const target = new THREE.Vector3(targetPosition.x, -2, targetPosition.z)
            const distance = group.current.position.distanceTo(target)

            if (distance > 0.1) {
                // WALKING STATE
                playAnim('Walk')

                // Move smoothly
                group.current.position.lerp(target, 0.08)

                // Rotate smoothly towards target
                const dummy = new THREE.Object3D()
                dummy.position.copy(group.current.position)
                dummy.lookAt(target)
                group.current.quaternion.slerp(dummy.quaternion, 0.15)
            } else {
                // ARRIVED AT DESTINATION STATE
                if (view === 'desk' && target.x === -2.5 && target.z === -1.8) {
                    playAnim('SitDown')

                    // Snap rotation exactly facing the desk notebook (Math.PI)
                    const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
                    group.current.quaternion.slerp(targetQuat, 0.1)
                } else if (view === 'bed' && target.x === 2.5 && target.z === 0) {
                    playAnim('Defeat')

                    // Snap rotation to lie down on bed properly
                    const targetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2)
                    group.current.quaternion.slerp(targetQuat, 0.1)
                } else {
                    playAnim('Idle')
                }
            }
        } else {
            // INITIAL STATE OR NO TARGET CLICKED YET
            if (view === 'desk') {
                playAnim('SitDown')
                group.current.rotation.y = Math.PI
            }
            else if (view === 'bed') {
                playAnim('Defeat')
                group.current.rotation.y = -Math.PI / 2
            }
            else playAnim('Idle')
        }
    })

    // Enhance the materials slightly to match the "Kind Words" feel
    useEffect(() => {
        scene.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
                child.castShadow = true
                child.receiveShadow = true
                // Make the material matte and cozy
                child.material.roughness = 0.8
                child.material.metalness = 0.0

                // FIX: Quaternius "Suit_Male" has a bug where the Skin material is almost pitch black.
                // We intercept it and force a warm, cute pastel skin tone.
                if (child.material.name === 'Skin') {
                    child.material.color.set(skinColor) // Dynamic skin color
                }
            }
        })
    }, [scene, skinColor])

    return (
        // Positioned right in front of the desk, facing the desk (Math.PI)
        <group ref={group} position={[-2.5, -2, -1.8]} rotation={[0, Math.PI, 0]} scale={1.15}>
            <primitive object={scene} />
        </group>
    )
}

useGLTF.preload('/Modelos%20da%20Internet/glTF/Suit_Male.gltf')
