import * as path from "path";
import * as cdk from "@aws-cdk/core";
import * as apigateway from "@aws-cdk/aws-apigatewayv2";
import * as apigatewayintegrations from "@aws-cdk/aws-apigatewayv2-integrations";
import * as lambda from "@aws-cdk/aws-lambda";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import { Duration } from "@aws-cdk/core";
import { HttpMethod } from "@aws-cdk/aws-apigatewayv2";
import { buildId } from "./util";
import { PolicyStatement } from "@aws-cdk/aws-iam";

export class ConfidentialClausRestApiStack extends cdk.Stack {
  private table: dynamodb.Table;
  private defaultIntegration: apigatewayintegrations.LambdaProxyIntegration;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.buildTable();
    this.buildLambda();
    this.buildHttpApi();
  }

  private buildTable() {
    this.table = new dynamodb.Table(this, buildId("UserTable"), {
      partitionKey: { name: "username", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      tableName: "ConfidentialClausUserTable"
    });
  }

  private buildLambda() {
    const defaultLambdaFn = new lambda.Function(this, buildId("DefaultFn"), {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../assets/lambda.zip")),
      initialPolicy: [new PolicyStatement({
        resources: [this.table.tableArn],
        actions: [
          "dynamodb:BatchGetItem",
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWriteItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem"
        ]
      })]
    });

    this.defaultIntegration = new apigatewayintegrations.LambdaProxyIntegration({
      handler: defaultLambdaFn,
    });
  }

  private buildHttpApi() {
    const httpApi = new apigateway.HttpApi(this, buildId("RestAPI"), {
      corsPreflight: {
        allowHeaders: ["Authorization, Content-Type"],
        allowMethods: [HttpMethod.GET, HttpMethod.PUT, HttpMethod.DELETE, HttpMethod.POST, HttpMethod.OPTIONS],
        allowOrigins: ["*"],
        maxAge: Duration.days(10),
      }
    });

    // Routes documented in config/api-definition.yaml
    httpApi.addRoutes({
      path: "/user",
      methods: [HttpMethod.POST],
      integration: this.defaultIntegration
    });

    httpApi.addRoutes({
      path: "/users",
      methods: [HttpMethod.GET],
      integration: this.defaultIntegration
    });

    httpApi.addRoutes({
      path: "/profile/{username}",
      methods: [HttpMethod.GET, HttpMethod.PUT],
      integration: this.defaultIntegration
    });

    httpApi.addRoutes({
      path: "/profile/{username}/note",
      methods: [HttpMethod.PUT, HttpMethod.DELETE],
      integration: this.defaultIntegration
    });

    httpApi.addRoutes({
      path: "/admin/assign-all",
      methods: [HttpMethod.PUT],
      integration: this.defaultIntegration
    });

    httpApi.addRoutes({
      path: "/admin/assign/{username}",
      methods: [HttpMethod.PUT],
      integration: this.defaultIntegration
    });

    new apigateway.HttpStage(this, buildId("RestAPIStage"), {
      httpApi,
      stageName: "prod"
    });
  }
}