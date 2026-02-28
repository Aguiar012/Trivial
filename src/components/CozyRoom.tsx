import { Box, Cylinder, Sphere } from '@react-three/drei'
import * as THREE from 'three'

// Utility function for pastel / soft colors
const softMaterial = (color: string) => (
    <meshStandardMaterial
        color={color}
        roughness={0.9} // Very matte, soft look
        metalness={0.0}
    />
)

interface CozyRoomProps {
    onFloorClick?: (pos: THREE.Vector3) => void
}

export function CozyRoom({ onFloorClick }: CozyRoomProps) {
    return (
        <group position={[0, -2, 0]}>

            {/* --- ROOM STRUCTURE --- */}
            {/* Floor */}
            <Box
                args={[10, 0.5, 10]}
                position={[0, -0.25, 0]}
                receiveShadow
                onClick={(e) => {
                    e.stopPropagation()
                    if (onFloorClick) {
                        // Clamp the target position so the character doesn't walk into walls
                        // Room is roughly 10x10. We limit them closely inside (-4 to 4)
                        const clampedX = THREE.MathUtils.clamp(e.point.x, -4.0, 4.0)
                        const clampedZ = THREE.MathUtils.clamp(e.point.z, -4.0, 4.0)

                        // We also shouldn't allow clicking *inside* the desk or bed if we want perfection,
                        // but a simple clamp is a great first step bounds check.
                        onFloorClick(new THREE.Vector3(clampedX, e.point.y, clampedZ))
                    }
                }}
            >
                {softMaterial('#bfaed6')} {/* Soft lavender floor */}
            </Box>

            {/* Back Wall */}
            <Box args={[10, 8, 0.5]} position={[0, 4, -4.75]} receiveShadow>
                {softMaterial('#a891c9')} {/* Slightly darker lavender wall */}
            </Box>

            {/* Side Wall (Left) */}
            <Box args={[0.5, 8, 10]} position={[-4.75, 4, 0]} receiveShadow>
                {softMaterial('#9b82c0')} {/* Accent wall */}
            </Box>

            {/* Window Hole (Fake window on back wall) */}
            <Box args={[3, 4, 0.6]} position={[1, 4.5, -4.72]} receiveShadow>
                <meshBasicMaterial color="#1a1236" /> {/* Starry sky color */}
            </Box>
            {/* Window Frame */}
            <Box args={[3.2, 4.2, 0.2]} position={[1, 4.5, -4.5]} receiveShadow>
                {softMaterial('#e8e4f2')} {/* White-ish frame */}
            </Box>

            {/* --- FURNITURE --- */}

            {/* BED */}
            <group position={[2.5, 0.5, 2.5]}>
                {/* Bed Frame */}
                <Box args={[4, 0.8, 4.5]} position={[0, 0, 0]} castShadow receiveShadow>
                    {softMaterial('#8b7266')} {/* Warm wood */}
                </Box>
                {/* Mattress/Blanket (Thick and soft) */}
                <Box args={[3.8, 0.6, 4.3]} position={[0, 0.7, 0]} castShadow receiveShadow>
                    {softMaterial('#f2bbc9')} {/* Warm pink blanket */}
                </Box>
                {/* Pillow */}
                <Box args={[1.5, 0.3, 0.8]} position={[0, 1.1, -1.5]} castShadow receiveShadow>
                    {softMaterial('#ffffff')} {/* White pillow */}
                </Box>
            </group>

            {/* DESK */}
            <group position={[-2.5, 2, -3]}>
                {/* Desk Top */}
                <Box args={[4, 0.2, 2.5]} position={[0, 0, 0]} castShadow receiveShadow>
                    {softMaterial('#a38575')} {/* Wood desk */}
                </Box>
                {/* Desk Legs */}
                <Box args={[0.2, 2, 2.3]} position={[-1.8, -1, 0]} castShadow receiveShadow>
                    {softMaterial('#a38575')}
                </Box>
                <Box args={[0.2, 2, 2.3]} position={[1.8, -1, 0]} castShadow receiveShadow>
                    {softMaterial('#a38575')}
                </Box>

                {/* Laptop/Monitor */}
                <Box args={[1.2, 0.8, 0.1]} position={[0, 0.5, -0.8]} rotation={[-0.1, 0, 0]} castShadow receiveShadow>
                    {softMaterial('#e0e0e0')}
                </Box>
                {/* Screen Glow */}
                <Box args={[1.1, 0.7, 0.05]} position={[0, 0.5, -0.74]} rotation={[-0.1, 0, 0]}>
                    <meshBasicMaterial color="#e6f7ff" /> {/* Light blue glow */}
                </Box>

                {/* Desk Lamp (Warm light source) */}
                <group position={[-1.2, 0.1, -0.8]}>
                    <Box args={[0.4, 0.1, 0.4]} position={[0, 0, 0]} castShadow />
                    <Cylinder args={[0.05, 0.05, 0.8]} position={[0, 0.4, 0]} castShadow />
                    <Cylinder args={[0.3, 0.4, 0.3]} position={[0, 0.8, 0]} castShadow>
                        {softMaterial('#ffeb99')} {/* Yellow lamp shade */}
                    </Cylinder>
                </group>

                {/* Stool / Chair for the character */}
                <group position={[0, -1, 1]}> {/* Globally at X: -2.5, Y: 1, Z: -2 */}
                    {/* Seat */}
                    <Box args={[1, 0.2, 1]} position={[0, 0, 0]} castShadow receiveShadow>
                        {softMaterial('#8b7266')}
                    </Box>
                    {/* Cushion */}
                    <Box args={[0.9, 0.2, 0.9]} position={[0, 0.1, 0]} castShadow receiveShadow>
                        {softMaterial('#9b82c0')} {/* Same purple as accent wall */}
                    </Box>
                    {/* Legs */}
                    <Box args={[0.1, 1, 0.1]} position={[-0.4, -0.5, -0.4]} castShadow />
                    <Box args={[0.1, 1, 0.1]} position={[0.4, -0.5, -0.4]} castShadow />
                    <Box args={[0.1, 1, 0.1]} position={[-0.4, -0.5, 0.4]} castShadow />
                    <Box args={[0.1, 1, 0.1]} position={[0.4, -0.5, 0.4]} castShadow />
                </group>
            </group>

            {/* RUG */}
            <Cylinder args={[3, 3, 0.1, 32]} position={[0, 0.05, 0]} receiveShadow>
                {softMaterial('#dcbbe0')} {/* Pinkish rug */}
            </Cylinder>

            {/* SMALL PROPS */}
            {/* Bookshelf */}
            <group position={[-4, 2, 3]}>
                <Box args={[0.8, 4, 1.5]} castShadow receiveShadow>
                    {softMaterial('#8b7266')}
                </Box>
                {/* Books */}
                <Box args={[0.6, 0.8, 0.2]} position={[0, 0, 0.4]} castShadow>
                    <meshStandardMaterial color="#c99191" />
                </Box>
                <Box args={[0.6, 0.7, 0.15]} position={[0, -0.05, 0.1]} castShadow>
                    <meshStandardMaterial color="#91c9b3" />
                </Box>
                <Box args={[0.6, 0.9, 0.25]} position={[0, 0.05, -0.2]} castShadow>
                    <meshStandardMaterial color="#91a6c9" />
                </Box>
            </group>

            {/* Plant (Cube pot, sphere leaves) */}
            <group position={[4, 0.5, -3]}>
                <Box args={[1, 1, 1]} position={[0, 0, 0]} castShadow>
                    {softMaterial('#d4d4d4')} {/* White pot */}
                </Box>
                <Sphere args={[0.8, 16, 16]} position={[0, 1.2, 0]} castShadow>
                    {softMaterial('#8ebd8b')} {/* Soft green leaves */}
                </Sphere>
            </group>

        </group>
    )
}
