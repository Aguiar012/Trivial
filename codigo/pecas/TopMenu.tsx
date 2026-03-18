import { useState } from 'react';

const ClipboardIcon = () => (
    <svg viewBox="0 0 100 100" className="notebook-icon-svg" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.3" />
            </filter>
            <linearGradient id="foldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fff" />
                <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
        </defs>

        <g filter="url(#shadow)" transform="rotate(-5 50 50)">
            {/* Clipboard board */}
            <rect x="15" y="10" width="70" height="85" rx="4" fill="#1fc786" />
            {/* White paper */}
            <path d="M 22 18 L 78 18 L 78 75 L 63 90 L 22 90 Z" fill="#ffffff" />
            {/* Paper fold */}
            <path d="M 78 75 L 63 75 L 63 90 Z" fill="url(#foldGrad)" />
            
            {/* Clip mechanism */}
            <rect x="40" y="5" width="20" height="8" rx="2" fill="#3b428c" />
            <rect x="35" y="10" width="30" height="12" rx="3" fill="#3b428c" />

            {/* Text */}
            <text x="50" y="30" fontFamily="sans-serif" fontWeight="900" fontSize="8" fill="#3b428c" textAnchor="middle">TO-DO LIST</text>
            
            {/* Check 1 */}
            <circle cx="30" cy="40" r="4" fill="none" stroke="#1fc786" strokeWidth="1" />
            <polyline points="28,40 30,42 33,37" fill="none" stroke="#3b428c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="38" y1="38" x2="68" y2="38" stroke="#a0aec0" strokeWidth="1" strokeLinecap="round" />
            <line x1="38" y1="42" x2="63" y2="42" stroke="#a0aec0" strokeWidth="1" strokeLinecap="round" />

            {/* Check 2 */}
            <circle cx="30" cy="54" r="4" fill="none" stroke="#1fc786" strokeWidth="1" />
            <polyline points="28,54 30,56 33,51" fill="none" stroke="#3b428c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="38" y1="52" x2="58" y2="52" stroke="#a0aec0" strokeWidth="1" strokeLinecap="round" />
            <line x1="38" y1="56" x2="68" y2="56" stroke="#a0aec0" strokeWidth="1" strokeLinecap="round" />

            {/* Check 3 */}
            <circle cx="30" cy="68" r="4" fill="none" stroke="#1fc786" strokeWidth="1" />
            <polyline points="28,68 30,70 33,65" fill="none" stroke="#3b428c" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="38" y1="66" x2="65" y2="66" stroke="#a0aec0" strokeWidth="1" strokeLinecap="round" />
            <line x1="38" y1="70" x2="50" y2="70" stroke="#a0aec0" strokeWidth="1" strokeLinecap="round" />
        </g>
    </svg>
)

export function TopMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const [hasViewed, setHasViewed] = useState(false);

    const handleOpen = () => {
        setIsOpen(true);
        setHasViewed(true);
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    return (
        <div className="top-menu-container">
            {/* O Icone Flutuante */}
            <div className="notebook-icon-wrapper" onClick={handleOpen}>
                <ClipboardIcon />
                {!hasViewed && (
                    <div className="notebook-icon-badge">!</div>
                )}
            </div>

            {/* O Modal / Popup (Aparece quando clicado) */}
            {isOpen && (
                <div className="todo-modal-overlay" onClick={handleClose}>
                    <div className="todo-modal-clipboard" onClick={e => e.stopPropagation()}>
                        <div className="todo-clip-top"></div>
                        
                        <div className="todo-modal-paper">
                            <div className="todo-modal-paper-fold"></div>
                            <button className="todo-close-btn" onClick={handleClose}>×</button>
                            
                            <div className="todo-paper-header">
                                <h2>TO-DO LIST</h2>
                            </div>
                            
                            <div className="todo-list-content">
                                <div className="todo-list-item">
                                    <div className="todo-item-check">
                                        <svg viewBox="0 0 24 24"><polyline points="5,12 10,17 19,8" /></svg>
                                    </div>
                                    <div className="todo-item-text">
                                        <p><strong>1. Revisar Flashcards</strong> Resolva as cartas pendentes do dia na sua escrivaninha.</p>
                                    </div>
                                </div>
                                <div className="todo-list-item futuro">
                                    <div className="todo-item-check"></div>
                                    <div className="todo-item-text">
                                        <p><strong>2. Raciocínio (Em Breve)</strong> Pratique escrevendo uma questão em seu caderno AI.</p>
                                    </div>
                                </div>
                                <div className="todo-list-item futuro">
                                    <div className="todo-item-check"></div>
                                    <div className="todo-item-text">
                                        <p><strong>3. Relatório (Em Breve)</strong> Converse com o modelo de contexto sobre as provas da FUVEST.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
