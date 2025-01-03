import { google } from "googleapis";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

async function getGoogleApiKey() {
  console.log("Fetching Google API key from Secrets Manager.");
  const secretsManagerClient = new SecretsManagerClient({
    region: "us-west-2",
  });
  const secretValueCommand = new GetSecretValueCommand({
    SecretId: "Google", // Assuming you named the Secret 'Google'
  });
  const secretResponse = await secretsManagerClient.send(secretValueCommand);
  const apiKey = JSON.parse(secretResponse.SecretString).GOOGLE_API_KEY;
  console.log("Google API key fetched:", apiKey.slice(0, 5) + "...");
  return apiKey;
}

export async function googleSearch(query) {
  console.log("Fetching Google Search results for query:", query);
  const apiKey = await getGoogleApiKey();
  const customsearch = google.customsearch("v1");
  try {
    console.log("Google Search API call initiated.");
    const response = await customsearch.cse.list({
      auth: apiKey,
      cx: process.env.GOOGLE_SEARCH_ENGINE_ID, // Your Google Custom Search Engine ID
      q: query,
      num: 3, // Number of results to return, feel free to adjust
    });
    const results = response.data.items || [];
    console.log("Google Search results:", results);
    return results;
  } catch (error) {
    console.error("Error during Google Search:", error);
    console.error("Error Details:", JSON.stringify(error, null, 2));
    return [];
  }
}
