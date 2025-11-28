"use client"

import React from 'react';
import styled from 'styled-components';

interface Option {
  id: string;
  label: string;
}

interface GlassRadioSelectorProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  name: string;
}

const GlassRadioSelector: React.FC<GlassRadioSelectorProps> = ({ value, onChange, options, name }) => {
  return (
    <StyledWrapper $optionsCount={options.length}>
      <div className="glass-radio-group">
        {options.map((option) => (
          <React.Fragment key={option.id}>
            <input 
              type="radio" 
              name={name}
              id={`glass-${name}-${option.id}`}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <label htmlFor={`glass-${name}-${option.id}`}>{option.label}</label>
          </React.Fragment>
        ))}
        <div className="glass-glider" />
      </div>
    </StyledWrapper>
  );
}

const StyledWrapper = styled.div<{ $optionsCount: number }>`
  .glass-radio-group {
    /* Mode clair par défaut - contraste amélioré */
    --bg: rgba(255, 255, 255, 0.4);
    --text: #1a1a1a;
    --text-hover: #000000;
    --text-checked: #ffffff;
    display: flex;
    position: relative;
    background: var(--bg);
    border-radius: 0.5rem;
    backdrop-filter: blur(12px);
    box-shadow:
      inset 1px 1px 4px rgba(255, 255, 255, 0.5),
      inset -1px -1px 6px rgba(0, 0, 0, 0.1),
      0 4px 12px rgba(0, 0, 0, 0.1);
    overflow: hidden;
    width: 240px;
    transform: scale(0.85);
  }

  /* Mode sombre - styles originaux */
  :global(.dark) .glass-radio-group,
  :global([data-theme="dark"]) .glass-radio-group {
    --bg: rgba(255, 255, 255, 0.06);
    --text: #e5e5e5;
    --text-hover: #ffffff;
    --text-checked: #ffffff;
    box-shadow:
      inset 1px 1px 4px rgba(255, 255, 255, 0.2),
      inset -1px -1px 6px rgba(0, 0, 0, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .glass-radio-group input {
    display: none;
  }

  .glass-radio-group label {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    font-size: 11px;
    padding: 0.4rem 0.5rem;
    cursor: pointer;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: var(--text);
    position: relative;
    z-index: 2;
    transition: color 0.3s ease-in-out;
    white-space: nowrap;
  }

  .glass-radio-group label:hover {
    color: var(--text-hover);
  }

  .glass-radio-group input:checked + label {
    color: var(--text-checked);
  }

  .glass-glider {
    position: absolute;
    top: 0;
    bottom: 0;
    width: calc(100% / ${props => props.$optionsCount});
    border-radius: 0.5rem;
    z-index: 1;
    transition:
      transform 0.5s cubic-bezier(0.37, 1.95, 0.66, 0.56),
      background 0.4s ease-in-out,
      box-shadow 0.4s ease-in-out;
  }

  /* Type de données - Gestionnaire (1ère position) */
  #glass-chart-type-gestionnaire:checked ~ .glass-glider {
    transform: translateX(0%);
    background: linear-gradient(135deg, #10b98155, #10b981);
    box-shadow:
      0 0 18px rgba(16, 185, 129, 0.5),
      0 0 10px rgba(167, 243, 208, 0.4) inset;
  }

  /* Type de données - Agences (2ème position) */
  #glass-chart-type-agences:checked ~ .glass-glider {
    transform: translateX(100%);
    background: linear-gradient(135deg, #3b82f655, #3b82f6);
    box-shadow:
      0 0 18px rgba(59, 130, 246, 0.5),
      0 0 10px rgba(147, 197, 253, 0.4) inset;
  }

  /* Type de données - Métier (3ème position) */
  #glass-chart-type-metier:checked ~ .glass-glider {
    transform: translateX(200%);
    background: linear-gradient(135deg, #ffd70055, #ffcc00);
    box-shadow:
      0 0 18px rgba(255, 215, 0, 0.5),
      0 0 10px rgba(255, 235, 150, 0.4) inset;
  }

  /* Métrique - Volume */
  #glass-metric-volume:checked ~ .glass-glider {
    transform: translateX(0%);
    background: linear-gradient(135deg, #8b5cf655, #8b5cf6);
    box-shadow:
      0 0 18px rgba(139, 92, 246, 0.5),
      0 0 10px rgba(196, 181, 253, 0.4) inset;
  }

  /* Métrique - CA */
  #glass-metric-ca:checked ~ .glass-glider {
    transform: translateX(100%);
    background: linear-gradient(135deg, #f59e0b55, #f59e0b);
    box-shadow:
      0 0 18px rgba(245, 158, 11, 0.5),
      0 0 10px rgba(253, 230, 138, 0.4) inset;
  }

  /* Métrique - Marge */
  #glass-metric-marge:checked ~ .glass-glider {
    transform: translateX(200%);
    background: linear-gradient(135deg, #10b98155, #10b981);
    box-shadow:
      0 0 18px rgba(16, 185, 129, 0.5),
      0 0 10px rgba(167, 243, 208, 0.4) inset;
  }
`;

export default GlassRadioSelector;
