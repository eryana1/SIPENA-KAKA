import React from "react";

export const DisdikLogo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => {
  return (
    <svg 
      viewBox="0 0 540 400" 
      className={className} 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      id="disdik_logo_svg"
    >
      {/* Definitions for Gradient and Filters */}
      <defs>
        <linearGradient id="purpleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7E37C9" />
          <stop offset="50%" stopColor="#5E229F" />
          <stop offset="100%" stopColor="#411373" />
        </linearGradient>
      </defs>
      
      {/* 1. Top Emblem (Kearifan Lokal / Cakra/ Flower) in Purple Gradient */}
      <g transform="translate(160, 10)">
        {/* Outer crown arches */}
        <path d="M110 50 C110 20, 100 10, 110 0 C120 10, 110 20, 110 50 Z" fill="url(#purpleGrad)" />
        <path d="M110 50 C80 20, 70 30, 110 0 C150 30, 140 20, 110 50 Z" fill="url(#purpleGrad)" opacity="0.8" />
        
        {/* Left Wing / Arch */}
        <path d="M60 85 C35 60, 45 45, 25 70 C45 95, 45 105, 60 85 Z" fill="url(#purpleGrad)" />
        <path d="M60 85 C20 70, 30 55, 45 45 C45 45, 55 65, 60 85 Z" fill="url(#purpleGrad)" opacity="0.6" />
        
        {/* Right Wing / Arch */}
        <path d="M160 85 C185 60, 175 45, 195 70 C175 95, 175 105, 160 85 Z" fill="url(#purpleGrad)" />
        <path d="M160 85 C200 70, 190 55, 175 45 C175 45, 165 65, 160 85 Z" fill="url(#purpleGrad)" opacity="0.6" />

        {/* Central Wheel */}
        <circle cx="110" cy="85" r="48" stroke="url(#purpleGrad)" strokeWidth="8" fill="none" />
        <circle cx="110" cy="85" r="35" stroke="url(#purpleGrad)" strokeWidth="2.5" strokeDasharray="6,4" fill="none" />
        <circle cx="110" cy="85" r="14" fill="url(#purpleGrad)" />
        <circle cx="110" cy="85" r="6" fill="#FFF" />
        
        {/* Cross bars */}
        <line x1="110" y1="37" x2="110" y2="133" stroke="url(#purpleGrad)" strokeWidth="7" strokeLinecap="round" />
        <line x1="62" y1="85" x2="158" y2="85" stroke="url(#purpleGrad)" strokeWidth="7" strokeLinecap="round" />
        
        {/* Dots on cross bars */}
        <circle cx="110" cy="58" r="3.5" fill="#FFF" />
        <circle cx="110" cy="112" r="3.5" fill="#FFF" />
        <circle cx="83" cy="85" r="3.5" fill="#FFF" />
        <circle cx="137" cy="85" r="3.5" fill="#FFF" />

        {/* Bottom anchor curves */}
        <path d="M62 85 C52 125, 110 148, 110 148 C110 148, 168 125, 158 85" stroke="url(#purpleGrad)" strokeWidth="5" fill="none" />
      </g>
      
      {/* 2. DISDIK Text Styling with Pencil/Pen "I" */}
      <g transform="translate(10, 180)">
        {/* Letter D */}
        <path d="M15 15 H55 C90 15, 105 35, 105 70 C105 105, 90 125, 55 125 H15 V15 Z M45 42 V98 H55 C74 98, 77 88, 77 70 C77 52, 74 42, 55 42 H45 Z" fill="url(#purpleGrad)" />
        
        {/* Letter I (Pencil pointing down) */}
        {/* Pencil shaft */}
        <rect x="125" y="35" width="24" height="65" rx="3" fill="url(#purpleGrad)" />
        {/* Collar band */}
        <rect x="125" y="27" width="24" height="8" fill="#5E229F" opacity="0.8" />
        {/* Pencil eraser / top */}
        <path d="M125 27 C125 15, 149 15, 149 27 Z" fill="url(#purpleGrad)" />
        {/* Lead tip pointing down */}
        <path d="M125 100 L137 125 L149 100 Z" fill="url(#purpleGrad)" />
        {/* Pencil point */}
        <path d="M133 116 L137 125 L141 116 Z" fill="#310D59" />

        {/* Letter S */}
        <path d="M170 100 C170 118, 188 126, 210 126 C238 126, 252 112, 252 94 C252 70, 222 70, 222 56 C222 48, 229 42, 242 42 C255 42, 262 48, 264 60 H288 C287 32, 268 16, 242 16 C215 16, 196 28, 196 50 C196 74, 226 74, 226 88 C226 96, 218 102, 206 102 C192 102, 185 94, 184 84 H160 C160 84, 170 94, 170 100 Z" fill="url(#purpleGrad)" />

        {/* Letter D */}
        <path d="M305 15 H345 C380 15, 395 35, 395 70 C395 105, 380 125, 345 125 H305 V15 Z M335 42 V98 H345 C364 98, 367 88, 367 70 C367 52, 364 42, 345 42 H335 Z" fill="url(#purpleGrad)" />

        {/* Letter I */}
        <rect x="415" y="15" width="24" height="110" rx="3" fill="url(#purpleGrad)" />

        {/* Letter K */}
        <path d="M455 15 H480 V65 L510 15 H538 L500 70 L540 125 H512 L480 77 V125 H455 V15 Z" fill="url(#purpleGrad)" />
      </g>
      
      {/* 3. KABUPATEN CIAMIS Text */}
      <text 
        x="270" 
        y="365" 
        fill="#411373" 
        fontFamily="system-ui, -apple-system, sans-serif" 
        fontSize="34" 
        fontWeight="900" 
        letterSpacing="8" 
        textAnchor="middle"
        id="disdik_brand_label"
      >
        KABUPATEN CIAMIS
      </text>
    </svg>
  );
};
