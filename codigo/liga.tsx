/*
 * main.tsx — Ponto de entrada do app
 *
 * Este arquivo é onde o React "liga" e aparece na tela.
 * Você quase nunca precisa mexer aqui.
 *
 * O que cada coisa faz:
 *   - StrictMode: modo de segurança do React que avisa sobre erros durante desenvolvimento
 *   - createRoot: conecta o React ao HTML (o <div id="root"> no index.html)
 *   - App: o componente principal que contém tudo (o quarto, o personagem, os botões)
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './visual.css'
import Tela from './Tela.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Tela />
  </StrictMode>,
)
