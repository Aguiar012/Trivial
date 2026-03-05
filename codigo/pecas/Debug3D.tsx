/*
 * Debug3D.tsx — Visualizador de cena 3D para debug de posicionamento
 *
 * Ativar: adicione ?debug=1 na URL (ex: localhost:5173?debug=1)
 * Usar:   no console do browser, rode: copy(window.__cena3d)
 *         depois cole o JSON no chat do Claude para ele entender a cena
 *
 * O que aparece na tela:
 *   - Eixos RGB em cada objeto nomeado (X=vermelho, Y=verde, Z=azul)
 *   - Grade no chão do world-space (Y=0, vermelha) e chão do quarto (Y=-2, azul)
 *   - Bounding boxes wireframe amarelas em cada mesh
 */

import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'

// Declaração global para TypeScript não reclamar de window.__cena3d
declare global {
    interface Window {
        __cena3d: ObjetoDebug[]
    }
}

interface ObjetoDebug {
    nome: string
    tipo: string
    pai: string
    posicaoLocal: [number, number, number]
    posicaoWorld: [number, number, number]
    escala: [number, number, number]
    visivel: boolean
    boundingBoxWorld?: {
        min: [number, number, number]
        max: [number, number, number]
        tamanho: [number, number, number]
    }
}

/** Verifica se ?debug=1 está na URL */
function modoDebugAtivo(): boolean {
    return new URLSearchParams(window.location.search).get('debug') === '1'
}

/** Converte Vector3 para array arredondado com 2 casas decimais */
function v3(v: THREE.Vector3): [number, number, number] {
    return [
        Math.round(v.x * 100) / 100,
        Math.round(v.y * 100) / 100,
        Math.round(v.z * 100) / 100,
    ]
}

export function Debug3D() {
    const { scene } = useThree()
    const auxiliaresRef = useRef<THREE.Object3D[]>([])
    const ativo = modoDebugAtivo()

    // Atualiza window.__cena3d a cada 2 segundos (não precisa ser todo frame)
    const ultimaAtualizacao = useRef(0)
    useFrame((state) => {
        if (!ativo) return
        if (state.clock.elapsedTime - ultimaAtualizacao.current < 2) return
        ultimaAtualizacao.current = state.clock.elapsedTime
        atualizarMapaCena()
    })

    function atualizarMapaCena() {
        const mapa: ObjetoDebug[] = []
        const posicaoWorld = new THREE.Vector3()
        const bbox = new THREE.Box3()

        scene.traverse((obj) => {
            // Ignora os próprios helpers de debug para não poluir o JSON
            if (obj.userData.__debugHelper) return
            // Ignora objetos sem nome (intermediários do drei/fiber)
            if (!obj.name) return

            obj.getWorldPosition(posicaoWorld)

            const entrada: ObjetoDebug = {
                nome: obj.name,
                tipo: obj.type,
                pai: obj.parent?.name || 'Scene',
                posicaoLocal: v3(obj.position),
                posicaoWorld: v3(posicaoWorld),
                escala: v3(obj.scale),
                visivel: obj.visible,
            }

            // Bounding box só em meshes (têm geometria)
            if ((obj as THREE.Mesh).isMesh || (obj as THREE.SkinnedMesh).isSkinnedMesh) {
                try {
                    bbox.setFromObject(obj)
                    const tamanho = new THREE.Vector3()
                    bbox.getSize(tamanho)
                    entrada.boundingBoxWorld = {
                        min: v3(bbox.min),
                        max: v3(bbox.max),
                        tamanho: v3(tamanho),
                    }
                } catch {
                    // alguns meshes de shader não têm geometria mensurável
                }
            }

            mapa.push(entrada)
        })

        window.__cena3d = mapa
    }

    // Adiciona helpers visuais (eixos + bbox wireframe) na cena
    useEffect(() => {
        if (!ativo) return

        // Limpa helpers anteriores
        auxiliaresRef.current.forEach(h => {
            if (h.parent) h.parent.remove(h)
        })
        auxiliaresRef.current = []

        // Aguarda 500ms para modelos GLB carregarem antes de adicionar helpers
        const timeout = setTimeout(() => {
            scene.traverse((obj) => {
                if (obj.userData.__debugHelper) return
                if (!obj.name) return

                // Eixos RGB em cada objeto com nome
                const eixos = new THREE.AxesHelper(0.5)
                eixos.userData.__debugHelper = true
                obj.add(eixos)
                auxiliaresRef.current.push(eixos)

                // Bounding box wireframe amarela em meshes
                if ((obj as THREE.Mesh).isMesh) {
                    const boxHelper = new THREE.BoxHelper(obj as THREE.Mesh, 0xffff00)
                    boxHelper.userData.__debugHelper = true
                    scene.add(boxHelper)
                    auxiliaresRef.current.push(boxHelper)
                }
            })
            atualizarMapaCena()
        }, 500)

        return () => {
            clearTimeout(timeout)
            auxiliaresRef.current.forEach(h => {
                if (h.parent) h.parent.remove(h)
            })
            auxiliaresRef.current = []
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ativo, scene])

    // Não renderiza nada se debug não está ativo
    if (!ativo) return null

    return (
        <>
            {/* Grade no chão do world-space (Y=0) — vermelha */}
            <Grid
                args={[20, 20]}
                position={[0, 0, 0]}
                cellSize={1}
                cellColor="#888888"
                sectionSize={5}
                sectionColor="#ff4444"
                sectionThickness={1.5}
                fadeDistance={30}
            />
            {/* Grade no chão do quarto (Y=-2, onde o personagem anda) — azul */}
            <Grid
                args={[10, 10]}
                position={[0, -2, 0]}
                cellSize={1}
                cellColor="#4488ff"
                sectionSize={5}
                sectionColor="#0044ff"
                sectionThickness={1.5}
                fadeDistance={20}
            />
        </>
    )
}