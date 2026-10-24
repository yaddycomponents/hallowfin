// Where the phone relay lives: the AWS WebSocket (see infra/). The game and
// the phone pages read it; null means no AWS (the dev server's relay only).
// Set by `npm run deploy:backend` from the stack's output.
window.SQUID_WS = 'wss://cc345oprrd.execute-api.ap-southeast-2.amazonaws.com/live'
