import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface CameraControllerProps {
    view: 'room' | 'desk' | 'bed'
}

export function CameraController({ view }: CameraControllerProps) {
    useFrame((state) => {
        // 1. Define target positions based on the current view
        let targetPos = new THREE.Vector3()
        let targetLook = new THREE.Vector3()

        switch (view) {
            case 'room':
                // Global isometric view
                targetPos.set(10, 10, 10)
                targetLook.set(0, 0, 0)
                state.camera.zoom = THREE.MathUtils.lerp(state.camera.zoom, 40, 0.05)
                break
            case 'desk':
                // Frontal/Side view of the character's face while at the desk
                targetPos.set(-4, 1.5, -4.2) // Position camera near the window/back wall
                targetLook.set(-2.5, -0.5, -1.8) // Look at the character's face/body
                state.camera.zoom = THREE.MathUtils.lerp(state.camera.zoom, 90, 0.05) // Zoom in slightly more
                break
            case 'bed':
                // Focus on the bed area with a more horizontal angle (not exactly top-down)
                targetPos.set(4, 3, 6)
                targetLook.set(1.5, 0.5, 1.5)
                state.camera.zoom = THREE.MathUtils.lerp(state.camera.zoom, 70, 0.05)
                break
        }

        // 2. Smoothly interpolate (lerp) current camera position towards target
        state.camera.position.lerp(targetPos, 0.05)

        // 3. Smoothly interpolate the point the camera is looking at
        // We utilize the orbit controls target or directly look at if orbit is disabled.
        // Assuming orbit controls are disabled during transition for simplicity.
        // but for this demo, we'll force the camera to look at the target
        state.camera.lookAt(targetLook)
        state.camera.updateProjectionMatrix()
    })

    return null
}
