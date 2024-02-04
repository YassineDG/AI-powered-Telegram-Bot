import TelegramBot from "node-telegram-bot-api";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Replicate from "replicate";
import fetch from "node-fetch";
import fs from "fs";
import dotenv from "dotenv";
import { CohereClient } from "cohere-ai";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

// Load the environment variables
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;
const stabilityApiKey = process.env.STABILITY_API_KEY;
const engineId = "stable-diffusion-v1-6";
const apiHost = "https://api.stability.ai";
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});
const openWeatherApiKey = process.env.OPENWEATHER_API_KEY;
const azureTranslatorKey = process.env.AZURE_TRANSLATOR_KEY;
const azureTranslatorLocation = process.env.AZURE_TRANSLATOR_LOCATION;
const abstractApiKey = process.env.ABSTRACT_API_KEY;
const mistralApiKey = process.env.MISTRAL_API_KEY;

// Initialize the Telegram Bot
const bot = new TelegramBot(botToken, { polling: true });

// Setting up Google Generative AI for text generation
const genAI = new GoogleGenerativeAI(geminiApiKey);
const textModel = genAI.getGenerativeModel({ model: "gemini-pro" });

// Ensure you have the correct Mistral API endpoint and your API key
const mistralEndpoint = "https://api.mistral.ai/v1/chat/completions"; // Use the actual endpoint provided by Mistral

// Store conversation histories
const conversationHistories = {};

// Handler for '/start' command - sends a welcome message
bot.onText(/\/start/, (msg) => {
  const welcomeMessage = `
🚀 *Welcome to the Extraordinary NourBot Universe!* 🚀

Embark on a journey with AI at your side, ready to explore, create, and solve mysteries:

🔍 *Inquiry & Intellect*
- \`/ai [your query]\` - Unearth deep insights and real-time web wisdom.
- \`/chat [your musings]\` - A chat companion for every curiosity.
- \`/mistery [dive deeper]\` - For questions that tickle your brain, let's uncover secrets together.

🖌️ *Creativity Unleashed*
- \`/art [imagine anything]\` - Artistic creations from your thoughts.
- \`/img [picture this]\` - Visualizing dreams into digital reality.
- \`/describe\` - Reply to a photo for its untold saga.
- \`/real [ultra-vivid]\` - Crafting hyper-realistic scenes.
- \`/focus [crystal clarity]\` - For when details make the difference.

🌍 *Worldly Wisdom*
- \`/trs [lang] [text]\` - Reply to a message for instant language translation.
- \`/time [any place]\` - Global time, anytime.
- \`/weath [location]\` - Weather forecasts, rain or shine.

📖 *Tales & Tell-alls*
- \`/tell [spin a story]\` - AI-crafted tales from your prompts.

Adventure awaits with every command! Let’s make each day more interesting. Ready to explore?

*Your journey begins now...* 🌌

Crafted with 💡 by @YassineDG
`;

  bot.sendMessage(msg.chat.id, welcomeMessage, { parse_mode: "Markdown" });
});

// Handler for '/time' command
bot.onText(/\/time (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userInputLocation = match[1]; // The user's input after the /time command
  const messageId = msg.message_id; // Get the ID of the user's message to reply to it

  try {
    const url = `https://timezone.abstractapi.com/v1/current_time/?api_key=${abstractApiKey}&location=${encodeURIComponent(
      userInputLocation
    )}`;
    const response = await fetch(url);
    const data = await response.json();

    // Check if the response is OK
    if (response.ok) {
      const dateTime = new Date(data.datetime);
      const formattedDate = `*${dateTime.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })}*`;
      const formattedTime = `*${dateTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}*`;
      const timeZoneName = data.timezone_name;
      const preciseLocation = data.timezone_location; // More precise location from the API
      const gmtOffset = data.gmt_offset;
      const isDst = data.is_dst ? "Yes" : "No";

      // Forming the reply message with detailed location
      const replyMessage = `⏰ Current time in *${preciseLocation}*\n📅 Date: ${formattedDate}\n⏰ Time: ${formattedTime}\n🌐 Time Zone: ${timeZoneName}\n⏳ GMT Offset: ${gmtOffset}\n🕰️ Daylight Saving Time: ${isDst}`;

      // Using reply_to_message_id to make the bot's message a reply
      bot.sendMessage(chatId, replyMessage, {
        parse_mode: "Markdown",
        reply_to_message_id: messageId,
      });
    } else {
      throw new Error(data.message); // Use the error message from the response, if any
    }
  } catch (error) {
    console.error(error);
    bot.sendMessage(
      chatId,
      "Sorry, I couldn't fetch the time for that location.",
      { reply_to_message_id: messageId }
    );
  }
});

// Handler for '/translate' command - translates user queries

// Function to translate text
const translateText = async (text, targetLang) => {
  const endpoint = "https://api.cognitive.microsofttranslator.com";
  const url = `${endpoint}/translate?api-version=3.0&to=${targetLang}`;

  const headers = {
    "Ocp-Apim-Subscription-Key": azureTranslatorKey,
    "Ocp-Apim-Subscription-Region": azureTranslatorLocation,
    "Content-type": "application/json",
    "X-ClientTraceId": uuidv4().toString(),
  };

  const body = JSON.stringify([{ text: text }]);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: body,
    });

    const data = await response.json();
    return data[0].translations[0].text;
  } catch (error) {
    console.error("Error translating text:", error);
    throw error;
  }
};

// Function to detect the language of the text
const detectLanguage = async (text) => {
  const endpoint = "https://api.cognitive.microsofttranslator.com";
  const url = `${endpoint}/detect?api-version=3.0`;

  const headers = {
    "Ocp-Apim-Subscription-Key": azureTranslatorKey,
    "Ocp-Apim-Subscription-Region": azureTranslatorLocation,
    "Content-type": "application/json",
    "X-ClientTraceId": uuidv4().toString(),
  };

  const body = JSON.stringify([{ text: text }]);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: body,
    });

    const data = await response.json();
    return data[0].language; // Returns the detected language
  } catch (error) {
    console.error("Error detecting language:", error);
    throw error;
  }
};

// Handler for '/tr' command
bot.onText(/\/trs (\w{2})/, async (msg, match) => {
  const chatId = msg.chat.id;
  const targetLang = match[1]; // Get the target language code from the command
  const replyToMessage = msg.reply_to_message;

  if (!replyToMessage) {
    bot.sendMessage(chatId, "Please reply to a message you want to translate.");
    return;
  }

  const originalText = replyToMessage.text;
  if (!originalText) {
    bot.sendMessage(
      chatId,
      "The message to translate is empty or not a text message."
    );
    return;
  }

  try {
    const detectedLanguage = await detectLanguage(originalText);
    const translatedText = await translateText(originalText, targetLang);
    const formattedResponse = `ᴛʀᴀɴꜱʟᴀᴛᴇᴅ ᴛᴇxᴛ\n\n${translatedText}\n\nᴛʀᴀɴꜱʟᴀᴛᴇᴅ ꜰʀᴏᴍ ${detectedLanguage.toUpperCase()}`;
    bot.sendMessage(chatId, formattedResponse, {
      reply_to_message_id: msg.message_id,
    });
  } catch (error) {
    bot.sendMessage(
      chatId,
      "Sorry, an error occurred while translating the message."
    );
  }
});

//Weather
// Mapping of OpenWeather condition codes to custom descriptions and emojis
const weatherConditions = {
  200: { description: "Thunderstorm with light rain", emoji: "⛈️" },
  201: { description: "Thunderstorm with rain", emoji: "⛈️" },
  202: { description: "Thunderstorm with heavy rain", emoji: "⛈️" },
  210: { description: "Light thunderstorm", emoji: "🌩️" },
  211: { description: "Thunderstorm", emoji: "🌩️" },
  212: { description: "Heavy thunderstorm", emoji: "🌩️" },
  221: { description: "Ragged thunderstorm", emoji: "🌩️" },
  230: { description: "Thunderstorm with light drizzle", emoji: "⛈️" },
  231: { description: "Thunderstorm with drizzle", emoji: "⛈️" },
  232: { description: "Thunderstorm with heavy drizzle", emoji: "⛈️" },
  300: { description: "Light intensity drizzle", emoji: "🌦️" },
  301: { description: "Drizzle", emoji: "🌦️" },
  302: { description: "Heavy intensity drizzle", emoji: "🌦️" },
  // ... Add more conditions as needed
  800: { description: "Clear sky", emoji: "☀️" },
  801: { description: "Few clouds", emoji: "🌤️" },
  802: { description: "Scattered clouds", emoji: "⛅️" },
  803: { description: "Broken clouds", emoji: "🌥️" },
  804: { description: "Overcast clouds", emoji: "☁️" },
};
// Handler for '/weather' command
bot.onText(/\/weath (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const location = match[1]; // Get the location from the user's message
  const messageId = msg.message_id;

  // Step 1: Get the latitude and longitude from the location name
  const geocodeUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${location}&limit=1&appid=${openWeatherApiKey}`;

  try {
    const geoResponse = await fetch(geocodeUrl);
    const geoData = await geoResponse.json();
    if (geoData.length === 0) {
      bot.sendMessage(chatId, "Location not found.");
      return;
    }

    const lat = geoData[0].lat;
    const lon = geoData[0].lon;

    // Step 2: Use the latitude and longitude to get the weather data
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${openWeatherApiKey}&units=metric&lang=fr`;

    const processingMessage = await bot.sendMessage(
      chatId,
      "Fetching weather data, please wait..."
    );
    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json(); // Use weatherData here

    if (weatherData && weatherData.weather && weatherData.weather.length > 0) {
      const temperature = weatherData.main.temp;
      const conditionCode = weatherData.weather[0].id; // Weather condition code
      const weatherDescription = weatherData.weather[0].description; // Weather condition text
      const humidity = weatherData.main.humidity;
      const feelsLike = weatherData.main.feels_like;
      const weatherInfo = weatherConditions[conditionCode.toString()] || {
        description: "Unknown",
        emoji: "❓",
      };
      const username = msg.from.username
        ? `@${msg.from.username}`
        : msg.from.first_name; // Extract username or first name

      const weatherMessage =
        `✅ 𝗪𝗲𝗮𝘁𝗵𝗲𝗿 𝗥𝗲𝗽𝗼𝗿𝘁\n\n` +
        `𝗖𝗼𝘂𝗻𝘁𝗿𝘆: ${weatherData.sys.country}\n` +
        `𝗡𝗮𝗺𝗲 (𝗖𝗶𝘁𝘆): ${weatherData.name}\n` +
        `𝗪𝗲𝗮𝘁𝗵𝗲𝗿: ${weatherInfo.description} ${weatherInfo.emoji}\n` +
        `𝗗𝗲𝘀𝗰𝗿𝗶𝗽𝘁𝗶𝗼𝗻: ${weatherDescription}\n` +
        `𝗧𝗲𝗺𝗽𝗲𝗿𝗮𝘁𝘂𝗿𝗲: ${temperature}°C\n` +
        `𝗛𝘂𝗺𝗶𝗱𝗶𝘁𝘆: ${humidity}%\n` +
        `𝗙𝗲𝗲𝗹𝘀 𝗟𝗶𝗸𝗲: ${feelsLike}°C\n\n` +
        `𝗖𝗵𝗲𝗰𝗸𝗲𝗱 𝗯𝘆 ${username}`;
      await bot.deleteMessage(chatId, processingMessage.message_id);
      bot.sendMessage(chatId, weatherMessage, {
        reply_to_message_id: messageId,
      });
    } else {
      await bot.deleteMessage(chatId, processingMessage.message_id);
      bot.sendMessage(chatId, "Weather data not available.", {
        reply_to_message_id: messageId,
      });
    }
  } catch (error) {
    console.error("Error fetching weather data:", error);
    bot.sendMessage(
      chatId,
      "Sorry, an error occurred while fetching weather data."
    );
  }
});

//////////////////////////Co-here//////////////////////////////

bot.onText(/\/ai (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userQuery = match[1];
  const messageId = msg.message_id; // Get the ID of the user's message to reply to it
  const processingMessage = await bot.sendMessage(
    chatId,
    "Processing your request, please wait..."
  );

  try {
    // Make a call to Cohere's chat API
    const response = await cohere.chat({
      message: userQuery,
      max_tokens: 1024,
      temperature: 1,
      connectors: [{ id: "web-search" }], // Assuming "web-search" is correctly identified and available
    });
    console.log("Cohere response:", response); // Log the response from Cohere

    // Assuming the response structure includes a 'text' field directly
    // Note: You might need to adjust this line based on Cohere's actual response structure
    const botResponse =
      response.text || "Sorry, I couldn't get the information.";

    await bot.deleteMessage(chatId, processingMessage.message_id);
    // Reply directly to the user's message that triggered the command
    bot.sendMessage(chatId, botResponse, {
      parse_mode: "Markdown",
      reply_to_message_id: messageId,
    });
  } catch (error) {
    console.error("Error with Cohere API:", error);
    // If an error occurs, inform the user
    bot.editMessageText(
      "Sorry, an error occurred while processing your request.",
      {
        chat_id: chatId,
        message_id: processingMessage.message_id,
        parse_mode: "Markdown",
        reply_to_message_id: messageId,
      }
    );
  }
});

// Handler for '/ask' command - processes user queries
bot.onText(/\/chat (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userQuery = match[1];
  const messageId = msg.message_id;

  // Initialize or update the conversation history
  if (!conversationHistories[chatId]) {
    conversationHistories[chatId] = [];
  }

  // Consider a limit for stored messages to maintain context without overflow
  const contextLimit = 20; // Example: Only keep the last 5 messages
  const conversationContext = conversationHistories[chatId]
    .slice(-contextLimit)
    .join(" ");
  const prompt = conversationContext + " " + userQuery; // Combine context with the new user query

  try {
    // Generate response considering the entire conversation context
    const result = await textModel.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();

    // Update conversation history
    conversationHistories[chatId].push(userQuery); // Add user query to history
    conversationHistories[chatId].push(text); // Add bot response to history
    if (conversationHistories[chatId].length > contextLimit * 2) {
      // Double the limit to account for both questions and answers
      conversationHistories[chatId] = conversationHistories[chatId].slice(
        -contextLimit * 2
      );
    }

    // Respond to the user
    bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_to_message_id: messageId,
    });
  } catch (error) {
    console.error("Error processing /ask command:", error);
    bot.sendMessage(
      chatId,
      "Sorry, an error occurred while processing your request.",
      {
        parse_mode: "Markdown",
        reply_to_message_id: messageId,
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
    console.log("responseJSON:", responseJSON); // Log the response JSON
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
  const prompt = encodeURIComponent(match[1]);
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
          negative_prompt:
            "BadDream, badhandv4, BadNegAnatomyV1-neg, easynegative, FastNegativeV2, bad anatomy, extra people, ...[truncated for brevity]..., signature",
          num_inference_steps: 50,
          disable_safety_check: true,
          safety_checker: false,
        },
      }
    );
    console.log("output:", output); // Log output

    // Define the download button here after the output is received
    const downloadButton = {
      text: "Original Image",
      url: output[0], // URL of the image
    };

    // Delete the "Generating image" message
    await bot.deleteMessage(chatId, processingMessage.message_id);
    // Send the generated image URL to the chat as a reply to the original message with a custom caption
    await bot.sendPhoto(chatId, output[0], {
      caption: `𝗜𝗺𝗮𝗴𝗲 𝗚𝗲𝗻𝗲𝗿𝗮𝘁𝗲𝗱 𝘀𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆 ✅\n\nGenerated by @${username}\n`,
      reply_markup: {
        inline_keyboard: [[downloadButton]],
      },
      reply_to_message_id: messageId,
      parse_mode: "HTML", // Set the parse mode to HTML
    });
  } catch (error) {
    console.error("Error:", error);
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

bot.onText(/\/focus (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = encodeURIComponent(match[1]);
  const messageId = msg.message_id; // Get the ID of the user's message to reply to it
  const username = msg.from.username; // Get the username of the user who sent the message
  const processingMessage = await bot.sendMessage(
    chatId,
    "Generating image, please wait..."
  );

  try {
    const output = await replicate.run(
      "konieshadow/fooocus-api:fda927242b1db6affa1ece4f54c37f19b964666bf23b0d06ae2439067cd344a4",
      {
        input: {
          prompt: prompt,
          cn_type1: "ImagePrompt",
          cn_type2: "ImagePrompt",
          cn_type3: "ImagePrompt",
          cn_type4: "ImagePrompt",
          sharpness: 2,
          image_seed: 50403806253646856,
          uov_method: "Disabled",
          image_number: 1,
          guidance_scale: 4,
          refiner_switch: 0.5,
          negative_prompt: "",
          style_selections: "Fooocus V2,Fooocus Enhance,Fooocus Sharp",
          uov_upscale_value: 0,
          outpaint_selections: "",
          outpaint_distance_top: 0,
          performance_selection: "Speed",
          outpaint_distance_left: 0,
          aspect_ratios_selection: "1152*896",
          outpaint_distance_right: 0,
          outpaint_distance_bottom: 0,
          inpaint_additional_prompt: "",
          disable_safety_check: true,
          safety_checker: false,
        },
      }
    );
    console.log("output:", output); // Log output

    // Define the download button here after the output is received
    const downloadButton = {
      text: "Original Image",
      url: output[0], // URL of the image
    };
    // Delete the "Generating image" message
    await bot.deleteMessage(chatId, processingMessage.message_id);
    // Send the generated image URL to the chat as a reply to the original message with a custom caption
    await bot.sendPhoto(chatId, output[0], {
      caption: `𝗜𝗺𝗮𝗴𝗲 𝗚𝗲𝗻𝗲𝗿𝗮𝘁𝗲𝗱 𝘀𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆 ✅\n\nGenerated by @${username}\n`,
      reply_markup: {
        inline_keyboard: [[downloadButton]],
      },
      reply_to_message_id: messageId,
      parse_mode: "HTML", // Set the parse mode to HTML
    });
  } catch (error) {
    console.error("Error:", error);
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

bot.onText(/\/real (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const prompt = encodeURIComponent(match[1]);
  const messageId = msg.message_id; // Get the ID of the user's message to reply to it
  const username = msg.from.username; // Get the username of the user who sent the message
  const processingMessage = await bot.sendMessage(
    chatId,
    "Generating image, please wait..."
  );

  try {
    const output = await replicate.run(
      "lucataco/nebul.redmond:1abd2490609ffab31652791c065fa2da180053b77fe0ed0e7e879460bf549d33",
      {
        input: {
          width: 1024,
          height: 1024,
          prompt: prompt,
          scheduler: "K_EULER",
          num_outputs: 1,
          guidance_scale: 7.5,
          apply_watermark: true,
          negative_prompt:
            "long torso, tall, bad quality, worst quality, normal quality, elderly, old, granny, 3d, sfm, text, watermark, low-quality, signature, moiré pattern, downsampling, distorted, blurry, glossy, blur, jpeg artifacts, compression artifacts, poorly drawn, low-resolution, bad, distortion, twisted, excessive, exaggerated pose, exaggerated limbs, grainy, symmetrical, duplicate, error, pattern, beginner, pixelated, fake, hyper, glitch, overexposed, high-contrast, bad-contrast",
          num_inference_steps: 40,
          disable_safety_check: true,
          safety_checker: false,
        },
      }
    );
    console.log("output:", output); // Log output

    // Define the download button here after the output is received
    const downloadButton = {
      text: "Original Image",
      url: output[0], // URL of the image
    };
    // Delete the "Generating image" message
    await bot.deleteMessage(chatId, processingMessage.message_id);
    // Send the generated image URL to the chat as a reply to the original message with a custom caption
    await bot.sendPhoto(chatId, output[0], {
      caption: `𝗜𝗺𝗮𝗴𝗲 𝗚𝗲𝗻𝗲𝗿𝗮𝘁𝗲𝗱 𝘀𝘂𝗰𝗰𝗲𝘀𝘀𝗳𝘂𝗹𝗹𝘆 ✅\n\nGenerated by @${username}\n`,
      reply_markup: {
        inline_keyboard: [[downloadButton]],
      },
      reply_to_message_id: messageId,
      parse_mode: "HTML", // Set the parse mode to HTML
    });
  } catch (error) {
    console.error("Error:", error);
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
  const messageId = msg.message_id; // Get the ID of the user's message to reply to it

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
          disable_safety_check: true,
        },
      }
    );

    // Format the output
    let responseText = Array.isArray(output) ? output.join("") : "No response";
    console.log("responseText:", responseText); // Log the response text

    // Send a message as a direct reply to the user's original message
    bot.sendMessage(chatId, `\n\n${responseText}`, {
      parse_mode: "Markdown",
      reply_to_message_id: messageId,
    });
  } catch (error) {
    console.error("Error:", error);
    // Reply to the user's original message even in the case of an error
    bot.sendMessage(
      chatId,
      "Sorry, an error occurred while processing your request.",
      {
        parse_mode: "Markdown",
        reply_to_message_id: messageId,
      }
    );
  }
});

// Handler for image analysis ('/describe' command)

bot.on("message", async (msg) => {
  if (
    msg.text &&
    msg.text.startsWith("/describe") &&
    msg.reply_to_message &&
    msg.reply_to_message.photo
  ) {
    const chatId = msg.chat.id;
    const photoArray = msg.reply_to_message.photo;
    const photoFileId = photoArray[photoArray.length - 1].file_id;

    // Extract the custom prompt from the user's message
    const userPrompt = msg.text.split("/describe")[1].trim();
    const customPrompt =
      userPrompt.length > 0 ? userPrompt : "Describe this picture.";

    try {
      const photoLink = await bot.getFileLink(photoFileId);
      const output = await replicate.run(
        "yorickvp/llava-13b:e272157381e2a3bf12df3a8edd1f38d1dbd736bbb7437277c8b34175f8fce358",
        {
          input: {
            image: photoLink,
            top_p: 1,
            prompt: customPrompt,
            max_tokens: 1024,
            temperature: 1,
          },
        }
      );

      // Assuming output is directly the array ["This ", "animal ", "is ", "a ", "cat."]
      // If output structure is different, adjust the path to the array accordingly.
      const analysisResult = output.join(" "); // Formats the array of strings into a single string.

      bot.sendMessage(chatId, `Analysis: ${analysisResult}`, {
        reply_to_message_id: msg.message_id,
      });
    } catch (error) {
      console.error("Error analyzing photo:", error);
      bot.sendMessage(chatId, "Sorry, I couldn't analyze the photo.", {
        reply_to_message_id: msg.message_id,
      });
    }
  }
});

// Function to send a chat message to Mistral and get a response
async function chatWithMistral(message) {
  try {
    const response = await fetch(mistralEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mistralApiKey}`,
      },
      body: JSON.stringify({
        model: "mistral-medium", // Specify the model you wish to use
        messages: [{ role: "user", content: message }],
        safe_prompt: false, // Set to true if you want to enable safe mode
      }),
    });

    const data = await response.json();
    if (!response.ok)
      throw new Error(data.message || "Failed to communicate with Mistral AI.");
    return data.choices[0].message.content; // Adjust according to the actual API response structure.
  } catch (error) {
    console.error("Error communicating with Mistral AI:", error);
    throw error; // Or handle the error appropriately within your bot
  }
}

// Assuming mistralApiKey and chatWithMistral are correctly implemented

// Listen for the /mistral command
bot.onText(/\/mistery (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userMessage = match[1];
  const replyOptions = { reply_to_message_id: msg.message_id };

  try {
    const mistralResponse = await chatWithMistral(userMessage);
    bot.sendMessage(chatId, mistralResponse, replyOptions);
  } catch (error) {
    // Handle rate limit specific error
    if (error.message.includes("rate limit exceeded")) {
      bot.sendMessage(
        chatId,
        "I need to take a breather and think. Please try again in a little while.",
        replyOptions
      );
    } else {
      bot.sendMessage(
        chatId,
        "Oops, encountered an unexpected glitch. Let's try that again later?",
        replyOptions
      );
    }
  }
});

// Placeholder for additional features
