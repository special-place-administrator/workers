import axios from 'axios'
import fs from 'fs'
import sharp from 'sharp'

export class OCRService {
  constructor() {
    this.modelUrl = process.env.MODEL_URL || 'http://10.4.0.15:11434'
    this.modelName = process.env.MODEL_NAME || 'benhaotang/Nanonets-OCR-s:latest'
    this.settings = {
      modelUrl: 'http://10.4.0.15:11434',
      modelName: 'benhaotang/Nanonets-OCR-s:latest',
      visionPrompt: 'Extract the passport number from this image. The passport number can be in one of these formats: 1) Single letter C, D, E, or S followed by 8 digits (e.g., C12345678), or 2) Two letters from C, D, E, S, N followed by 7 digits (e.g., CD1234567). Return only JSON: {"passport_number": "C12345678", "confidence": 85}',
      forceParseIndex: false,
      parseIndex: 0,
      confThreshold: 80,
      patternRegex: '^(?:(?:[CDES][0-9]{8})|(?:[CDESN]{2}[0-9]{7}))$'
    }
  }
  
  updateSettings(settings) {
    this.settings = { ...this.settings, ...settings }
    this.modelUrl = this.settings.modelUrl
    this.modelName = this.settings.modelName
    console.log('OCRService settings updated:', this.settings)
  }
  
  async processImage(imagePath, settings = {}) {
    const results = {}
    
    try {
      // Enhanced Vision Model OCR with character-level analysis
      results.vision = await this.callVisionModelWithCharacterAnalysis(imagePath)
    } catch (error) {
      console.warn('Vision model failed:', error.message)
      results.vision = null
    }
    
    try {
      // Tesseract with character segmentation
      results.tesseract = await this.callTesseractWithSegmentation(imagePath)
    } catch (error) {
      console.warn('Tesseract failed:', error.message)
      results.tesseract = null
    }
    
    try {
      // Character-level template matching as fallback
      results.template = await this.templateMatchCharacters(imagePath)
    } catch (error) {
      console.warn('Template matching failed:', error.message)
      results.template = null
    }
    
    return results
  }
  
  async callVisionModelWithCharacterAnalysis(imagePath) {
    const imageBuffer = fs.readFileSync(imagePath)
    const base64Image = imageBuffer.toString('base64')
    
    // Step 1: Get overall passport number with enhanced prompt for new pattern
    const overallPrompt = `
Look at this passport image and extract the passport number.
The passport number format can be:
- Format 1: One letter (C, D, E, or S) followed by 8 digits (e.g., C12345678)
- Format 2: Two letters (from C, D, E, S, N) followed by 7 digits (e.g., CD1234567, EN1234567)

The number may be damaged with punch holes - report what you can see clearly.
Use 'X' for completely unreadable characters due to damage.
Return only JSON: {"passport_number": "C12345678", "overall_confidence": 85, "damage_detected": false}
`
    
    const overallResponse = await this.callModel(base64Image, overallPrompt)
    let overallResult
    
    try {
      overallResult = JSON.parse(overallResponse.response)
    } catch {
      // Fallback parsing with updated pattern
      const match = overallResponse.response.match(/[CDESN]{1,2}[0-9X]{7,8}/)
      overallResult = {
        passport_number: match ? match[0] : 'XXXXXXXXX',
        overall_confidence: 50,
        damage_detected: true
      }
    }
    
    // Step 2: Character-by-character analysis with variable length support
    const characterPrompt = `
Analyze this passport image character by character for the passport number.
The passport number can be 9 characters total in these formats:
- Format 1: 1 letter + 8 digits (C12345678)
- Format 2: 2 letters + 7 digits (CD1234567)

Look at each position and assess:
- What character you see (A-Z, 0-9, or X if unreadable/damaged)
- Confidence level 0-100 for that specific character
- Whether that position appears damaged by punch holes or other defects

Return only JSON:
{
  "characters": [
    {"position": 1, "char": "C", "confidence": 95, "damaged": false},
    {"position": 2, "char": "D", "confidence": 90, "damaged": false},
    {"position": 3, "char": "1", "confidence": 85, "damaged": false},
    // ... continue for all characters found
  ]
}
`
    
    const characterResponse = await this.callModel(base64Image, characterPrompt)
    let characterResult
    
    try {
      characterResult = JSON.parse(characterResponse.response)
    } catch {
      // Generate fallback character analysis from overall result
      characterResult = this.generateFallbackCharacterAnalysis(overallResult.passport_number)
    }
    
    // Step 3: Validation and hallucination detection with new pattern
    const validatedResult = this.validateAndCorrectHallucinations(overallResult, characterResult)
    
    return validatedResult
  }
  
  async callModel(base64Image, prompt) {
    const response = await axios.post(`${this.modelUrl}/api/generate`, {
      model: this.modelName,
      prompt: prompt,
      images: [base64Image],
      stream: false,
      options: {
        temperature: 0.1,
        top_p: 0.9,
        repeat_penalty: 1.1
      }
    }, {
      timeout: 30000
    })
    
    return response.data
  }
  
  generateFallbackCharacterAnalysis(passportNumber) {
    const characters = []
    const maxLength = Math.min(passportNumber.length, 9)
    
    for (let i = 0; i < maxLength; i++) {
      const char = passportNumber[i] || 'X'
      characters.push({
        position: i + 1,
        char: char,
        confidence: char === 'X' ? 0 : 60,
        damaged: char === 'X'
      })
    }
    return { characters }
  }
  
  validateAndCorrectHallucinations(overallResult, characterResult) {
    const characters = characterResult.characters || []
    const maxLength = 9 // Maximum passport number length
    const perCharConf = Array(maxLength).fill(0)
    const perCharSrc = Array(maxLength).fill('unknown')
    const damageFlags = Array(maxLength).fill(false)
    let finalPassportNumber = ''
    
    // Determine the actual length and validate format
    let detectedLength = Math.min(characters.length, maxLength)
    if (overallResult.passport_number) {
      detectedLength = Math.min(overallResult.passport_number.length, maxLength)
    }
    
    // Process each character position
    for (let i = 0; i < detectedLength; i++) {
      const charData = characters.find(c => c.position === i + 1) || 
                      { char: 'X', confidence: 0, damaged: true }
      
      let char = charData.char || 'X'
      let confidence = charData.confidence || 0
      
      // Enhanced character validation for passport patterns
      if (i === 0) {
        // First character must be C, D, E, S, or N
        if (!/^[CDESN]$/.test(char)) {
          char = 'X'
          confidence = 0
          charData.damaged = true
        }
      } else if (i === 1) {
        // Second character: if first was C/D/E/S, this could be letter or digit
        // If this is a letter, it should be C/D/E/S/N, otherwise digit
        if (!/^[CDESN0-9]$/.test(char)) {
          char = 'X'
          confidence = 0
          charData.damaged = true
        }
      } else {
        // Remaining characters should be digits
        if (!/^[0-9]$/.test(char)) {
          char = 'X'
          confidence = 0
          charData.damaged = true
        }
      }
      
      // Cross-validate with overall result if available
      if (overallResult.passport_number && i < overallResult.passport_number.length) {
        const overallChar = overallResult.passport_number[i]
        if (overallChar !== char && overallChar !== 'X' && char !== 'X') {
          // Conflicting results - use lower confidence
          confidence = Math.min(confidence, 30)
          perCharSrc[i] = 'conflict'
        }
      }
      
      // Apply confidence penalties for questionable results
      if (confidence > 80 && charData.damaged) {
        confidence = 40 // Suspicious high confidence on damaged area
      }
      
      finalPassportNumber += char
      perCharConf[i] = Math.max(0, Math.min(100, confidence))
      damageFlags[i] = charData.damaged || false
      
      if (!perCharSrc[i] || perCharSrc[i] === 'unknown') {
        perCharSrc[i] = confidence > 50 ? 'vision_model' : 'fallback'
      }
    }
    
    // Pad shorter numbers with empty positions
    for (let i = detectedLength; i < maxLength; i++) {
      finalPassportNumber += ''
      perCharConf[i] = 0
      perCharSrc[i] = 'not_present'
      damageFlags[i] = false
    }
    
    // Calculate overall confidence (penalize X characters and validate pattern)
    const validChars = []
    for (let i = 0; i < detectedLength; i++) {
      if (finalPassportNumber[i] && finalPassportNumber[i] !== 'X') {
        validChars.push(perCharConf[i])
      }
    }
    
    const avgConfidence = validChars.length > 0 ? 
      validChars.reduce((sum, conf) => sum + conf, 0) / validChars.length : 0
    
    // Validate against expected patterns
    const pattern = new RegExp(this.settings.patternRegex)
    const cleanNumber = finalPassportNumber.replace(/X/g, '').slice(0, detectedLength)
    const patternValid = pattern.test(cleanNumber)
    
    return {
      passport_number: finalPassportNumber.slice(0, detectedLength),
      per_char_conf: perCharConf.slice(0, detectedLength),
      per_char_src: perCharSrc.slice(0, detectedLength),
      damage_flags: damageFlags.slice(0, detectedLength),
      confidence: Math.round(avgConfidence * (patternValid ? 1.0 : 0.7)), // Penalty for invalid pattern
      damage_detected: damageFlags.slice(0, detectedLength).some(d => d),
      valid_chars: validChars.length,
      pattern_valid: patternValid,
      detected_length: detectedLength,
      parsing_method: 'vision_character_analysis'
    }
  }
  
  async callTesseractWithSegmentation(imagePath) {
    // Enhanced Tesseract implementation with character segmentation
    // This would use actual Tesseract.js with character-level confidence
    return new Promise((resolve) => {
      try {
        // Mock implementation - in production use actual Tesseract.js
        // with character segmentation and confidence scores
        const mockResult = this.generateMockTesseractResult()
        resolve(mockResult)
      } catch (error) {
        resolve(null)
      }
    })
  }
  
  generateMockTesseractResult() {
    // Simulate Tesseract character-level results with new pattern
    const firstChars = 'CDES'
    const secondChars = 'CDESN0123456789'
    const digits = '0123456789'
    
    const perCharConf = []
    const perCharSrc = []
    let passportNumber = ''
    
    // Generate realistic passport number following the patterns
    const format = Math.random() > 0.5 ? 1 : 2
    
    if (format === 1) {
      // Format 1: 1 letter + 8 digits
      passportNumber += firstChars.charAt(Math.floor(Math.random() * firstChars.length))
      perCharConf.push(Math.round(Math.random() * 40 + 60))
      perCharSrc.push('tesseract')
      
      for (let i = 0; i < 8; i++) {
        const confidence = Math.random() * 100
        if (confidence < 20) {
          passportNumber += 'X'
          perCharConf.push(0)
        } else {
          passportNumber += digits.charAt(Math.floor(Math.random() * digits.length))
          perCharConf.push(Math.round(confidence))
        }
        perCharSrc.push('tesseract')
      }
    } else {
      // Format 2: 2 letters + 7 digits
      passportNumber += firstChars.charAt(Math.floor(Math.random() * firstChars.length))
      passportNumber += 'CDESN'.charAt(Math.floor(Math.random() * 5))
      perCharConf.push(Math.round(Math.random() * 40 + 60))
      perCharConf.push(Math.round(Math.random() * 40 + 60))
      perCharSrc.push('tesseract', 'tesseract')
      
      for (let i = 0; i < 7; i++) {
        const confidence = Math.random() * 100
        if (confidence < 20) {
          passportNumber += 'X'
          perCharConf.push(0)
        } else {
          passportNumber += digits.charAt(Math.floor(Math.random() * digits.length))
          perCharConf.push(Math.round(confidence))
        }
        perCharSrc.push('tesseract')
      }
    }
    
    return {
      passport_number: passportNumber,
      per_char_conf: perCharConf,
      per_char_src: perCharSrc,
      confidence: Math.round(perCharConf.reduce((sum, conf) => sum + conf, 0) / perCharConf.length),
      parsing_method: 'tesseract_segmentation'
    }
  }
  
  async templateMatchCharacters(imagePath) {
    // Template matching for individual characters as additional validation
    // This would implement character template matching against known fonts
    return new Promise((resolve) => {
      try {
        const mockResult = this.generateMockTemplateResult()
        resolve(mockResult)
      } catch (error) {
        resolve(null)
      }
    })
  }
  
  generateMockTemplateResult() {
    // Simulate template matching results with realistic passport patterns
    const patterns = ['C12345678', 'D87654321', 'CD1234567', 'EN9876543']
    const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)]
    
    const perCharConf = Array(selectedPattern.length).fill(0).map(() => Math.random() * 60 + 40)
    
    return {
      passport_number: selectedPattern,
      per_char_conf: perCharConf,
      per_char_src: Array(selectedPattern.length).fill('template'),
      confidence: Math.round(perCharConf.reduce((sum, conf) => sum + conf, 0) / perCharConf.length),
      parsing_method: 'template_matching'
    }
  }
}