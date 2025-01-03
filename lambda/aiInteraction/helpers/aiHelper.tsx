// aiHelper.js
import OpenAI from "openai";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

let openai: OpenAI;

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
  console.log("OpenAI API key fetched:", apiKey.slice(0, 5) + "..."); // Log the first 5 characters
  return apiKey;
}

async function getOpenAIClient(): Promise<OpenAI> {
  if (!openai) {
    const apiKey = await getOpenAiApiKey();
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

// Helper function for evaluating ai confidence
export async function evaluateAIConfidence(aiGuidance: string, prompt: string) {
  const openai = await getOpenAIClient();
  console.log("Evaluating AI response confidence.");
  const confidenceEvaluation = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content:
          "You are an AI response evaluator. Your task is to assess the confidence level of the provided AI response and identify any potential inaccuracies or outdated information, especially in coding examples. " +
          "Provide the evaluation in JSON format with the following keys:\n\n" +
          "  * confidence: A numerical score (out of 100) representing the confidence level of the AI response. Higher scores indicate higher confidence.\n" +
          "  * concerns: An array of strings with concise, bullet-pointed feedback, addressing the user directly, on potential reasons why the response could be inaccurate or outdated.\n\n" +
          "When evaluating the response, consider the quality and clarity of the user prompt. Here's how prompt quality should influence the confidence score:\n\n" +
          "  * **Very low-effort prompt (e.g., 'What dhdj', 'Why </div>'):** Confidence should be below 30, regardless of the AI's response.\n" +
          "  * **Vague or ambiguous prompt (e.g., 'Is this good?' with a code snippet):** Confidence should be below 60, even if the response seems correct in isolation.\n" +
          "  * **Clear and specific prompt with sufficient context:** Confidence can be above 70, depending on the accuracy and relevance of the response.\n\n" + // Provide concrete examples with expected confidence levels
          "Pay close attention to the following when evaluating the response:\n" +
          "  * **Outdated libraries or APIs:** Are the libraries, APIs, or frameworks used in the code examples current and widely used? Are there newer or more efficient alternatives available?\n" +
          "  * **Relevance to the prompt:** Does the response directly address the user's specific request and provide a solution that is likely to work? If the user's prompt is ambiguous, the confidence should be lower.\n" +
          "  * **Completeness and correctness:** Does the code example cover all necessary aspects of the solution? Is the code syntactically correct and free of errors?\n" +
          "  * **Clarity and best practices:** Is the code well-structured, readable, and efficient? Does it follow coding best practices and conventions?\n\n" +
          "If you are highly confident in the response's accuracy, relevance, and up-to-dateness, provide a confidence score of 90 or above. " +
          "If you have minor concerns or identify areas where the response could be improved, provide a score between 70 and 90. " +
          "If you have significant concerns about the response's accuracy, relevance, or outdatedness, provide a score below 70.",
      },
      {
        role: "user",
        content: `Evaluate this AI response: ${aiGuidance}. The user's prompt was: ${prompt}`,
      },
    ],
  });
  console.log("AI confidence evaluation completed:", confidenceEvaluation);
  try {
    const evaluation = JSON.parse(
      confidenceEvaluation.choices[0].message.content
    );
    return {
      confidence: evaluation.confidence,
      concerns:
        evaluation.concerns.length > 0
          ? evaluation.concerns.join("\n- ")
          : "No concerns found.", // Add default message
    };
  } catch (error) {
    console.error(
      "[ERROR] Failed to parse confidence evaluation response:",
      error
    );
    console.error("Error Details:", JSON.stringify(error, null, 2));
    return { confidence: null, concerns: null };
  }
}
