// The relay on AWS: API Gateway holds the WebSocket connections and calls this
// function for each one opening, closing, or sending a message; DynamoDB keeps
// the sessions; replies go back out through API Gateway's connections API.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { ApiGatewayManagementApiClient, DeleteConnectionCommand, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi'
import { HOURS, relay } from './core.js'

const TABLE = process.env.TABLE
const SITE = process.env.SITE_URL // where the phone pages live
const ORIGINS = (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean)
const MAX = 24 * 1024 // a message bigger than this is not one of ours

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } })
const store = {
  get: async (pk) => (await db.send(new GetCommand({ TableName: TABLE, Key: { pk } }))).Item ?? null,
  // every item expires on its own (DynamoDB's TTL on `ttl`), party or not
  put: (item) => db.send(new PutCommand({ TableName: TABLE, Item: { ...item, ttl: Math.floor(Date.now() / 1000) + HOURS * 3600 } })),
  del: (pk) => db.send(new DeleteCommand({ TableName: TABLE, Key: { pk } })),
}
const links = {
  remote: (key) => [`${SITE}/remote.html?k=${key}`],
  carve: (t) => [`${SITE}/dalgona.html?c=${t}`],
}

let api = null // one client per warm container
export async function handler(event) {
  const { routeKey, connectionId, domainName, stage } = event.requestContext
  api ??= new ApiGatewayManagementApiClient({ endpoint: `https://${domainName}/${stage}` })
  const send = async (to, msg) => {
    try {
      await api.send(new PostToConnectionCommand({ ConnectionId: to, Data: JSON.stringify(msg) }))
      return true
    } catch (e) {
      if (e.name === 'GoneException' || e.$metadata?.httpStatusCode === 410) return false
      throw e
    }
  }
  const close = (to) => api.send(new DeleteConnectionCommand({ ConnectionId: to })).catch(() => {})
  const r = relay({ store, send, close, links })

  if (routeKey === '$connect') {
    // only from the game's own pages (a browser always says where it's from)
    const origin = event.headers?.origin ?? event.headers?.Origin ?? ''
    return { statusCode: ORIGINS.length && !ORIGINS.includes(origin) ? 403 : 200 }
  }
  if (routeKey === '$disconnect') {
    await r.disconnect(connectionId)
    return { statusCode: 200 }
  }
  if (!event.body || event.body.length > MAX) return { statusCode: 400 }
  let m
  try { m = JSON.parse(event.body) } catch { return { statusCode: 400 } }
  await r.message(connectionId, m)
  return { statusCode: 200 }
}
