import { Stack, RemovalPolicy, CfnOutput } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";

export class StorageStack extends Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // Create the S3 bucket for storing uploaded files
    this.uploadBucket = new s3.Bucket(this, "UploadBucket", {
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // Output the bucket name (to reference later)
    new CfnOutput(this, "UploadBucketNameOutput", {
      value: this.uploadBucket.bucketName,
    });
  }
}
