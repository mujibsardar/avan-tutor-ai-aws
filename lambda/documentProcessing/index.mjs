import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const streamToString = (stream) => {
  return new Promise((resolve, reject) => {
    const chunks = [];

    stream.on("data", (chunk) => {
      chunks.push(chunk);
    });

    stream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8")); // Convert the buffer to a string
    });

    stream.on("error", (err) => {
      reject(err);
    });
  });
};

// Create a new S3 client instance
const s3 = new S3Client();

export const handler = async (event) => {
  try {
    // Get the bucket name and object key (file name) from the S3 event
    const bucketName = event.Records[0].s3.bucket.name;
    const fileName = decodeURIComponent(
      event.Records[0].s3.object.key.replace(/\+/g, " ")
    );

    // Retrieve the file from the S3 bucket
    const params = {
      Bucket: bucketName,
      Key: fileName,
    };

    // Use the GetObjectCommand to retrieve the file
    const command = new GetObjectCommand(params);
    const fileObject = await s3.send(command);
    const fileContent = await streamToString(fileObject.Body); // Convert stream to string

    // Simulate processing document (e.g., extract text, etc.)
    const extractedText = `Processed content of ${fileName}: ${fileContent.substring(
      0,
      100
    )}...`;

    // Return a successful response with the extracted text
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Document processed successfully!",
        extractedText,
      }),
    };
  } catch (error) {
    console.error("Document processing failed:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Document processing failed.", error }),
    };
  }
};
