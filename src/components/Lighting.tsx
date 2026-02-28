export function Lighting() {
    return (
        <>
            {/* Ambient Lo-fi Light (Soft Purple/Blue) */}
            <ambientLight intensity={0.6} color="#453163" />

            {/* Main Room Light (e.g. from a ceiling or window) - Soft Pink/Lavender */}
            <directionalLight
                position={[5, 10, 5]}
                intensity={0.8}
                color="#d1a3ff"
                castShadow
                shadow-mapSize={[1024, 1024]}
                shadow-camera-left={-10}
                shadow-camera-right={10}
                shadow-camera-top={10}
                shadow-camera-bottom={-10}
            />

            {/* Warm Lamp Light (desk lamp or bedside light) */}
            <pointLight
                position={[-2, 3, -1]} // Positioned where a lamp might be on the desk
                intensity={1.2}
                color="#ffcc88" // Warm orange/yellow
                castShadow
                shadow-bias={-0.0001}
            />

            {/* Fill Light to soften shadows */}
            <pointLight
                position={[4, 2, 4]}
                intensity={0.4}
                color="#8855cc"
            />
        </>
    )
}
