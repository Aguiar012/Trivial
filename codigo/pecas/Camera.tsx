/*
 * Camera.tsx — Controle da câmera ortográfica isométrica
 *
 * ── COMO FUNCIONA ────────────────────────────────────────────────────────
 *
 * A câmera tem DOIS parâmetros que JUNTOS definem o ângulo de visão:
 *
 *   POSICAO (posX/Y/Z) = onde a câmera está no espaço
 *   FOCO (focoX/Y/Z)   = o ponto que fica no centro da tela
 *
 *   A DIREÇÃO que a câmera aponta é sempre:  posição → foco
 *   Mudar só posX sem mudar focoX não "gira" a câmera — só a desloca.
 *
 * ── COMO ORBITAR AO REDOR DA MESA ───────────────────────────────────────
 *
 *   A escrivaninha fica em world ≈ (-2.5, 0, -3).
 *   O personagem senta OLHANDO para a parede do fundo (direção -Z).
 *
 *   Para ficar ATRÁS da cadeira (câmera no lado +Z, olhando para -Z):
 *     posZ muito positivo (ex: +10) + focoZ negativo (ex: -3)
 *     → câmera vem de trás do personagem, olhando a parede
 *
 *   Para ficar DE FRENTE (câmera no lado -Z, olhando para +Z):
 *     posZ muito negativo (ex: -12) + focoZ 0 ou positivo
 *     → câmera fica do lado da parede, personagem de costas para ela
 *
 *   Para ver LATERALMENTE (câmera à direita):
 *     posX muito positivo + focoX ≈ (-2.5) onde a mesa está
 *     → câmera à direita, olhando para a esquerda onde a mesa fica
 *
 *   Para ver LATERALMENTE (câmera à esquerda):
 *     posX muito negativo + focoX ≈ 0
 *     → câmera à esquerda
 *
 *   ZOOM: câmera ortográfica não usa distância — só o número zoom.
 *   Maiores = mais perto. A posição pode ser qualquer distância.
 *
 * ── POSIÇÕES DE REFERÊNCIA ───────────────────────────────────────────────
 *   Escrivaninha: world (-2.5,  0, -3)
 *   Cama:         world ( 2.2,  0,  1.8)
 *   Centro:       world ( 0,    0,  0)
 */

import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── CONFIGURAÇÕES DE CÂMERA POR VIEW ────────────────────────────────────
// Para achar o ângulo certo da mesa:
//   1. Mude posX/posY/posZ para onde a câmera vai FICAR
//   2. Aponte focoX/focoY/focoZ para onde a mesa está (-2.5, 0, -3)
//   3. O zoom só aumenta/diminui o tamanho — não muda o ângulo

const CAMERA = {
    room: {
        posX: 12,
        posY: 10,
        posZ: 10,
        focoX: 0,
        focoY: 0,
        focoZ: 0,
        zoom: 70,
        velocidade: 0.05,
    },
    desk: {
        // Câmera ATRÁS DA CADEIRA COM ÂNGULO DIAGONAL
        // Deslocada para a direita para não ser bloqueada pela cabeça do personagem
        posX: 0.5,   // câmera deslocada para a direita
        posY: 4.5,   // altura moderada
        posZ: 9.0,   // atrás do personagem
        focoX: -2.5, // centro da mesa
        focoY: -0.6, // foco na tela do notebook
        focoZ: -3.0, // tela do notebook
        zoom: 130,
        velocidade: 0.1,
    },
    bed: {
        posX: 4,
        posY: 3,
        posZ: 6,
        focoX: 1.5,
        focoY: 0.5,
        focoZ: 1.5,
        zoom: 70,
        velocidade: 0.05,
    },

    // ── NOVOS PRESETS PARA AÇÕES DE ESTUDO ──────────────────────────────

    notebook: {
        // Câmera BEM PRÓXIMA da mesa — ângulo de escrita
        // Usado quando o usuário abre o caderno para escrever raciocínio
        // Enquadramento: vê a superfície da mesa, as mãos do personagem e o caderno
        posX: -3.5,   // ligeiramente à esquerda (perspectiva de quem escreve)
        posY: 3,      // altura baixa para ver a mesa de perto
        posZ: 3,      // mais perto que o desk normal
        focoX: -2.5,  // centro da mesa
        focoY: -1.5,  // foco na superfície da mesa (onde o caderno estaria)
        focoZ: -2.5,  // Z da mesa
        zoom: 180,    // bem próximo — precisa ver detalhes da escrita
        velocidade: 0.08,
    },

    reading: {
        // Câmera LATERAL focando na estante — ângulo de leitura/consulta
        // Usado quando o modelo de IA mostra respostas contextualizadas
        // Enquadramento: personagem de lado, estante visível, sensação de biblioteca
        posX: -8,     // câmera vem da esquerda
        posY: 4,      // altura moderada
        posZ: 3,      // alinhado com a estante
        focoX: -3.5,  // aponta para a área entre estante e mesa
        focoY: -0.5,  // altura dos olhos
        focoZ: 2,     // Z da estante
        zoom: 100,    // zoom intermediário — vê contexto mas com foco
        velocidade: 0.06,
    },

    shelf: {
        // Câmera frontal à estante — para gerenciar decks
        // Estante está em world (-4.0, 0, 2.0) rotacionada 90°
        posX: -0.5,    // vem pela direita para ver a estante de frente
        posY: 4,       // altura moderada (vê as prateleiras)
        posZ: 3,       // Z alinhado com a estante
        focoX: -4.0,   // aponta para a estante
        focoY: 0.5,    // centro vertical das prateleiras
        focoZ: 2.0,    // Z da estante
        zoom: 100,     // zoom intermediário — vê toda a estante
        velocidade: 0.08,
    },
}

interface CameraControllerProps {
    view: 'room' | 'desk' | 'bed' | 'notebook' | 'reading' | 'shelf'
}

export function Camera({ view }: CameraControllerProps) {
    useFrame((state) => {
        const cfg = CAMERA[view]

        const targetPos = new THREE.Vector3(cfg.posX, cfg.posY, cfg.posZ)
        const targetLook = new THREE.Vector3(cfg.focoX, cfg.focoY, cfg.focoZ)

        // Adjust zoom for mobile/portrait relative to a reference aspect ratio
        let targetZoom = cfg.zoom
        const aspect = state.size.width / state.size.height
        
        // Se a tela for mais "fechada" (mobile/portrait ou quadrado ajustado), 
        // reduzimos o zoom para garantir que as laterais do quarto continuem visíveis.
        const referenceAspect = 1.2
        if (aspect < referenceAspect) {
            targetZoom = cfg.zoom * (aspect / referenceAspect)
        }

        state.camera.position.lerp(targetPos, cfg.velocidade)
        state.camera.zoom = THREE.MathUtils.lerp(state.camera.zoom, targetZoom, cfg.velocidade)
        state.camera.lookAt(targetLook)
        state.camera.updateProjectionMatrix()
    })

    return null
}
