// openaiHelper.js
import OpenAI from "openai";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { evaluateAIConfidence } from "./aiHelper.js";

let openai;

async function getOpenAiApiKey() {
  console.log("Fetching OpenAI API key from Secrets Manager.");
  const secretsManagerClient = new SecretsManagerClient({
    region: "us-west-2",
  });
  const secretValueCommand = new GetSecretValueCommand({
    SecretId: "OpenAI",
  });
  const secretResponse = await secretsManagerClient.send(secretValueCommand);
  const apiKey = JSON.parse(secretResponse.SecretString).OPENAI_API_KEY;
  console.log("OpenAI API key fetched:", apiKey.slice(0, 5) + "...");
  return apiKey;
}

async function getOpenAIClient() {
  if (!openai) {
    const apiKey = await getOpenAiApiKey();
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// Helper function for prompt evaluation
async function evaluatePrompt(processedText) {
  const openai = await getOpenAIClient();
  console.log("Starting prompt evaluation with OpenAI.");
  const evaluationCompletion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are an AI prompt evaluator. Your task is to evaluate the quality of user prompts and provide constructive feedback to help users improve their prompts. " +
          "Evaluate the user's prompt based on its clarity, specificity, and relevance to the desired task. " +
          "Provide the evaluation in JSON format with the following keys:\n\n" +
          "  * score: Numerical score out of 100.\n" +
          "  * feedback: An array of strings with concise, bullet-pointed feedback on how to improve the prompt.\n\n" +
          "Imagine the user is asking this question on a platform like Stack Overflow. " +
          "Consider what information would be necessary to provide a helpful answer. " +
          "Focus on identifying missing context, unclear requirements, or areas where additional details would improve the prompt's quality. " +
          "For example, if the user provides a code snippet and asks for 'help,' suggest they specify the desired outcome, the problem they are facing, or the specific aspect of the code they need assistance with.\n\n" +
          "Scoring guidelines:\n" +
          "  * Prompts that only provide a code snippet and a generic request for 'help' without specifying the issue or desired outcome should receive a score below 20.\n" +
          "  * Generally, penalize lazy or low-effort prompts with scores below 40 and encourage users to provide more context or details with scores below 60.",
      },
      { role: "user", content: `Evaluate this prompt: ${processedText}` },
    ],
  });
  console.log("Prompt evaluation completed:", evaluationCompletion);
  const evaluationResponse = evaluationCompletion.choices[0].message.content;
  console.log("Prompt evaluation response:", evaluationResponse);
  try {
    const evaluation = JSON.parse(evaluationResponse);
    return {
      score: evaluation.score,
      feedback: evaluation.feedback.join("\n- "),
    };
  } catch (error) {
    console.error("[ERROR] Failed to parse evaluation response:", error);
    console.error("Error Details:", JSON.stringify(error, null, 2));
    return { score: null, feedback: null }; // Return null values in case of error
  }
}

// Helper function for prompt summary
async function summarizePrompt(processedText) {
  const openai = await getOpenAIClient();
  console.log("Generating summarized user prompt.");
  const summaryCompletion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "Generate a concise phrase (10 words or less) suitable for looking up similar user prompts. " +
          "Focus on keywords and concepts rather than the user's specific situation or intent. " +
          "For example, instead of 'New to ML, wants to understand and research user profiling,' generate something like 'Understanding ML for tutoring user profiling.'",
      },
      { role: "user", content: processedText },
    ],
  });
  console.log("Summarized prompt completed:", summaryCompletion);
  return summaryCompletion.choices[0].message.content;
}

export async function generateOpenAiResponse(
  sessionHistoryList,
  processedText
) {
  console.log(
    "Generating OpenAI response with history:",
    sessionHistoryList,
    "and prompt:",
    processedText
  );

  const aiResponse = {
    aiGuidance: null,
    score: null,
    feedback: null,
    confidence: null,
    concerns: null,
    promptSummary: null,
  };

  // Prompt Evaluation Logic
  const { score, feedback } = await evaluatePrompt(processedText);
  aiResponse.score = score;
  aiResponse.feedback = feedback;

  // Generate a summarized version of the user prompt
  aiResponse.promptSummary = await summarizePrompt(processedText);

  // Generate AI response
  console.log("Generating AI response.");
  const aiGuidanceMessages = [
    { role: "system", content: "You are a helpful tutor assistant." },
    ...sessionHistoryList.map(({ message, sender }) => ({
      role: sender === "user" ? "user" : "assistant",
      content: message,
    })),
    {
      role: "user",
      content: processedText,
    },
  ];
  console.log(
    "AI Guidance messages:",
    JSON.stringify(aiGuidanceMessages, null, 2)
  );

  const openai = await getOpenAIClient();
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: aiGuidanceMessages,
  });
  aiResponse.aiGuidance = completion.choices[0].message.content;
  console.log("AI response:", aiResponse.aiGuidance);

  // Evaluate AI response confidence and potential inaccuracies
  const { confidence, concerns } = await evaluateAIConfidence(
    aiResponse.aiGuidance,
    processedText
  );
  aiResponse.confidence = confidence;
  aiResponse.concerns = concerns;

  console.log("OpenAI response object:", aiResponse);
  return aiResponse;
}
