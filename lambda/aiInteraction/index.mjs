// Import necessary libraries
import OpenAI from "openai";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  DynamoDBClient,
  ScanCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";

export const handler = async (event) => {
  try {
    const method = event.httpMethod || event.requestContext?.http?.method;

    if (method === "OPTIONS") {
      return {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
        body: null,
      };
    }

    if (method !== "POST") {
      return {
        statusCode: 405,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "Method Not Allowed." }),
      };
    }

    // Parse request body
    const { input: processedText, sessionId } = JSON.parse(event.body);

    if (!sessionId) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "sessionId is required." }),
      };
    }

    // Retrieve OpenAI API key from Secrets Manager
    const secretsManagerClient = new SecretsManagerClient({
      region: "us-west-2",
    });
    const secretValueCommand = new GetSecretValueCommand({
      SecretId: "OpenAI",
    });
    const secretResponse = await secretsManagerClient.send(secretValueCommand);
    const openaiApiKey = JSON.parse(secretResponse.SecretString).OPENAI_API_KEY;

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // Fetch session history from DynamoDB
    const dynamoDbClient = new DynamoDBClient({ region: "us-west-2" });
    const scanCommand = new ScanCommand({
      TableName: process.env.TUTORING_SESSIONS_TABLE,
      FilterExpression: "sessionId = :sessionId",
      ExpressionAttributeValues: {
        ":sessionId": { S: sessionId },
      },
    });

    const sessionResponse = await dynamoDbClient.send(scanCommand);
    const sessionItem = sessionResponse.Items?.[0];

    if (!sessionItem) {
      return {
        statusCode: 404,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "Session not found." }),
      };
    }

    const studentId = sessionItem.studentId?.S;
    const sessionHistoryString = sessionItem.history?.S || "[]";
    const sessionHistoryList = JSON.parse(sessionHistoryString);

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

    // Extract score and feedback from the AI response
    const evaluationResponse = evaluationCompletion.choices[0].message.content;

    let score = null;
    let feedback = null;

    try {
      // Parse the JSON response
      const evaluation = JSON.parse(evaluationResponse);
      score = evaluation.score;
      feedback = evaluation.feedback.join("\n- "); // Join feedback bullet points
    } catch (error) {
      console.error("[ERROR] Failed to parse evaluation response:", error);
      // Handle the error appropriately (e.g., set default values or throw an error)
    }

    // Generate a summarized version of the user prompt
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

    const promptSummary = summaryCompletion.choices[0].message.content;

    const timestamp = new Date().toISOString();
    const updatedHistory = [
      ...sessionHistoryList,
      {
        message: processedText,
        sender: "user",
        timestamp,
        score: score,
        feedback: feedback,
        promptSummary: promptSummary, // Add the summary to the history item
      },
    ];

    // Generate AI response
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are a helpful tutor assistant." },
        ...updatedHistory.map(({ message, sender }) => ({
          role: sender === "user" ? "user" : "assistant",
          content: message,
        })),
      ],
    });

    const aiGuidance = completion.choices[0].message.content;

    // Evaluate AI response confidence and potential inaccuracies
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
        { role: "user", content: `Evaluate this AI response: ${aiGuidance}` },
      ],
    });

    // Extract confidence and concerns from the evaluation response
    let confidence = null;
    let concerns = null;

    try {
      const evaluation = JSON.parse(
        confidenceEvaluation.choices[0].message.content
      );
      confidence = evaluation.confidence;
      concerns =
        evaluation.concerns.length > 0
          ? evaluation.concerns.join("\n- ")
          : "No concerns found."; // Add default message
    } catch (error) {
      console.error(
        "[ERROR] Failed to parse confidence evaluation response:",
        error
      );
      // Handle the error appropriately
    }

    // Update the history with the AI response (no need to add score/feedback again)
    const newHistory = [
      ...updatedHistory,
      {
        message: aiGuidance,
        sender: "ai",
        confidence,
        concerns,
        timestamp: new Date().toISOString(),
      },
    ];

    // Update session history in DynamoDB
    const updateSessionCommand = new UpdateItemCommand({
      TableName: process.env.TUTORING_SESSIONS_TABLE,
      Key: {
        sessionId: { S: sessionId },
        studentId: { S: studentId },
      },
      UpdateExpression: "SET history = :history",
      ExpressionAttributeValues: {
        ":history": { S: JSON.stringify(newHistory) },
      },
    });

    await dynamoDbClient.send(updateSessionCommand);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      },
      body: JSON.stringify({
        message: "AI guidance generated successfully!",
        aiGuidance,
        score,
        feedback,
        updatedHistory: newHistory,
      }),
    };
  } catch (error) {
    console.error("[ERROR] AI interaction failed:", error);
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
      },
      body: JSON.stringify({
        message: "AI interaction failed.",
        error: error.message || "Unknown error",
        stack: error.stack,
      }),
    };
  }
};
