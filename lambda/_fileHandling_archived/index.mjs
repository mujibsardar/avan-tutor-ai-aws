// **************************************** NOT UTILIZED ****************************************
// Lambda function to extract text from PDF and DOCX files using Adobe PDF Services SDK and Mammoth
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import parser from "lambda-multipart-parser";
import fs from "fs/promises";
import path from "path";
import { createReadStream, createWriteStream } from "fs";

// Adobe PDF Services SDK
import {
  ServicePrincipalCredentials,
  PDFServices,
  MimeType,
  ExtractPDFParams,
  ExtractElementType,
  ExtractPDFJob,
  ExtractPDFResult,
} from "@adobe/pdfservices-node-sdk";

// Mammoth for DOCX extraction
import mammoth from "mammoth";

// Initialize S3 client
const s3Client = new S3Client({ region: "us-west-2" });

// Lambda function handler
export const handler = async (event) => {
  try {
    if (event.httpMethod === "OPTIONS") {
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

    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        headers: {
          "Access-Control-Allow-Origin": "*",
        },
        body: JSON.stringify({ message: "Method Not Allowed." }),
      };
    }

    const parsed = await parser.parse(event);
    const file = parsed.files?.[0];
    if (!file) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "No file uploaded." }),
      };
    }

    await s3Client.send(
      new PutObjectCommand({
        Bucket:
          "cdkaitutoringstackstoragestac-uploadbucketd2c1da78-ck0p7bxkt4ti",
        Key: `uploads/${file.filename}`,
        Body: file.content,
        ContentType: file.contentType,
      })
    );

    const secretsManagerClient = new SecretsManagerClient({
      region: "us-west-2",
    });
    const secretResponse = await secretsManagerClient.send(
      new GetSecretValueCommand({
        SecretId: "AdobePdfServicesSecret", // Replace with your secret name
      })
    );
    const secretString = JSON.parse(secretResponse.SecretString);

    if (!secretString.clientId || !secretString.client_secret) {
      throw new Error(
        "Missing clientId or client_secret in Adobe PDF Services Secret."
      );
    }

    const credentials = new ServicePrincipalCredentials({
      clientId: secretString.clientId,
      clientSecret: secretString.client_secret,
    });

    const pdfServices = new PDFServices({ credentials });

    let extractedText = "";
    if (file.contentType === "application/pdf") {
      extractedText = await extractTextUsingAdobePdfServices(file, pdfServices);
    } else if (
      file.contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      extractedText = await extractTextFromDoc(file);
    } else {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ message: "Unsupported file type." }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ extractedText }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        message: "File processing failed.",
        error: error.message,
        stack: error.stack,
      }),
    };
  }
};

// Function to extract text from PDF using Adobe PDF Services SDK
const extractTextUsingAdobePdfServices = async (file, pdfServices) => {
  const tempFilePath = path.join("/tmp", "temp.pdf");

  await fs.writeFile(tempFilePath, file.content);

  const readStream = createReadStream(tempFilePath);
  const inputAsset = await pdfServices.upload({
    readStream,
    mimeType: MimeType.PDF,
  });

  const params = new ExtractPDFParams({
    elementsToExtract: [ExtractElementType.TEXT],
  });

  const job = new ExtractPDFJob({ inputAsset, params });
  const pollingURL = await pdfServices.submit({ job });

  const pdfServicesResponse = await pdfServices.getJobResult({
    pollingURL,
    resultType: ExtractPDFResult,
  });

  const extractedText = pdfServicesResponse.result.text;

  return extractedText;
};

// Function to extract text from DOCX files using Mammoth
const extractTextFromDoc = async (file) => {
  const tempFilePath = path.join("/tmp", "temp.docx");

  await fs.writeFile(tempFilePath, file.content);

  const result = await mammoth.extractRawText({ path: tempFilePath });
  const extractedText = result.value;

  return extractedText;
};
