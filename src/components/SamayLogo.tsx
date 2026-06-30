import React, { useState } from "react";
import logoUrl from "../assets/logo.png";
import { X } from "lucide-react";

interface SamayLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
  textColor?: string;
  textSize?: string;
  layout?: "horizontal" | "vertical" | "icon";
  disableZoom?: boolean;
}

export default function SamayLogo({
  className = "",
  size = 40,
  showText = false,
  textColor = "text-[#2172CD]",
  textSize = "text-sm",
  layout = "horizontal",
  disableZoom = false,
}: SamayLogoProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Determine layout structure
  const isVertical = layout === "vertical";
  const isIconOnly = layout === "icon" || (!showText && layout === "horizontal");

  const logoMark = (
    <img
      src={logoUrl}
      width={size}
      height={size}
      onClick={(e) => {
        if (disableZoom) return;
        e.stopPropagation();
        setIsOpen(true);
      }}
      className={`shrink-0 drop-shadow-sm object-contain ${
        disableZoom ? "" : "cursor-zoom-in hover:opacity-90 transition-opacity"
      }`}
      alt="Samay AI Logo"
    />
  );

  const lightboxModal = !disableZoom && isOpen && (
    <div 
      onClick={() => setIsOpen(false)}
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex flex-col items-center justify-center p-6 cursor-zoom-out"
    >
      {/* Close button */}
      <button 
        onClick={() => setIsOpen(false)}
        className="absolute top-6 right-6 p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer border-0 outline-none"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Card Wrapper for Large Image */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col items-center justify-center space-y-4 max-w-sm sm:max-w-md w-full bg-[#161616] p-8 border border-gray-800 rounded-3xl shadow-2xl relative cursor-default max-h-[90vh] overflow-y-auto"
      >
        <img 
          src={logoUrl} 
          className="w-48 h-48 sm:w-64 sm:h-64 max-h-[50vh] object-contain drop-shadow-lg" 
          alt="Samay AI Logo Large" 
        />
        <div className="text-center space-y-1">
          <h3 className="text-white font-sans font-bold text-lg tracking-tight uppercase">Samay AI</h3>
          <p className="text-gray-500 font-mono text-[10px] uppercase tracking-widest">Productivity Chief of Staff</p>
        </div>
      </div>
    </div>
  );

  if (isIconOnly) {
    return (
      <>
        <div className={`inline-flex items-center ${className}`}>
          {logoMark}
        </div>
        {lightboxModal}
      </>
    );
  }

  if (isVertical) {
    return (
      <>
        <div className={`flex flex-col items-center gap-3 text-center ${className}`}>
          {logoMark}
          <span className={`font-sans font-extrabold uppercase tracking-widest text-[#2172CD] ${textSize}`}>
            Samay AI
          </span>
        </div>
        {lightboxModal}
      </>
    );
  }

  // Horizontal layout
  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        {logoMark}
        <span className={`font-sans font-black tracking-tight uppercase ${textColor} ${textSize}`}>
          Samay AI
        </span>
      </div>
      {lightboxModal}
    </>
  );
}
