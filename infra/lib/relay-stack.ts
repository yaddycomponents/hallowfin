// The phone relay on AWS: a WebSocket API whose every event (a connection
// opening, closing, or sending a message) runs one Lambda function, which
// keeps sessions in a DynamoDB table and answers through the API.
//
//   game / phones ──WebSocket──▶ API Gateway ──▶ Lambda (relay/lambda.js) ◀──▶ DynamoDB
//
// Nothing here runs while nobody's playing: you pay per message and per
// minute connected (fractions of a cent for a party), and every item in the
// table expires on its own.
import * as path from 'node:path'
import { CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib'
import { WebSocketApi, WebSocketStage } from 'aws-cdk-lib/aws-apigatewayv2'
import { WebSocketLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations'
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb'
import { Architecture, Runtime } from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

export interface RelayProps extends StackProps {
  site: string // where the phone pages live (the links in the QR codes)
  origins: string[] // pages allowed to connect
}

export class RelayStack extends Stack {
  constructor(scope: Construct, id: string, props: RelayProps) {
    super(scope, id, props)

    // sessions, connections and dalgona rounds, by key: S#…, C#…, K#…
    const table = new Table(this, 'Sessions', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: RemovalPolicy.DESTROY, // nothing in it outlives a party
    })

    const relay = new NodejsFunction(this, 'Relay', {
      entry: path.join(__dirname, '../../relay/lambda.js'),
      // the relay's code lives beside the game (the laptop relay shares it)
      projectRoot: path.join(__dirname, '../..'),
      depsLockFilePath: path.join(__dirname, '../../package-lock.json'),
      runtime: Runtime.NODEJS_22_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      environment: {
        TABLE: table.tableName,
        SITE_URL: props.site,
        ALLOWED_ORIGINS: props.origins.join(','),
      },
      // the AWS SDK is already in the Lambda runtime: bundle only our code
      bundling: { format: OutputFormat.ESM, externalModules: ['@aws-sdk/*'], minify: true },
      logGroup: new LogGroup(this, 'RelayLogs', { retention: RetentionDays.ONE_WEEK, removalPolicy: RemovalPolicy.DESTROY }),
    })
    table.grantReadWriteData(relay)

    // every route goes to the relay; it reads `action` from the message itself
    const route = { integration: new WebSocketLambdaIntegration('Relay', relay) }
    const api = new WebSocketApi(this, 'Api', {
      apiName: 'squid-dare-relay',
      connectRouteOptions: route,
      disconnectRouteOptions: route,
      defaultRouteOptions: route,
    })
    const stage = new WebSocketStage(this, 'Live', {
      webSocketApi: api,
      stageName: 'live',
      autoDeploy: true,
      // a party sends a few messages a second; this caps anyone hammering it
      throttle: { rateLimit: 50, burstLimit: 100 },
    })
    // the relay answers by posting to connections through the API
    api.grantManageConnections(relay)

    new CfnOutput(this, 'Url', { value: stage.url, description: 'The WebSocket the game and phones connect to' })
  }
}
