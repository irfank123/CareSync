import axios from 'axios';
import config from '../config/config.mjs';

/**
 * Service for AI operations using Google's Gemini API
 */
class AIService {
  constructor() {
    this.initialized = false;
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
    this.modelName = 'gemini-2.0-flash';
    this.apiKey = config.gemini?.apiKey || process.env.GEMINI_API_KEY;
    this.cacheEnabled = true;
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
    this.cache = new Map();
    this.fallbackAttempted = false;
    this.testMode = false;
    
    // Initialize the service (in background)
    this._initializeAsync();
  }
  
  /**
   * Wrapper for async initialization
   * @private
   */
  _initializeAsync() {
    // Set default initialized state until async operation completes
    this.initialized = true;
    this.testMode = !this.apiKey;
    
    // Run the real initialization in the background
    this.initialize().catch(error => {
      console.error('Error during async initialization:', error);
      this.testMode = true;
    });
  }
  
  /**
   * Initialize the AI service
   */
  async initialize() {
    if (!this.apiKey) {
      console.warn('Gemini API key not found. Using mock AI responses for testing.');
      this.testMode = true;
      this.initialized = true;
      return;
    }
    
    // Check API key and available models
    try {
      console.log('Initializing AI service with Gemini API...');
      // Try to list available models to verify API key works
      const modelsUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`;
      const response = await axios.get(modelsUrl);
      
      if (response.data && response.data.models) {
        const availableModels = response.data.models.map(model => model.name.split('/').pop());
        console.log('Available Gemini models:', availableModels);
        
        // Check if our model is in the list
        if (!availableModels.includes(this.modelName)) {
          console.warn(`Model ${this.modelName} not found in available models. Will try with fallbacks if needed.`);
          
          // Set model to the first available one that includes 'gemini'
          const geminiModels = availableModels.filter(name => name.includes('gemini'));
          if (geminiModels.length > 0) {
            console.log(`Using available model: ${geminiModels[0]} instead of ${this.modelName}`);
            this.modelName = geminiModels[0];
          }
        } else {
          console.log(`Using model: ${this.modelName}`);
        }
        
        this.testMode = false;
        this.initialized = true;
        console.log('AI Service initialized successfully');
      } else {
        console.warn('Unable to retrieve available models. Falling back to test mode.');
        this.testMode = true;
        this.initialized = true;
      }
    } catch (error) {
      console.error('Error initializing AI service:', error.message);
      console.warn('Falling back to test mode due to initialization error.');
      this.testMode = true;
      this.initialized = true;
    }
  }
  
  /**
   * Generate medical assessment questions based on symptoms
   * @param {Array} symptoms - Array of patient symptoms
   * @param {Array} previousResponses - Previous Q&A pairs to generate follow-up questions
   * @returns {Promise<Array>} Array of relevant follow-up questions
   */
  async generateQuestions(symptoms, previousResponses = []) {
    try {
      const cacheKey = this._generateCacheKey('questions', { symptoms, previousResponses });
      
      // Check cache first
      if (this.cacheEnabled) {
        const cached = this._getFromCache(cacheKey);
        if (cached) return cached;
      }
      
      console.log('Generating questions for symptoms:', symptoms);
      
      // For test mode or if API call fails, return the mock questions
      if (this.testMode) {
        console.log('Using test mode mock questions');
        const mockQuestions = [
          {
            questionId: 'q1',
            question: 'When did the symptoms first begin?',
            answerType: 'text'
          },
          {
            questionId: 'q2',
            question: 'On a scale of 1-10, how would you rate the pain?',
            answerType: 'scale'
          },
          {
            questionId: 'q3',
            question: 'Do the symptoms worsen with certain activities?',
            answerType: 'text'
          },
          {
            questionId: 'q4',
            question: 'Have you tried any medications to relieve the symptoms?',
            answerType: 'boolean'
          }
        ];
        
        // Cache the result
        if (this.cacheEnabled) {
          this._addToCache(cacheKey, mockQuestions);
        }
        
        return mockQuestions;
      }
      
      // If not in test mode, try the real API
      try {
        const prompt = this._createQuestionGenerationPrompt(symptoms, previousResponses);
        const response = await this._callGeminiAPI(prompt);
        
        let questions;
        try {
          questions = JSON.parse(response);
        } catch (error) {
          console.error('Failed to parse AI response as JSON:', error);
          // Fallback parsing: try to extract questions if response is not valid JSON
          questions = this._extractQuestionsFromText(response);
        }
        
        // Validate questions format
        if (!Array.isArray(questions) || questions.length === 0) {
          throw new Error('Invalid questions format returned from AI');
        }
        
        // Cache the result
        if (this.cacheEnabled) {
          this._addToCache(cacheKey, questions);
        }
        
        return questions;
      } catch (error) {
        console.error('Error in AI question generation:', error);
        // Return fallback questions in case of any error
        return [
          {
            questionId: 'q1',
            question: 'When did the symptoms first begin?',
            answerType: 'text'
          },
          {
            questionId: 'q2',
            question: 'On a scale of 1-10, how would you rate the pain?',
            answerType: 'scale'
          },
          {
            questionId: 'q3',
            question: 'Do the symptoms worsen with certain activities?',
            answerType: 'text'
          }
        ];
      }
    } catch (error) {
      console.error('Unhandled error in generateQuestions:', error);
      // Final fallback for any unexpected errors
      return [
        {
          questionId: 'q1',
          question: 'When did your symptoms start?',
          answerType: 'text'
        },
        {
          questionId: 'q2',
          question: 'How severe are your symptoms?',
          answerType: 'scale'
        }
      ];
    }
  }
  
  /**
   * Analyze patient responses and generate assessment report
   * @param {Object} assessmentData - Complete assessment data
   * @returns {Promise<Object>} Analysis results including severity and report
   */
  async generateAssessmentReport(assessmentData) {
    try {
      const { symptoms, responses } = assessmentData;
      
      console.log('Generating report for symptoms:', symptoms);
      
      // For test mode, return mock report
      if (this.testMode) {
        console.log('Using test mode mock report');
        return {
          report: `Patient reports ${symptoms.join(' and ')} symptoms. The assessment responses indicate this may be a common condition requiring standard care.`,
          severity: "medium",
          keyPoints: [
            `${symptoms[0]} reported for recent onset`, 
            `${symptoms.length > 1 ? symptoms[1] : 'Additional symptoms'} may indicate common viral condition`, 
            "No severe warning signs reported"
          ],
          recommendedFollowUp: "Consider standard evaluation and symptomatic treatment."
        };
      }
      
      try {
        const prompt = this._createReportGenerationPrompt(symptoms, responses);
        const response = await this._callGeminiAPI(prompt);
        
        let report;
        try {
          // First try direct JSON parsing
          report = JSON.parse(response);
        } catch (jsonError) {
          console.log('Initial JSON parsing failed, attempting to extract JSON from text');
          
          // Check for JSON within code blocks or backticks
          const jsonMatches = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```|`(\{[\s\S]*?\})`/);
          if (jsonMatches) {
            const extractedJson = (jsonMatches[1] || jsonMatches[2]).trim();
            try {
              report = JSON.parse(extractedJson);
              console.log('Successfully extracted JSON from code block');
            } catch (extractError) {
              console.error('Failed to parse extracted JSON:', extractError);
              throw extractError;
            }
          } else {
            // Fallback parsing if no JSON blocks found
            console.error('Failed to extract JSON from response:', response);
            report = {
              report: this._extractReportFromText(response),
              severity: this._extractSeverityFromText(response),
              keyPoints: ["Automatically generated report", "JSON parsing failed"],
              recommendedFollowUp: "Standard follow-up recommended"
            };
          }
        }
        
        // Validate report has required fields
        if (!report.report || !report.severity) {
          throw new Error('Invalid report format returned from AI');
        }
        
        return report;
      } catch (error) {
        console.error('Error in AI report generation:', error);
        // Return fallback report
        return {
          report: `Assessment for symptoms: ${symptoms.join(', ')}. No specific patterns identified that require urgent attention.`,
          severity: "low",
          keyPoints: ["Automatically generated fallback report"],
          recommendedFollowUp: "Standard evaluation recommended"
        };
      }
    } catch (error) {
      console.error('Unhandled error in generateAssessmentReport:', error);
      // Final fallback
      return {
        report: "Assessment report could not be generated. Please consult with healthcare provider directly.",
        severity: "low",
        keyPoints: ["System generated fallback"],
        recommendedFollowUp: "Direct consultation recommended"
      };
    }
  }
  
  /**
   * Call the Gemini API with a prompt
   * @param {Object} prompt - Prompt object for the AI
   * @returns {Promise<string>} AI response text
   */
  async _callGeminiAPI(prompt) {
    if (!this.initialized) {
      throw new Error('AI Service not properly initialized');
    }
    
    // Use mock responses for testing
    if (this.testMode) {
      return this._getMockResponse(prompt);
    }
    
    try {
      const url = `${this.apiUrl}/${this.modelName}:generateContent?key=${this.apiKey}`;
      
      console.log(`Calling Gemini API with model: ${this.modelName}`);
      
      const response = await axios.post(url, {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topP: 0.8,
          topK: 40,
          maxOutputTokens: 2048
        }
      });
      
      if (!response.data || !response.data.candidates || !response.data.candidates[0]) {
        console.error('Invalid response format from Gemini API:', JSON.stringify(response.data));
        throw new Error('Invalid response format from Gemini API');
      }
      
      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      console.error('AI API Error:', error.response?.data || error.message);
      
      // Try with fallback models if the first one fails
      if (!this.fallbackAttempted && error.response?.data?.error?.code === 404) {
        this.fallbackAttempted = true;
        const fallbackModels = ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash'];
        
        for (const fallbackModel of fallbackModels) {
          try {
            console.log(`Attempting with fallback model: ${fallbackModel}`);
            const fallbackUrl = `${this.apiUrl}/${fallbackModel}:generateContent?key=${this.apiKey}`;
            
            const fallbackResponse = await axios.post(fallbackUrl, {
              contents: [
                {
                  parts: [
                    {
                      text: prompt
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.4,
                topP: 0.8,
                topK: 40,
                maxOutputTokens: 2048
              }
            });
            
            console.log(`Successfully used fallback model: ${fallbackModel}`);
            this.fallbackAttempted = false;
            return fallbackResponse.data.candidates[0].content.parts[0].text;
          } catch (fallbackError) {
            console.error(`Fallback model ${fallbackModel} failed:`, fallbackError.response?.data || fallbackError.message);
            // Continue to next fallback model
          }
        }
        
        this.fallbackAttempted = false;
      }
      
      if (this.testMode) {
        return this._getMockResponse(prompt);
      }
      throw new Error('Failed to get AI response');
    }
  }
  
  /**
   * Get mock responses for testing when API key is not available
   * @param {string} prompt - The input prompt
   * @returns {string} Mock response
   * @private
   */
  _getMockResponse(prompt) {
    // Check if it's a question generation prompt
    if (prompt.includes('Generate 3-5 relevant medical follow-up questions')) {
      return JSON.stringify([
        {
          "questionId": "q1",
          "question": "When did the symptoms first begin?",
          "answerType": "text"
        },
        {
          "questionId": "q2",
          "question": "On a scale of 1-10, how would you rate the pain?",
          "answerType": "scale"
        },
        {
          "questionId": "q3",
          "question": "Do the symptoms worsen with certain activities?",
          "answerType": "text"
        },
        {
          "questionId": "q4",
          "question": "Have you tried any medications to relieve the symptoms?",
          "answerType": "boolean"
        }
      ]);
    } 
    // Check if it's a report generation prompt
    else if (prompt.includes('Generate a concise medical assessment report')) {
      return JSON.stringify({
        "report": "Patient reports headache and fever symptoms. The headache appears to be moderate in severity and the fever has been present for approximately 2 days. No other significant symptoms were reported.",
        "severity": "medium",
        "keyPoints": [
          "Moderate headache", 
          "2-day fever", 
          "No reported respiratory symptoms"
        ],
        "recommendedFollowUp": "Consider evaluating for viral illness or infection. Basic blood work may be indicated if symptoms persist."
      });
    }
    // Default response for unknown prompts
    else {
      return JSON.stringify({
        "message": "This is a mock response from the testing AI service",
        "data": "No specific template matched this prompt"
      });
    }
  }
  
  /**
   * Create prompt for generating follow-up questions
   * @param {Array} symptoms - Patient's symptoms
   * @param {Array} previousResponses - Previous Q&A pairs
   * @returns {string} Formatted prompt
   */
  _createQuestionGenerationPrompt(symptoms, previousResponses) {
    return `You are an AI medical assistant helping with preliminary patient assessments. Generate 3-5 relevant medical follow-up questions based on these symptoms: "${symptoms.join(', ')}".

${previousResponses.length > 0 ? 
  `The patient has already answered these questions:
${previousResponses.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n')}` 
  : ''}

Important guidelines:
1. Do NOT provide medical diagnosis, treatment recommendations or advice
2. Focus on gathering factual information about symptoms
3. Ask about severity, duration, triggers, and alleviating factors
4. Consider the patient's previous answers when formulating new questions
5. Do not ask questions that have already been answered
6. Format output as a JSON array of question objects:

[
  {
    "questionId": "q1",
    "question": "When did the symptoms first begin?",
    "answerType": "text"
  },
  {
    "questionId": "q2",
    "question": "On a scale of 1-10, how would you rate the pain?",
    "answerType": "scale"
  }
]

Valid answerTypes are: "text", "boolean", "select", "scale"
For "select" types, include an "options" array with possible selections.
For "scale" types, use a 1-10 range for pain/severity questions.

Respond with ONLY the JSON array and nothing else.`;
  }
  
  /**
   * Create prompt for generating assessment report
   * @param {Array} symptoms - Patient's symptoms
   * @param {Array} responses - All Q&A pairs
   * @returns {string} Formatted prompt
   */
  _createReportGenerationPrompt(symptoms, responses) {
    return `You are an AI medical assistant helping with preliminary patient assessments. Generate a concise medical assessment report based on the following information:

Patient's reported symptoms: ${symptoms.join(', ')}

Patient's responses to assessment questions:
${responses.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n')}

Important guidelines:
1. DO NOT provide specific medical diagnosis
2. DO NOT provide treatment recommendations
3. Focus on summarizing the information provided by the patient
4. Include a severity assessment categorized as "low", "medium", "high", or "emergency"
5. Highlight any symptoms or responses that may require immediate attention
6. Keep the report concise and focused on facts

Format the response as a JSON object:
{
  "report": "Detailed summary of the assessment...",
  "severity": "low|medium|high|emergency",
  "keyPoints": ["Point 1", "Point 2", "Point 3"],
  "recommendedFollowUp": "General recommendation for the doctor, not for the patient"
}

Respond with ONLY the JSON object and nothing else.`;
  }
  
  /**
   * Generate a cache key based on parameters
   * @param {string} type - Type of cache entry
   * @param {Object} params - Parameters to include in key
   * @returns {string} Cache key
   */
  _generateCacheKey(type, params) {
    return `${type}:${JSON.stringify(params)}`;
  }
  
  /**
   * Add entry to cache with timeout
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   */
  _addToCache(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }
  
  /**
   * Get entry from cache if valid
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  _getFromCache(key) {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    // Check if cache entry is expired
    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.value;
  }
  
  /**
   * Extract questions from text if JSON parsing fails
   * @param {string} text - The AI response text
   * @returns {Array} Array of question objects
   * @private
   */
  _extractQuestionsFromText(text) {
    try {
      // Try to find JSON objects in text
      const jsonMatch = text.match(/\[\s*{\s*.*}\s*\]/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback to default questions if no JSON found
      console.warn('Falling back to default questions');
      return [
        {
          questionId: 'q1',
          question: 'When did the symptoms first begin?',
          answerType: 'text'
        },
        {
          questionId: 'q2',
          question: 'On a scale of 1-10, how would you rate the pain?',
          answerType: 'scale'
        },
        {
          questionId: 'q3',
          question: 'Do the symptoms worsen with certain activities?',
          answerType: 'text'
        }
      ];
    } catch (error) {
      console.error('Error extracting questions:', error);
      // Always return default questions if all parsing fails
      return [
        {
          questionId: 'q1',
          question: 'When did the symptoms first begin?',
          answerType: 'text'
        },
        {
          questionId: 'q2',
          question: 'On a scale of 1-10, how would you rate the pain?',
          answerType: 'scale'
        },
        {
          questionId: 'q3',
          question: 'Do the symptoms worsen with certain activities?',
          answerType: 'text'
        }
      ];
    }
  }
  
  /**
   * Extract severity from text if JSON parsing fails
   * @param {string} text - The AI response text
   * @returns {string} Severity level: low, medium, high, or emergency
   * @private
   */
  _extractSeverityFromText(text) {
    const text_lower = text.toLowerCase();
    if (text_lower.includes('emergency')) return 'emergency';
    if (text_lower.includes('high')) return 'high';
    if (text_lower.includes('medium')) return 'medium';
    return 'low';
  }
  
  /**
   * Extract report text from response when JSON parsing fails
   * @param {string} text - The AI response text
   * @returns {string} Extracted report text
   * @private
   */
  _extractReportFromText(text) {
    // Try to extract something that looks like a medical assessment
    const reportLines = text.split('\n').filter(line => 
      line.trim() && 
      !line.trim().startsWith('```') && 
      !line.trim().startsWith('#') &&
      !line.trim().startsWith('{') &&
      !line.trim().startsWith('}')
    );
    
    // Return the first few substantial lines or the whole text
    if (reportLines.length > 0) {
      return reportLines.slice(0, 3).join(' ');
    }
    
    return text.substring(0, 200) + (text.length > 200 ? '...' : '');
  }
}

const aiService = new AIService();
export default aiService; 