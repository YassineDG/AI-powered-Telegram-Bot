import TelegramBot from "node-telegram-bot-api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Replicate from "replicate";
import fetch from "node-fetch";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

// Load the environment variables
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;
const stabilityApiKey = process.env.STABILITY_API_KEY;
const engineId = "stable-diffusion-v1-6";
const apiHost = "https://api.stability.ai";
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Initialize the Telegram Bot
const bot = new TelegramBot(botToken, { polling: true });

// Setting up Google Generative AI for text generation
const genAI = new GoogleGenerativeAI(geminiApiKey);
const textModel = genAI.getGenerativeModel({ model: "gemini-pro" });

// Handler for '/start' command - sends a welcome message
bot.onText(/\/start/, (msg) => {
  const welcomeMessage = `
    Hello, I'm NourBot!
    Welcome to the bot. Here's what I can do:
    - Answer your questions with /ask
    - Generate images with /art
    Created by Yassine Dorgâa
  `;
  bot.sendMessage(msg.chat.id, welcomeMessage);
});

// Handler for '/ask' command - processes user queries
bot.onText(/\/ask (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1];
  const messageId = msg.message_id;  // Get the ID of the user's message to reply to it
  const processingMessage = await bot.sendMessage(
    chatId,
    "Processing your request, please wait..."
  );

  try {
    const result = await textModel.generateContent(query);
    const response = await result.response;
    const text = await response.text();
    console.log('Generated text:', text); // Log the generated text

    await bot.deleteMessage(chatId, processingMessage.message_id);
    // Send a message as a direct reply to the user's original message
    bot.sendMessage(chatId, text, { 
      parse_mode: "Markdown",
      reply_to_message_id: messageId  // Reply directly to the user's message
    });
  } catch (error) {
    console.error(error);
    // Reply to the user's original message even in the case of an error
    bot.editMessageText(
      "Sorry, an error occurred while processing your request.",
      {
        chat_id: chatId,
        message_id: processingMessage.message_id,
        parse_mode: "Markdown",
        reply_to_message_id: messageId  // Maintain the reply threading for consistency
      }
    );
  }
});



// Handler for Stability AI image generation ('/img' command)
bot.onText(/\/img (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];
  const processingMessage = await bot.sendMessage(
    chatId,
    "Generating image, please wait..."
  );

  try {
    const response = await fetch(
      `${apiHost}/v1/generation/${engineId}/text-to-image`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${stabilityApiKey}`,
        },
        body: JSON.stringify({
          text_prompts: [{ text: prompt }],
          cfg_scale: 8,
          height: 1024,
          width: 1024,
          steps: 50,
          samples: 1,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Non-200 response: ${await response.text()}`);
    }

    const responseJSON = await response.json();
    console.log('responseJSON:', responseJSON); // Log the response JSON
    responseJSON.artifacts.forEach((image, index) => {
      const buffer = Buffer.from(image.base64, "base64");
      const filePath = `./temp_image_${index}.png`;
      fs.writeFileSync(filePath, buffer);

      bot.sendPhoto(chatId, fs.createReadStream(filePath)).then(() => {
        fs.unlinkSync(filePath);
        bot.deleteMessage(chatId, processingMessage.message_id);
      });
    });
  } catch (error) {
    console.error(error);
    bot.editMessageText(
      "Sorry, an error occurred while generating the image.",
      {
        chat_id: chatId,
        message_id: processingMessage.message_id,
      }
    );
  }
});

// Handler for Replicate AI image generation ('/art' command)
bot.onText(/\/art (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = match[1];
  const messageId = msg.message_id; // Get the ID of the user's message to reply to it
  const username = msg.from.username; // Get the username of the user who sent the message
  const processingMessage = await bot.sendMessage(
    chatId,
    "Generating image, please wait..."
  );

  try {
    const output = await replicate.run(
      "playgroundai/playground-v2-1024px-aesthetic:42fe626e41cc811eaf02c94b892774839268ce1994ea778eba97103fe1ef51b8",
      {
        input: {
          width: 1024,
          height: 1024,
          prompt: prompt,
          scheduler: "K_EULER_ANCESTRAL",
          guidance_scale: 3,
          apply_watermark: false,
          negative_prompt: "BadDream, badhandv4, BadNegAnatomyV1-neg, easynegative, FastNegativeV2, bad anatomy, extra people, ...[truncated for brevity]..., signature",
          num_inference_steps: 50,
          disable_safety_check: true,
        },
      }
    );
    console.log('output:', output); // Log output
    // Delete the "Generating image" message
    await bot.deleteMessage(chatId, processingMessage.message_id);
    // Send the generated image URL to the chat as a reply to the original message with a custom caption
    await bot.sendPhoto(chatId, output[0], {
      caption: `✅ AI Art\n\nGenerated by @${username}\nPrompt❤️: <code>${prompt}.</code>`,
      reply_to_message_id: messageId,
      parse_mode: 'HTML' // Set the parse mode to HTML
    });
  } catch (error) {
    console.error('Error:', error);
    // If an error occurs, edit the processing message to inform the user
    await bot.editMessageText(
      "Sorry, an error occurred while generating the image.",
      {
        chat_id: chatId,
        message_id: processingMessage.message_id,
      }
    );
  }
});



// Handler for Mistral AI response generation ('/tell' command)
bot.onText(/\/tell (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userQuery = match[1].trim();
  const messageId = msg.message_id;  // Get the ID of the user's message to reply to it

  try {
    const output = await replicate.run(
      "mistralai/mixtral-8x7b-instruct-v0.1:7b3212fbaf88310cfef07a061ce94224e82efc8403c26fc67e8f6c065de51f21",
      {
        input: {
          top_k: 50,
          top_p: 0.9,
          prompt: userQuery,
          temperature: 0.6,
          max_new_tokens: 1024,
          prompt_template: "<s>[INST] {prompt} [/INST]",
          presence_penalty: 0,
          frequency_penalty: 0,
          disable_safety_check: true
        }
      }
    );

    // Format the output
    let responseText = Array.isArray(output) ? output.join('') : "No response";
    console.log('responseText:', responseText); // Log the response text

    // Send a message as a direct reply to the user's original message
    bot.sendMessage(chatId, `\n\n${responseText}`, { 
      parse_mode: "Markdown",
      reply_to_message_id: messageId 
    });
  } catch (error) {
    console.error('Error:', error);
    // Reply to the user's original message even in the case of an error
    bot.sendMessage(chatId, 'Sorry, an error occurred while processing your request.', { 
      parse_mode: "Markdown",
      reply_to_message_id: messageId 
    });
  }
});


// Placeholder for additional features
