export class FusionService {
  constructor() {
    this.settings = {
      confThreshold: 80,
      patternRegex: '^(?:(?:[CDES][0-9]{8})|(?:[CDESN]{2}[0-9]{7}))$',
      forceParseIndex: false,
      parseIndex: 0
    }
  }
  
  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings }
    console.log('FusionService settings updated:', this.settings)
  }
  
  fuseOCRResults(ocrResults, settings = {}) {
    const effectiveSettings = { ...this.settings, ...settings }
    
    // Collect all sources
    const sources = []
    
    if (ocrResults.vision) {
      sources.push({
        name: 'vision',
        result: ocrResults.vision,
        weight: 1.0,
        reliability: this.assessSourceReliability(ocrResults.vision)
      })
    }
    
    if (ocrResults.tesseract) {
      sources.push({
        name: 'tesseract',
        result: ocrResults.tesseract,
        weight: 0.7,
        reliability: this.assessSourceReliability(ocrResults.tesseract)
      })
    }
    
    if (ocrResults.template) {
      sources.push({
        name: 'template',
        result: ocrResults.template,
        weight: 0.5,
        reliability: this.assessSourceReliability(ocrResults.template)
      })
    }
    
    if (sources.length === 0) {
      return this.createEmptyResult('No OCR sources available')
    }
    
    // Character-by-character fusion with variable length support
    const fusedResult = this.performVariableLengthFusion(sources, effectiveSettings)
    
    // Apply quality gates and pattern validation
    const finalResult = this.applyQualityGates(fusedResult, effectiveSettings)
    
    return finalResult
  }
  
  performVariableLengthFusion(sources, settings) {
    // Determine the most likely length from sources
    const lengths = sources
      .filter(s => s.result && s.result.passport_number)
      .map(s => s.result.passport_number.replace(/X/g, '').length)
    
    const mostCommonLength = this.getMostCommonLength(lengths)
    const maxLength = Math.max(9, mostCommonLength) // Use detected length but cap at 9
    
    const finalChars = Array(maxLength).fill('X')
    const finalConf = Array(maxLength).fill(0)
    const finalSrc = Array(maxLength).fill('no_data')
    const damageFlags = Array(maxLength).fill(false)
    const reasons = []
    
    for (let pos = 0; pos < maxLength; pos++) {
      const candidates = []
      
      // Collect candidates from all sources
      sources.forEach(source => {
        const result = source.result
        if (result.passport_number && pos < result.passport_number.length) {
          const char = result.passport_number[pos]
          const conf = result.per_char_conf ? result.per_char_conf[pos] : result.confidence || 0
          const damaged = result.damage_flags ? result.damage_flags[pos] : false
          
          if (char && char !== 'X') {
            // Enhanced validation for passport number patterns
            const isValidChar = this.validateCharacterAtPosition(char, pos, result.passport_number)
            
            candidates.push({
              char: char.toUpperCase(),
              confidence: conf * source.weight * source.reliability * (isValidChar ? 1.0 : 0.3),
              source: source.name,
              damaged: damaged,
              originalConf: conf,
              positionValid: isValidChar
            })
          }
        }
      })
      
      if (candidates.length === 0) {
        // No candidates for this position
        finalChars[pos] = pos < mostCommonLength ? 'X' : ''
        finalConf[pos] = 0
        finalSrc[pos] = 'no_candidates'
        damageFlags[pos] = pos < mostCommonLength
        if (pos < mostCommonLength) {
          reasons.push(`Position ${pos + 1}: No readable characters detected`)
        }
        continue
      }
      
      // Character-level consensus algorithm
      const consensus = this.buildCharacterConsensus(candidates, pos)
      
      finalChars[pos] = consensus.char
      finalConf[pos] = consensus.confidence
      finalSrc[pos] = consensus.source
      damageFlags[pos] = consensus.damaged
      
      if (consensus.notes) {
        reasons.push(`Position ${pos + 1}: ${consensus.notes}`)
      }
    }
    
    // Trim to actual length (remove trailing empty positions)
    const actualLength = this.determineActualLength(finalChars)
    const passportNumber = finalChars.slice(0, actualLength).join('')
    const overallConfidence = this.calculateOverallConfidence(
      finalConf.slice(0, actualLength), 
      damageFlags.slice(0, actualLength)
    )
    
    return {
      passport_number: passportNumber,
      per_char_conf: finalConf.slice(0, actualLength),
      per_char_src: finalSrc.slice(0, actualLength),
      damage_flags: damageFlags.slice(0, actualLength),
      confidence: overallConfidence,
      reasons: reasons.join('; '),
      fusion_method: 'variable_length_consensus',
      sources_used: sources.map(s => s.name),
      valid_positions: finalChars.slice(0, actualLength).filter(c => c !== 'X' && c !== '').length,
      detected_length: actualLength
    }
  }
  
  validateCharacterAtPosition(char, position, fullString) {
    // Validate character based on passport number format rules
    if (position === 0) {
      // First character must be C, D, E, S, or N
      return /^[CDESN]$/.test(char)
    } else if (position === 1) {
      // Second character depends on the format
      const firstChar = fullString[0]
      if (/^[CDES]$/.test(firstChar)) {
        // Could be either letter (for 2-letter format) or digit (for 1-letter format)
        return /^[CDESN0-9]$/.test(char)
      } else {
        // If first char is N, second must be from allowed letters or digit
        return /^[CDESN0-9]$/.test(char)
      }
    } else {
      // All other positions should be digits
      return /^[0-9]$/.test(char)
    }
  }
  
  getMostCommonLength(lengths) {
    if (lengths.length === 0) return 9
    
    const counts = {}
    lengths.forEach(len => {
      counts[len] = (counts[len] || 0) + 1
    })
    
    let maxCount = 0
    let mostCommon = 9
    Object.entries(counts).forEach(([len, count]) => {
      if (count > maxCount) {
        maxCount = count
        mostCommon = parseInt(len)
      }
    })
    
    return mostCommon
  }
  
  determineActualLength(chars) {
    // Find the last non-empty character
    for (let i = chars.length - 1; i >= 0; i--) {
      if (chars[i] && chars[i] !== '') {
        return i + 1
      }
    }
    return 0
  }
  
  buildCharacterConsensus(candidates, position) {
    if (candidates.length === 1) {
      const candidate = candidates[0]
      return {
        char: candidate.char,
        confidence: Math.round(candidate.confidence),
        source: candidate.source,
        damaged: candidate.damaged,
        notes: candidate.originalConf < 50 ? 'Low confidence single source' : 
               !candidate.positionValid ? 'Invalid character for position' : null
      }
    }
    
    // Group by character
    const charGroups = {}
    candidates.forEach(candidate => {
      if (!charGroups[candidate.char]) {
        charGroups[candidate.char] = []
      }
      charGroups[candidate.char].push(candidate)
    })
    
    // Find best consensus
    let bestChar = 'X'
    let bestScore = 0
    let bestGroup = []
    let consensusNotes = []
    
    Object.entries(charGroups).forEach(([char, group]) => {
      // Calculate weighted consensus score
      const totalWeight = group.reduce((sum, c) => sum + c.confidence, 0)
      const avgConfidence = totalWeight / group.length
      const sourceBonus = group.length > 1 ? 10 : 0 // Multiple sources agree
      const positionValidBonus = group.every(c => c.positionValid) ? 5 : -10
      const score = avgConfidence + sourceBonus + positionValidBonus
      
      if (score > bestScore) {
        bestScore = score
        bestChar = char
        bestGroup = group
      }
    })
    
    // Check for conflicts
    if (Object.keys(charGroups).length > 1) {
      const conflictInfo = Object.entries(charGroups)
        .map(([char, group]) => `${char}(${group.length})`)
        .join(' vs ')
      consensusNotes.push(`Character conflict: ${conflictInfo}`)
    }
    
    // Calculate final confidence
    let finalConfidence = Math.round(bestScore)
    
    // Apply penalties
    if (Object.keys(charGroups).length > 1) {
      finalConfidence = Math.max(30, finalConfidence - 20) // Conflict penalty
    }
    
    if (bestGroup.some(c => c.damaged)) {
      finalConfidence = Math.max(20, finalConfidence - 15) // Damage penalty
      consensusNotes.push('Damage detected in area')
    }
    
    if (bestGroup.some(c => !c.positionValid)) {
      finalConfidence = Math.max(10, finalConfidence - 25) // Invalid position penalty
      consensusNotes.push('Invalid character for passport format')
    }
    
    return {
      char: bestChar,
      confidence: Math.min(100, finalConfidence),
      source: bestGroup.map(c => c.source).join('+'),
      damaged: bestGroup.some(c => c.damaged),
      notes: consensusNotes.length > 0 ? consensusNotes.join(', ') : null
    }
  }
  
  calculateOverallConfidence(perCharConf, damageFlags) {
    const validConf = perCharConf.filter((conf, idx) => conf > 0)
    if (validConf.length === 0) return 0
    
    const avgConf = validConf.reduce((sum, conf) => sum + conf, 0) / validConf.length
    const completeness = validConf.length / perCharConf.length // Penalty for missing characters
    const damageRatio = damageFlags.filter(d => d).length / perCharConf.length
    
    // Apply penalties
    let finalConf = avgConf * completeness * (1 - damageRatio * 0.3)
    
    return Math.round(Math.max(0, Math.min(100, finalConf)))
  }
  
  assessSourceReliability(result) {
    let reliability = 1.0
    
    // Penalize sources with obvious hallucinations
    if (result.passport_number) {
      const invalidChars = result.passport_number.match(/[^A-Z0-9X]/g)
      if (invalidChars) {
        reliability *= 0.3 // Heavy penalty for invalid characters
      }
      
      // Check against expected length patterns (9 chars max)
      if (result.passport_number.length > 9) {
        reliability *= 0.5 // Penalty for wrong length
      }
      
      // Check pattern validity
      const pattern = new RegExp(this.settings.patternRegex)
      const cleanNumber = result.passport_number.replace(/X/g, '')
      if (!pattern.test(cleanNumber) && cleanNumber.length > 0) {
        reliability *= 0.7 // Penalty for pattern mismatch
      }
    }
    
    // Reward sources that detected damage
    if (result.damage_detected) {
      reliability *= 1.1 // Slight bonus for damage awareness
    }
    
    // Penalize sources with suspiciously high confidence on damaged areas
    if (result.damage_flags && result.per_char_conf) {
      const suspiciousHighConf = result.damage_flags.some((damaged, idx) => 
        damaged && result.per_char_conf[idx] > 80)
      if (suspiciousHighConf) {
        reliability *= 0.6
      }
    }
    
    return Math.max(0.1, Math.min(1.0, reliability))
  }
  
  applyQualityGates(result, settings) {
    const reasons = result.reasons ? [result.reasons] : []
    let status = 'SUCCESS'
    
    // Pattern validation with new regex
    const cleanNumber = result.passport_number.replace(/X/g, '')
    const pattern = new RegExp(settings.patternRegex)
    
    if (!pattern.test(cleanNumber) && cleanNumber.length > 0) {
      status = 'REVIEW_REQUIRED'
      reasons.push('Pattern validation failed - does not match expected passport format')
    }
    
    // Confidence threshold
    if (result.confidence < settings.confThreshold) {
      status = 'REVIEW_REQUIRED'
      reasons.push(`Confidence ${result.confidence}% below threshold ${settings.confThreshold}%`)
    }
    
    // Missing characters
    const missingCount = (result.passport_number.match(/X/g) || []).length
    if (missingCount > 0) {
      if (missingCount >= 5) {
        status = 'BAD_IMAGE'
        reasons.push(`Too many unreadable characters (${missingCount}/${result.passport_number.length})`)
      } else {
        status = 'REVIEW_REQUIRED'
        reasons.push(`${missingCount} characters unreadable due to damage`)
      }
    }
    
    // Length validation
    if (result.passport_number.length < 7 || result.passport_number.length > 9) {
      status = 'REVIEW_REQUIRED'
      reasons.push(`Invalid passport number length: ${result.passport_number.length} characters`)
    }
    
    // Damage assessment
    if (result.damage_flags && result.damage_flags.filter(d => d).length > 3) {
      status = 'REVIEW_REQUIRED'
      reasons.push('Extensive damage detected')
    }
    
    return {
      ...result,
      status,
      reasons: reasons.join('; '),
      quality_gates: {
        pattern_valid: pattern.test(cleanNumber),
        confidence_passed: result.confidence >= settings.confThreshold,
        completeness: (result.passport_number.length - missingCount) / result.passport_number.length,
        damage_ratio: result.damage_flags ? 
          result.damage_flags.filter(d => d).length / result.passport_number.length : 0,
        length_valid: result.passport_number.length >= 7 && result.passport_number.length <= 9
      }
    }
  }
  
  createEmptyResult(reason) {
    return {
      passport_number: 'XXXXXXXXX',
      per_char_conf: Array(9).fill(0),
      per_char_src: Array(9).fill('no_source'),
      damage_flags: Array(9).fill(true),
      confidence: 0,
      status: 'ERROR',
      reasons: reason,
      fusion_method: 'no_fusion',
      sources_used: [],
      valid_positions: 0
    }
  }
}