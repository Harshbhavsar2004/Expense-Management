"use client";

import React from "react";

interface CircularLoaderProps {
  message?: string;
  size?: number;
  color?: string;
}

export function CircularLoader({ 
  message = "Loading...", 
  size = 48,
  color = "#3b82f6" // blue-500
}: CircularLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full animate-in fade-in duration-500">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Outer track */}
        <div 
          className="absolute inset-0 rounded-full border-4 border-slate-100"
          style={{ width: size, height: size }}
        />
        {/* Spinning indicator */}
        <div 
          className="absolute inset-0 rounded-full border-4 border-transparent border-t-current animate-spin"
          style={{ 
            width: size, 
            height: size,
            color: color,
            borderTopColor: color
          }}
        />
      </div>
      {message && (
        <p className="mt-4 text-slate-400 font-medium text-sm tracking-wide animate-pulse">
          {message}
        </p>
      )}
    </div>
  );
}
