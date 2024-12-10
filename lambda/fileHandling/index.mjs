import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { createRequire } from "module";
import { Readable } from "stream";
const require = createRequire(import.meta.url);

const pdfParse = require("pdf-parse");
import mammoth from "mammoth";
import multipart from "aws-lambda-multipart-parser";

const s3Client = new S3Client({ region: "us-west-2" });

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

    // Parse the multipart form data
    const parsedBody = multipart.parse(event, true);
    const fileData = parsedBody.file;
    if (!fileData) {
      throw new Error("No file uploaded.");
    }

    const { contentType, filename, content } = fileData;

    // Upload file to S3
    const bucketName =
      "cdkaitutoringstackstoragestac-uploadbucketd2c1da78-ck0p7bxkt4ti";
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: filename,
        Body: content,
      })
    );

    // Fetch file from S3
    const s3Response = await s3Client.send(
      new GetObjectCommand({
        Bucket: bucketName,
        Key: filename,
      })
    );

    const fileStream = s3Response.Body;

    // Convert the file stream to a buffer
    const fileBuffer = await streamToBuffer(fileStream);

    // Extract text based on file type
    let extractedText = "";
    if (contentType === "application/pdf") {
      extractedText = await extractTextFromPDF(fileBuffer);
    } else if (
      contentType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      contentType === "application/msword"
    ) {
      extractedText = await extractTextFromDoc(fileBuffer);
    } else {
      extractedText = fileBuffer.toString("utf-8");
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
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ message: "File processing failed.", error }),
    };
  }
};

// Helper function to convert a stream to a buffer
const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
};

// Helper function to extract text from PDF using pdf-parse
const extractTextFromPDF = async (fileBuffer) => {
  const data = await pdfParse(fileBuffer);
  console.log("data => ", JSON.stringify(data, null, 2));
  return data.text;
};

// Helper function to extract text from DOC/DOCX using Mammoth
const extractTextFromDoc = async (fileBuffer) => {
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return result.value;
};
