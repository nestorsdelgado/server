const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// Configuración de variables de entorno
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent';

// Configuración del Rate Limiter: 10 solicitudes por minuto por usuario
const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 10, // Limite de 10 solicitudes por ventana
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Demasiadas solicitudes, por favor intenta de nuevo más tarde.' },
    keyGenerator: (req) => req.user.id // Usar el ID del usuario para limitar
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

// Validación de datos de entrada
const validateChatInput = (req, res, next) => {
    const { prompt } = req.body;

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

    next();
};

// Endpoint para chatear con Gemini
// La ruta completa será /api/gemini/chat
router.post('/chat', [auth, apiLimiter, checkApiKey, validateChatInput], async (req, res) => {
    const { prompt, conversation = [] } = req.body;

    try {
        // Formato de la conversación para Gemini
        const formattedMessages = conversation.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        // Añadir nuevo mensaje del usuario
        formattedMessages.push({
            role: 'user',
            parts: [{
                text: `Eres un asistente especializado en League of Legends Fantasy para la LEC. 
               Proporciona respuestas breves y útiles sobre estrategias, equipos, jugadores, 
               y cómo jugar mejor. Contextualiza la respuesta al fantasy league y no al juego LoL directamente.
               
               ${prompt}`
            }]
        });

        // Hacer solicitud a la API de Gemini
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
                timeout: 10000 // 10 segundos de timeout
            }
        );

        // Extraer la respuesta
        if (response.data.candidates && response.data.candidates[0] && response.data.candidates[0].content) {
            const geminiResponse = response.data.candidates[0].content.parts[0].text;

            // Registrar la interacción para análisis (opcional)
            logInteraction(req.user.id, prompt, geminiResponse);

            return res.json({ response: geminiResponse });
        } else {
            return res.status(500).json({
                message: 'La API de Gemini no proporcionó una respuesta válida'
            });
        }
    } catch (error) {
        console.error('Error al comunicarse con la API de Gemini:', error);

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
                message: 'Error del servidor al procesar la solicitud.'
            });
        }
    }
});

// Función para registrar interacciones (para análisis)
function logInteraction(userId, prompt, response) {
    try {
        // Aquí podrías guardar en base de datos, enviar a un servicio de analytics, etc.
        console.log(`[Gemini Chat] User: ${userId}, Prompt: "${prompt.substring(0, 50)}..."`);
    } catch (error) {
        console.error('Error al registrar interacción con Gemini:', error);
    }
}

module.exports = router;