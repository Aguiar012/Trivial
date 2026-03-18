import React, { useRef, useState, useEffect } from 'react';
import { SmartCanvas } from './SmartCanvas';
import type { SmartCanvasRef } from './SmartCanvas';

interface DrawingOverlayProps {
    isVisible: boolean;
    title: string;
    onConfirm: (svgString: string) => void;
    onCancel: () => void;
}

export function DrawingOverlay({ isVisible, title, onConfirm, onCancel }: DrawingOverlayProps) {
    const canvasRef = useRef<SmartCanvasRef>(null);
    const [eraseMode, setEraseMode] = useState(false);
    const [msgTopo, setMsgTopo] = useState<string | null>(null);

    useEffect(() => {
        if (isVisible) {
            canvasRef.current?.clear();
            setEraseMode(false);
            canvasRef.current?.setEraseMode(false);
        }
    }, [title, isVisible]);

    if (!isVisible) return null;

    const handleConfirm = async () => {
        if (!canvasRef.current) return;
        try {
            const svgString = canvasRef.current.exportSvg();
            onConfirm(svgString);
        } catch (err) {
            console.error('Failed to export SVG', err);
        }
    };

    const handleToggleErase = () => {
        const newMode = !eraseMode;
        setEraseMode(newMode);
        canvasRef.current?.setEraseMode(newMode);
    };

    const handleUndo = () => canvasRef.current?.undo();
    const handleRedo = () => canvasRef.current?.redo();
    const handleClear = () => canvasRef.current?.clear();

    const handleGestureEvent = (msg: string) => {
        setMsgTopo(msg);
        setTimeout(() => setMsgTopo(null), 2000);
    };

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
            pointerEvents: 'none' // Let clicks pass through the container itself
        }}>
            {/* Top Transparent Area for Double Tap to Exit */}
            <div 
                style={{ flex: 4, cursor: 'pointer', pointerEvents: 'auto' }}
                onDoubleClick={onCancel}
                title="Duplo clique para cancelar"
            />

            {/* Bottom Drawing Area */}
            <div style={{
                flex: 6,
                backgroundColor: '#fcfaf8',
                position: 'relative',
                borderTop: '4px solid #dcd1c4',
                boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                pointerEvents: 'auto'
            }}>
                {/* Floating Toolbar */}
                <div style={{
                    position: 'absolute',
                    top: '-60px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    gap: '8px',
                    backgroundColor: 'rgba(24, 18, 43, 0.95)',
                    padding: '8px 16px',
                    borderRadius: '30px',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                    alignItems: 'center',
                    zIndex: 10,
                    whiteSpace: 'nowrap'
                }}>
                    <span style={{ 
                        color: msgTopo ? '#ffcc00' : '#fff', 
                        fontSize: '14px', 
                        marginRight: '12px', 
                        fontFamily: '"Playfair Display", serif',
                        opacity: 0.9,
                        transition: 'color 0.3s'
                    }}>
                        {msgTopo || title}
                    </span>
                    
                    <button onClick={handleUndo} style={iconButtonStyle} title="Desfazer">↺</button>
                    <button onClick={handleRedo} style={iconButtonStyle} title="Refazer">↻</button>
                    <button onClick={handleClear} style={iconButtonStyle} title="Limpar">🗑️</button>
                    
                    <div style={separatorStyle} />
                    
                    <button
                        onClick={handleToggleErase}
                        style={{
                            ...iconButtonStyle,
                            backgroundColor: eraseMode ? '#a34c4c' : 'transparent',
                            borderRadius: '50%',
                            width: '44px',
                            height: '44px',
                            fontSize: '20px',
                        }}
                        title={eraseMode ? 'Modo Caneta' : 'Modo Borracha'}
                    >
                        {eraseMode ? '🧹' : '✏️'}
                    </button>
                    
                    <div style={separatorStyle} />
                    
                    <button onClick={onCancel} style={{...iconButtonStyle, color: '#ffaaaa'}} title="Cancelar (ou Duplo Clique na tela)">✖</button>
                    <button 
                        onClick={handleConfirm} 
                        style={{
                            ...iconButtonStyle, 
                            backgroundColor: '#4a7a4a', 
                            color: 'white', 
                            borderRadius: '50%', 
                            width: '36px', 
                            height: '36px',
                            marginLeft: '4px',
                            boxShadow: '0 2px 8px rgba(74, 122, 74, 0.5)'
                        }}
                        title="Confirmar (Salvar/Avançar)"
                    >
                        ✔
                    </button>
                </div>

                {/* Canvas Box */}
                <div style={{ 
                    flex: 1, 
                    position: 'relative', 
                    width: '100%', 
                    maxWidth: '900px', 
                    margin: '0 auto',
                    backgroundImage: 'repeating-linear-gradient(transparent, transparent 39px, #dcd1c4 39px, #dcd1c4 40px)',
                    backgroundSize: '100% 40px', // Line height 40px
                    backgroundPosition: '0 -2px' // 38px, 78px,...
                }}>
                    <SmartCanvas
                        ref={canvasRef}
                        strokeWidth={eraseMode ? 10 : 3}
                        strokeColor={eraseMode ? '#ff000022' : '#2b2622'}
                        lineHeight={40}
                        style={{ width: '100%', height: '100%' }}
                        onGestureEvent={handleGestureEvent}
                    />
                </div>
            </div>
        </div>
    );
}

const iconButtonStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: '#ddd',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.1s ease',
};

const separatorStyle: React.CSSProperties = {
    width: '1px', 
    height: '20px', 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    margin: '0 4px'
};
