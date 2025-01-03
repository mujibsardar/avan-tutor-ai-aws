// helpers/geminiHelper.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

async function getGeminiApiKey() {
  console.log("Fetching Gemini API key from Secrets Manager.");
  const secretsManagerClient = new SecretsManagerClient({
    region: "us-west-2",
  });
  const secretValueCommand = new GetSecretValueCommand({
    SecretId: "Gemini",
  });
  const secretResponse = await secretsManagerClient.send(secretValueCommand);
  const apiKey = JSON.parse(secretResponse.SecretString).GEMINI_API_KEY;
  console.log("Gemini API key fetched:", apiKey.slice(0, 5) + "...");
  return apiKey;
}

export async function generateGeminiResponse(history, prompt) {
  const apiKey = await getGeminiApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  // New formatted history
  const formattedHistory = history.map((item) => ({
    role: item.sender === "user" ? "user" : "model",
    parts: [{ text: item.message }],
  }));

  const chat = model.startChat({
    history: formattedHistory,
  });

  const result = await chat.sendMessage(prompt);
  const response = await result.response;
  const responseText = response.text();
  return responseText;
}
