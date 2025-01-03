// helpers/geminiHelper.js
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { evaluateAIConfidence } from "./aiHelper.js";

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
  console.log(
    "Generating Gemini response with history:",
    history,
    "and prompt:",
    prompt
  );
  try {
    const apiKey = await getGeminiApiKey();
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    const formattedHistory = history.map((item) => ({
      role: item.sender === "user" ? "user" : "model",
      parts: [{ text: item.message }],
    }));

    console.log(" ");
    console.log(" ");
    console.log(" ");
    console.log(
      "==> Starting Gemini chat with the formatted history:",
      JSON.stringify(formattedHistory, null, 2)
    );
    console.log(" ");
    console.log(" ");
    console.log(" ");

    const chat = model.startChat({
      history: formattedHistory,
    });

    console.log("==> DONE");

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    const responseText = response.text();
    console.log("Gemini Response:", responseText);

    // Get confidence from OpenAI
    const { confidence, concerns } = await evaluateAIConfidence(
      responseText,
      prompt
    );

    return {
      aiGuidance: responseText,
      confidence,
      concerns,
    };
  } catch (error) {
    console.error("Error generating Gemini response:", error);
    console.error("Error Details:", JSON.stringify(error, null, 2));
    return {
      message: "Gemini request failed with error: " + error.message,
    };
  }
}
