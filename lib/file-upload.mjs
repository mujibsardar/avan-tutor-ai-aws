import { Stack } from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";

export class FileUploadStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { uploadBucketName, documentProcessingFunction } = props; // Receive the bucket name

    // Define the Lambda function for file uploads
    this.fileUploadFunction = new lambda.Function(this, "FileUploadFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: lambda.Code.fromAsset("lambda/fileUpload"),
      handler: "index.handler",
      environment: {
        UPLOAD_BUCKET_NAME: uploadBucketName,
        DOCUMENT_PROCESSING_FUNCTION_NAME:
          documentProcessingFunction.functionName,
      },
    });

    // Grant necessary permissions to the Lambda function
    const uploadBucket = s3.Bucket.fromBucketName(
      this,
      "UploadBucket",
      uploadBucketName
    );
    uploadBucket.grantWrite(this.fileUploadFunction);
    documentProcessingFunction.grantInvoke(this.fileUploadFunction);
  }
}
