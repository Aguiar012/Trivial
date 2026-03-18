/*
 * Luz.tsx — Iluminação aconchegante estilo Kind Words
 *
 * A ideia é simular um quarto à noite com uma luminária de mesa como
 * fonte principal de calor. Tudo tem tons quentes (amarelo/laranja/coral).
 *
 *   1. ambientLight     — base escura quente (não azul!) para ter volume
 *   2. directionalLight — "luar" suave pela janela, gera sombras
 *   3. pointLight (mesa)— luz da luminária, quente e forte
 *   4. pointLight (chão)— abajurzinho de chão, brilho complementar
 *   5. pointLight (fill)— preenchimento sutil para suavizar sombras
 */

export function Luz() {
    return (
        <>
            {/* Luz ambiente geral — base quente e bem visível (CORAL, não roxo/azul) */}
            <ambientLight intensity={1.0} color="#e8907a" />

            {/* Luz direcional — simula luar pela janela (rosado morno) */}
            <directionalLight
                position={[3, 10, 5]}
                intensity={0.6}
                color="#ffb8a0"
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-10}
                shadow-camera-right={10}
                shadow-camera-top={10}
                shadow-camera-bottom={-10}
                shadow-bias={-0.0005}
            />

            {/* Luminária da mesa — fonte principal de calor (laranja dourado) */}
            <pointLight
                position={[-3.5, 1.2, -3.5]}
                intensity={4.0}
                color="#ffaa55"
                distance={14}
                decay={2}
                castShadow
                shadow-bias={-0.001}
            />

            {/* Luz de preenchimento no lado da cama */}
            <pointLight
                position={[4, 0, 2]}
                intensity={0.8}
                color="#ffcc88"
                distance={8}
                decay={2}
            />

            {/* Preenchimento geral suave para evitar sombras totalmente pretas */}
            <pointLight
                position={[-2, 3, 3]}
                intensity={0.4}
                color="#f0a080"
                distance={12}
            />
        </>
    )
}
