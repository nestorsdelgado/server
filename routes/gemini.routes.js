const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');

// Configuración de variables de entorno
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent';

// Crear instancia de Google Generative AI con configuración de seguridad
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
    safetySettings: [
        {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
    ],
});

// Base de conocimiento específica para el contexto del Fantasy LEC
const FANTASY_LEC_CONTEXT = `
Eres un asistente especializado en League of Legends Fantasy para la LEC (League of Legends European Championship).
Tu propósito es ayudar a los usuarios con:
- Estrategias para armar equipos competitivos
- Información sobre jugadores profesionales de la LEC y sus estadísticas
- Consejos sobre cuándo comprar, vender o intercambiar jugadores
- Explicaciones sobre el sistema de puntuación
- Tendencias y predicciones basadas en el rendimiento histórico

No proporciones consejos sobre:
- Cómo hackear o explotar el sistema de Fantasy LEC
- Cómo obtener ventajas injustas sobre otros jugadores
- Información personal sobre jugadores profesionales fuera del ámbito del juego

Mantén tus respuestas enfocadas en el Fantasy LEC y evita desviarte a temas no relacionados con esports o League of Legends.
`;

// Lista de palabras prohibidas para filtrado básico
const PROHIBITED_WORDS = [
    'hack', 'exploit', 'cheat', 'bug', 'glitch', 'vulnerabilidad', 'bypass',
    'contraseña', 'password', 'credit card', 'tarjeta', 'address', 'dirección',
    'vulnerar', 'romper', 'ilegal', 'droga', 'drogas', 'suicide', 'suicidio'
];

// Configuración de Rate Limiter mejorado: niveles por usuario
const standardLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 10, // Límite de 10 solicitudes por ventana
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas solicitudes, por favor intenta de nuevo más tarde.' },
    keyGenerator: (req) => req.user.id, // Usar el ID del usuario para limitar
    skipSuccessfulRequests: false, // Contar todas las solicitudes, no solo las exitosas
});

// Limiter más estricto para cuando se detectan muchas solicitudes
const strictLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 15, // Límite de 15 solicitudes en 5 minutos
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Has excedido el límite de solicitudes. Por favor espera unos minutos antes de intentar nuevamente.' },
    keyGenerator: (req) => req.user.id,
});

// Middleware para verificar que la API key está configurada
const checkApiKey = (req, res, next) => {
    if (!GEMINI_API_KEY) {
        return res.status(500).json({
            message: 'La API de Gemini no está configurada en el servidor'
        });
    }
    next();
};

// Validación avanzada de datos de entrada
const validateChatInput = (req, res, next) => {
    const { prompt, conversation } = req.body;

    // Validación del prompt
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({
            message: 'Se requiere un prompt de texto válido'
        });
    }

    if (prompt.length > 1000) {
        return res.status(400).json({
            message: 'El prompt excede el límite de 1000 caracteres'
        });
    }

    if (prompt.trim().length === 0) {
        return res.status(400).json({
            message: 'El prompt no puede estar vacío'
        });
    }

    // Comprobar palabras prohibidas
    const promptLower = prompt.toLowerCase();
    for (const word of PROHIBITED_WORDS) {
        if (promptLower.includes(word)) {
            // Registrar intento para análisis (opcional)
            logPotentialAbuse(req.user.id, prompt, word);
            
            return res.status(400).json({
                message: 'Tu consulta contiene términos no permitidos. Por favor, reformula tu pregunta.'
            });
        }
    }

    // Validar la estructura de la conversación
    if (conversation && !Array.isArray(conversation)) {
        return res.status(400).json({
            message: 'El historial de conversación debe ser un array'
        });
    }

    // Limitar longitud del historial para evitar tokens excesivos
    if (conversation && conversation.length > 20) {
        req.body.conversation = conversation.slice(-20); // Mantener solo los últimos 20 mensajes
    }

    next();
};

// Endpoint para chatear con Gemini
// La ruta completa será /gemini/chat
router.post('/chat', [
    auth, 
    standardLimiter, 
    checkApiKey, 
    validateChatInput
], async (req, res) => {
    const { prompt, conversation = [] } = req.body;
    const userId = req.user.id;

    try {
        // Formato de la conversación para Gemini
        const formattedMessages = conversation.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        // Añadir contexto específico de Fantasy LEC
        let contextualPrompt = FANTASY_LEC_CONTEXT;
        
        // Añadir nuevo mensaje del usuario
        formattedMessages.push({
            role: 'user',
            parts: [{
                text: `${contextualPrompt}
                
                ${prompt}`
            }]
        });

        // Iniciar el seguimiento del tiempo de respuesta
        const startTime = Date.now();

        try {
            // Utilizar la biblioteca cliente de Google Generative AI
            const result = await model.generateContent({
                contents: formattedMessages,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                }
            });

            const geminiResponse = result.response.text();
            const responseTime = Date.now() - startTime;

            // Registrar estadísticas de uso para análisis (opcional)
            logSuccessfulRequest(userId, prompt.length, responseTime);

            // Actualizar el estado de rate limiting si el usuario hace muchas solicitudes rápidas
            const userRequestCount = await getUserRequestCount(userId);
            if (userRequestCount > 20) { // Si el usuario ha hecho más de 20 solicitudes en poco tiempo
                switchToStrictRateLimit(userId);
            }

            return res.json({ 
                response: geminiResponse,
                metadata: {
                    responseTime: `${responseTime}ms`,
                    messageTokens: formattedMessages.length,
                }
            });
        } catch (genAIError) {
            console.error('Error al generar contenido con GenAI:', genAIError);
            
            // Manejar errores específicos de la biblioteca GenAI
            if (genAIError.message.includes('safety')) {
                return res.status(400).json({
                    message: 'Tu consulta no cumple con nuestras políticas de uso seguro. Por favor reformula tu pregunta.',
                    details: 'La consulta podría contener contenido inapropiado o sensible.'
                });
            }
            
            // Alternativa: intentar con la API REST directa si falla la biblioteca
            const response = await axios.post(
                `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
                {
                    contents: formattedMessages,
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 1024,
                    }
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000 // 15 segundos de timeout
                }
            );

            // Extraer la respuesta
            if (response.data.candidates && response.data.candidates[0] && response.data.candidates[0].content) {
                const geminiResponse = response.data.candidates[0].content.parts[0].text;
                const responseTime = Date.now() - startTime;

                // Registrar estadísticas de uso para análisis (opcional)
                logSuccessfulRequest(userId, prompt.length, responseTime);

                return res.json({ 
                    response: geminiResponse,
                    metadata: {
                        responseTime: `${responseTime}ms`,
                        messageTokens: formattedMessages.length,
                        fallbackMethod: 'rest-api'
                    }
                });
            } else {
                throw new Error('La API de Gemini no proporcionó una respuesta válida');
            }
        }
    } catch (error) {
        console.error('Error al comunicarse con la API de Gemini:', error);

        // Registrar error para análisis
        logFailedRequest(userId, prompt, error.message || 'Unknown error');

        // Manejar diferentes tipos de errores
        if (error.response) {
            // La API respondió con un código de error
            if (error.response.status === 400) {
                return res.status(400).json({
                    message: 'Solicitud inválida a la API de Gemini. Verifica tu entrada.'
                });
            } else if (error.response.status === 429) {
                return res.status(429).json({
                    message: 'Se ha alcanzado el límite de solicitudes a la API de Gemini.'
                });
            } else {
                return res.status(500).json({
                    message: 'Error en la API de Gemini: ' + (error.response.data.error?.message || 'Error desconocido')
                });
            }
        } else if (error.request) {
            // La solicitud se realizó pero no se recibió respuesta
            return res.status(504).json({
                message: 'Tiempo de espera agotado al conectar con la API de Gemini.'
            });
        } else {
            // Error al configurar la solicitud
            return res.status(500).json({
                message: 'Error del servidor al procesar la solicitud: ' + error.message
            });
        }
    }
});

// Funciones auxiliares para análisis y monitoreo

// Registrar solicitudes exitosas
async function logSuccessfulRequest(userId, promptLength, responseTime) {
    try {
        // Aquí podrías guardar en base de datos o enviar telemetría
        console.log(`[Gemini] Success - User: ${userId}, PromptLen: ${promptLength}, Time: ${responseTime}ms`);
        
        // Para implementación futura: actualizar contadores en Redis/Mongo/memoria
    } catch (error) {
        console.error('Error al registrar solicitud exitosa:', error);
    }
}

// Registrar solicitudes fallidas
async function logFailedRequest(userId, prompt, errorMessage) {
    try {
        // Aquí podrías guardar en base de datos o enviar telemetría
        console.error(`[Gemini] Error - User: ${userId}, Error: ${errorMessage.substring(0, 100)}`);
        
        // Para implementación futura: actualizar contadores en Redis/Mongo/memoria
    } catch (error) {
        console.error('Error al registrar solicitud fallida:', error);
    }
}

// Registrar posibles abusos para revisión
async function logPotentialAbuse(userId, prompt, flaggedWord) {
    try {
        // Aquí podrías guardar en base de datos para revisión manual
        console.warn(`[Gemini] Abuse Warning - User: ${userId}, FlaggedWord: "${flaggedWord}"`);
        
        // Para implementación futura: incrementar contador de abusos y potencialmente
        // aplicar restricciones adicionales a usuarios que abusan del sistema
    } catch (error) {
        console.error('Error al registrar potencial abuso:', error);
    }
}

// Obtener conteo de solicitudes del usuario (implementación simulada)
async function getUserRequestCount(userId) {
    // Aquí implementarías la lógica para obtener las solicitudes recientes del usuario
    // desde una base de datos como Redis o MongoDB
    
    // Por ahora, implementación simulada
    return Math.floor(Math.random() * 30); // 0-29 solicitudes
}

// Cambiar a límite de tasa estricto para un usuario específico
async function switchToStrictRateLimit(userId) {
    // Aquí implementarías la lógica para marcar a este usuario para usar
    // el limitador estricto en lugar del estándar
    
    console.log(`[Gemini] Applied strict rate limit to user ${userId}`);
    // Esta función requeriría una implementación personalizada de rate-limiting
    // con soporte para perfiles por usuario, potencialmente usando Redis
}

module.exports = router;