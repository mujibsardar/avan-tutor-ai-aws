import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import { Function, Runtime, Code } from "aws-cdk-lib/aws-lambda";
import { Bucket } from "aws-cdk-lib/aws-s3";

export class FileHandlingStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    const { uploadBucketName } = props;

    // Define the Lambda function
    this.fileHandlingFunction = new Function(this, "FileHandlingFunction", {
      runtime: Runtime.NODEJS_20_X,
      handler: "index.handler",
      code: Code.fromAsset("lambda/fileHandling"), // Path to your Lambda code
      environment: {
        BUCKET_NAME: uploadBucketName,
      },
      memorySize: 1024, // Increase memory to 1024 MB (1 GB)
      timeout: cdk.Duration.seconds(60), // Increase timeout to 60 seconds
    });

    // Grant the Lambda permission to access the S3 bucket
    const uploadBucket = Bucket.fromBucketName(
      this,
      "UploadBucket",
      uploadBucketName
    );
    uploadBucket.grantReadWrite(this.fileHandlingFunction);
  }
}
