"use client"

import React from 'react'
import styled from 'styled-components'

interface StyledSwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  id?: string
}

const StyledLabel = styled.label<{ $checked: boolean }>`
  height: 30px;
  width: 60px;
  background-color: #ffffff;
  border-radius: 15px;
  -webkit-box-shadow: inset 0 0 2.5px 2px rgba(255, 255, 255, 1),
    inset 0 0 10px 0.5px rgba(0, 0, 0, 0.488), 5px 10px 15px rgba(0, 0, 0, 0.096),
    inset 0 0 0 1.5px rgba(0, 0, 0, 0.3);
  box-shadow: inset 0 0 2.5px 2px rgba(255, 255, 255, 1),
    inset 0 0 10px 0.5px rgba(0, 0, 0, 0.488), 5px 10px 15px rgba(0, 0, 0, 0.096),
    inset 0 0 0 1.5px rgba(0, 0, 0, 0.3);
  display: -webkit-box;
  display: -ms-flexbox;
  display: flex;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  cursor: pointer;
  position: relative;
  -webkit-transition: -webkit-transform 0.4s;
  transition: -webkit-transform 0.4s;
  transition: transform 0.4s;

  &:hover {
    -webkit-transform: perspective(100px) rotateX(${props => props.$checked ? '-5deg' : '5deg'}) rotateY(${props => props.$checked ? '5deg' : '-5deg'});
    transform: perspective(100px) rotateX(${props => props.$checked ? '-5deg' : '5deg'}) rotateY(${props => props.$checked ? '5deg' : '-5deg'});
  }

  &::before {
    position: absolute;
    content: "";
    height: 20px;
    width: 20px;
    border-radius: 50%;
    background-color: ${props => props.$checked ? '#000000' : '#000000'};
    background-image: ${props => props.$checked 
      ? 'linear-gradient(315deg, #000000 0%, #414141 70%)'
      : 'linear-gradient(130deg, #757272 10%, #ffffff 11%, #726f6f 62%)'};
    left: ${props => props.$checked ? '35px' : '5px'};
    -webkit-box-shadow: 0 1px 0.5px rgba(0, 0, 0, 0.3),
      5px 5px 5px rgba(0, 0, 0, 0.3);
    box-shadow: 0 1px 0.5px rgba(0, 0, 0, 0.3), 5px 5px 5px rgba(0, 0, 0, 0.3);
    -webkit-transition: 0.4s;
    transition: 0.4s;
  }
`

const StyledInput = styled.input`
  display: none;
`

const StyledWrapper = styled.div`
  .container {
  }
`

export const StyledSwitch = React.forwardRef<
  HTMLInputElement,
  StyledSwitchProps
>(({ id, checked = false, onCheckedChange, ...props }, ref) => {
  const switchId = id || `styled-switch-${Math.random().toString(36).substr(2, 9)}`
  
  return (
    <StyledWrapper>
      <div className="container">
        <StyledInput 
          ref={ref}
          type="checkbox" 
          name="checkbox" 
          id={switchId} 
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <StyledLabel htmlFor={switchId} $checked={checked} />
      </div>
    </StyledWrapper>
  )
})

StyledSwitch.displayName = "StyledSwitch"

