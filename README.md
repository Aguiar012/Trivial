# Trivial 🌿

Trivial (internally known as "Kind Woods" or "DyCard") is a cozy, interactive 3D study and journaling application built with **React**, **Three.js**, and an advanced **2D Handwriting Recognition Engine**.

It combines the aesthetic comfort of low-poly 3D environments (inspired by games like *Kind Words*) with powerful ML-driven productivity tools, such as real-time handwriting recognition and zero-shot personalized machine learning.

## ✨ Key Features

- **Cozy 3D Environment**: A fully interactive 3D room with dynamic cameras, low-poly aesthetics, and an animated character that reacts to your pathfinding clicks.
- **Smart Canvas Engine**: A beautifully rendered drawing canvas overlay using `perfect-freehand` that simulates real ink physics and pressure.
- **Real-Time Handwriting Recognition**: Powered by a custom implementation of the `$P` Point-Cloud dollar recognizer algorithm.
- **Zero-Shot "Aya Pattern" UI**: Built-in, frictionless user correction. If the AI hallucinates a letter (e.g., misreading an `i` as a `1`), simply click the letter on the canvas. A popup lets you correct it, instantly saving your raw handwriting stroke as a custom template in LocalStorage. The machine literally learns your specific handwriting style over time!
- **Gestural Editing**: Scribble over text with your pen to automatically erase it.

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **3D Engine**: Three.js, `@react-three/fiber`, `@react-three/drei`
- **Ink & Recognition**: `perfect-freehand`, custom vanilla TS Point-Cloud math
- **Animation**: Native GLTF animations & GSAP-style cubic-bezier transitions

## 🚀 Getting Started

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:5173` and click on the desk to start writing!

## 🧠 The "Aya Pattern"

This project pioneers the **Aya Pattern** for Machine Learning UX:
Instead of brute-forcing mathematical perfection or forcing users into standalone calibration menus, we prioritize zero-friction UI. The system assumes a baseline accuracy; when it fails, the user corrects it natively inline, and the system intercepts those raw points to permanently update its heuristic database.

*Developed with intuition, design, and empathy by Aya.*
