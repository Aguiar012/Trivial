import * as THREE from 'three'

// ── POSIÇÕES NO ESPAÇO 3D ──────────────────────────────────────────────
// Estas constantes definem onde o personagem vai em cada interação.
// Se você mover um móvel, só precisa mudar aqui — o resto do código
// vai funcionar automaticamente.

/** Nível do chão onde o personagem anda (eixo Y global) */
export const CHAO_Y = -2

/** Posição que o personagem vai quando manda ele ir para a escrivaninha */
export const POSICAO_ESCRIVANINHA = new THREE.Vector3(-2.5, CHAO_Y, -0.9)

/** Posição elevada no banco onde ele senta */
export const POSICAO_BANCO_SENTADO = new THREE.Vector3(-2.5, -1.0, -1)

/** Posição no chão, ao pé da cama (onde o personagem para antes de subir) */
export const POSICAO_CAMA = new THREE.Vector3(2.2, CHAO_Y, 0)

/**
 * Posição em cima do colchão (onde o personagem deita de verdade).
 * X/Z = centro aproximado do colchão (cama em room local [2.2, 0, 1.8])
 * Y = -0.8 = altura estimada do topo do colchão no mundo
 */
export const POSICAO_DEITADO = new THREE.Vector3(3.2, -0.8, 1.8)

/** Posição do personagem ao ir para a estante */
export const POSICAO_ESTANTE = new THREE.Vector3(-3.5, CHAO_Y, 2.0)
