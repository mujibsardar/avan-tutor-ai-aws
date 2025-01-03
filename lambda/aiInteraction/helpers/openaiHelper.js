import OpenAI from "openai";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

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
  const apiKey = await getOpenAiApiKey();
  const openai = new OpenAI({ apiKey });

  const aiResponse = {
    aiGuidance: null,
    score: null,
    feedback: null,
    confidence: null,
    concerns: null,
    promptSummary: null,
  };

  // Prompt Evaluation Logic
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

  // Extract score and feedback from the AI response
  const evaluationResponse = evaluationCompletion.choices[0].message.content;
  console.log("Prompt evaluation response:", evaluationResponse);

  try {
    // Parse the JSON response
    const evaluation = JSON.parse(evaluationResponse);
    aiResponse.score = evaluation.score;
    aiResponse.feedback = evaluation.feedback.join("\n- "); // Join feedback bullet points
    console.log(
      "Prompt evaluation data:",
      aiResponse.score,
      aiResponse.feedback
    );
  } catch (error) {
    console.error("[ERROR] Failed to parse evaluation response:", error);
    console.error("Error Details:", JSON.stringify(error, null, 2));
    // Handle the error appropriately (e.g., set default values or throw an error)
  }

  // Generate a summarized version of the user prompt
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
  aiResponse.promptSummary = summaryCompletion.choices[0].message.content;
  console.log("Summarized prompt:", aiResponse.promptSummary);

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
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: aiGuidanceMessages,
  });
  aiResponse.aiGuidance = completion.choices[0].message.content;
  console.log("AI response:", aiResponse.aiGuidance);

  // Evaluate AI response confidence and potential inaccuracies
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
        content: `Evaluate this AI response: ${aiResponse.aiGuidance}`,
      },
    ],
  });
  console.log("AI confidence evaluation completed:", confidenceEvaluation);

  try {
    const evaluation = JSON.parse(
      confidenceEvaluation.choices[0].message.content
    );
    aiResponse.confidence = evaluation.confidence;
    aiResponse.concerns =
      evaluation.concerns.length > 0
        ? evaluation.concerns.join("\n- ")
        : "No concerns found.";
    console.log(
      "AI confidence evaluation data:",
      aiResponse.confidence,
      aiResponse.concerns
    );
  } catch (error) {
    console.error(
      "[ERROR] Failed to parse confidence evaluation response:",
      error
    );
    console.error("Error Details:", JSON.stringify(error, null, 2));
  }
  console.log("OpenAI response object:", aiResponse);
  return aiResponse;
}
