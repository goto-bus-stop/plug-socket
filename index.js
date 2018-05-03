var WebSocket = require('ws')
var WS_URL = 'wss://ws-prod.plug.dj:443/socket'
var WS_ORIGIN = 'https://plug.dj'

var WSSTATE_OPEN = 1
var HEARTBEAT_TIMEOUT = 25 * 1000

module.exports = function socket (authToken, options) {
  var wsUrl = options && options.url || WS_URL
  var wsOrigin = options && options.origin || WS_ORIGIN
  var heartbeatTimeout = options && options.timeout || HEARTBEAT_TIMEOUT

  var ws = new WebSocket(wsUrl, { origin: wsOrigin })

  var queue = []
  var heartbeat

  function gotHeartbeat () {
    if (heartbeat) clearTimeout(heartbeat)
    heartbeat = setTimeout(ontimedout, heartbeatTimeout)
  }

  function onmessage (event) {
    gotHeartbeat()

    if (event.data === 'h') {
      return null
    }

    var actions = JSON.parse(event.data)
    if (!Array.isArray(actions)) {
      return null
    }

    actions.forEach(function (data) {
      // Action shape:
      // { a: action, p: param, s: slug }
      ws.emit(data.a, data.p, data.s)
      ws.emit('action', data.a, data.p, data.s)
    })
  }

  ws.sendMessage = function sendMessage (action, param) {
    if (ws.readyState === WSSTATE_OPEN) {
      ws.send(JSON.stringify({
        a: action,
        p: param,
        t: Math.floor(Date.now() / 1000)
      }))
    } else {
      queue.push({ action: action, param: param })
    }
    return ws
  }

  /**
   * Send all queued messages.
   */
  function onopen () {
    gotHeartbeat()
    queue.forEach(function (message) {
      ws.sendMessage(message.action, message.param)
    })
  }

  function onclose () {
    if (heartbeat) clearTimeout(heartbeat)
  }

  /**
   * When we haven't received a heartbeat for some time, the connection might
   * have stopped working.
   */
  function ontimedout () {
    ws.close(3001, 'Timed out: did not receive heartbeat from plug.dj')
  }

  ws.auth = function auth (param) {
    return ws.sendMessage('auth', param)
  }
  ws.chat = function chat (param) {
    return ws.sendMessage('chat', param)
  }

  ws.onmessage = onmessage
  ws.onopen = onopen
  ws.onclose = onclose

  if (authToken) {
    ws.auth(authToken)
  }

  return ws
}
