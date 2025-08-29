import React from 'react'
import { AlertTriangle } from 'lucide-react'

const ConfidenceChips = ({ passportNumber, confidences, damageFlags, sources }) => {
  if (!passportNumber) return null

  const getConfidenceClass = (confidence, isDamaged) => {
    if (isDamaged) return 'confidence-damaged'
    if (confidence >= 80) return 'confidence-high'
    if (confidence >= 60) return 'confidence-medium'
    return 'confidence-low'
  }

  const getSourceIcon = (source, isDamaged) => {
    if (isDamaged) return '🔥'
    if (source && source.includes('+')) return '🔗' // Multiple sources
    if (source === 'vision_model') return '👁️'
    if (source === 'tesseract') return '📝'
    if (source === 'template') return '🎯'
    return '❓'
  }

  return (
    <div className="inline-flex items-center space-x-1 font-mono text-sm">
      {passportNumber.split('').map((char, index) => {
        const confidence = confidences ? confidences[index] : 0
        const isDamaged = damageFlags ? damageFlags[index] : false
        const source = sources ? sources[index] : ''
        
        return (
          <div
            key={index}
            className={`relative group inline-flex items-center justify-center w-8 h-8 text-xs font-bold rounded-lg border-2 transition-all ${
              isDamaged 
                ? 'bg-red-50 text-red-900 border-red-300' 
                : confidence >= 80 
                ? 'bg-emerald-50 text-emerald-900 border-emerald-300' 
                : confidence >= 60 
                ? 'bg-amber-50 text-amber-900 border-amber-300' 
                : 'bg-red-50 text-red-900 border-red-300'
            }`}
            title={`Character: ${char}\nConfidence: ${confidence}%\nSource: ${source}\n${isDamaged ? 'Damage detected' : 'Clean'}`}
          >
            {/* Character */}
            <span className="relative z-10">
              {char === 'X' ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                char
              )}
            </span>
            
            {/* Confidence indicator */}
            <div 
              className={`absolute bottom-0 left-0 right-0 h-1 rounded-b-lg ${
                isDamaged 
                  ? 'bg-red-400' 
                  : confidence >= 80 
                  ? 'bg-emerald-400' 
                  : confidence >= 60 
                  ? 'bg-amber-400' 
                  : 'bg-red-400'
              }`}
              style={{ width: `${Math.max(10, confidence)}%` }}
            />
            
            {/* Source indicator */}
            <div className="absolute -top-1 -right-1 text-xs">
              {getSourceIcon(source, isDamaged)}
            </div>
            
            {/* Damage warning */}
            {isDamaged && (
              <div className="absolute -top-1 -left-1">
                <AlertTriangle className="w-3 h-3 text-red-600" />
              </div>
            )}
            
            {/* Detailed tooltip on hover */}
            <div className="invisible group-hover:visible absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 rounded-lg shadow-lg z-20 whitespace-nowrap">
              <div>Char: <strong>{char}</strong></div>
              <div>Confidence: <strong>{confidence}%</strong></div>
              <div>Source: <strong>{source || 'unknown'}</strong></div>
              {isDamaged && <div className="text-red-300">⚠️ Damage detected</div>}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ConfidenceChips