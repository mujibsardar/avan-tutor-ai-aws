import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";

const s3Client = new S3Client();
const lambdaClient = new LambdaClient();

export const handler = async (event) => {
  const bucketName = process.env.UPLOAD_BUCKET_NAME;
  const documentProcessingFunctionName =
    process.env.DOCUMENT_PROCESSING_FUNCTION_NAME;

  try {
    const fileKey = `uploads/${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 15)}`;

    // Upload file to S3
    const uploadResult = await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        Body: event.body,
      })
    );

    // Invoke the document processing Lambda function
    const invokeResult = await lambdaClient.send(
      new InvokeCommand({
        FunctionName: documentProcessingFunctionName,
        InvocationType: "Event",
        Payload: JSON.stringify({ fileKey }),
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "File uploaded and document processing started",
      }),
    };
  } catch (error) {
    console.error("Error during file upload or processing:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error during file upload or processing",
      }),
    };
  }
};
