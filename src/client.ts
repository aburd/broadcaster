import type {
  ClientHandler,
  ClientSocket,
  Message,
  ServerHandler,
} from "./types.ts";

export type ConnectOpts = {
  onOpen?: (e: Event) => void;
  onClose?: (e: CloseEvent) => void;
  onError?: (e: Event) => void;
};

/**
 * Connect to a websocket endpoint and return a ClientSocket
 * Once you have the ClientSocket, you can begin to send messages through the .send function
 */
export function connect<
  ClientHandlers extends Record<string, ClientHandler<ServerHandlers>>,
  ServerHandlers extends Record<string, ServerHandler<ClientHandlers>>,
>(
  wsUrl: string,
  opts: ConnectOpts = {},
): Promise<ClientSocket<ClientHandlers, ServerHandlers>> {
  const _socket = new WebSocket(wsUrl);
  let _handlers: ClientHandlers;
  const clientSocket: ClientSocket<ClientHandlers, ServerHandlers> = {
    send: (message) => {
      let serialized: string;
      try {
        serialized = JSON.stringify(message);
      } catch (e) {
        console.error(
          `Could not serialize event Message: ${message}. Message MUST be JSON serializable`,
          e,
        );
        return;
      }

      _socket.send(serialized);
    },
    close: () => _socket.close(),
    setHandlersForSocket: (handlers) => {
      _handlers = handlers;
    },
  };

  return new Promise((res, rej) => {
    _socket.onopen = (e) => {
      res(clientSocket);
      opts.onOpen?.(e);
    };
    _socket.onclose = (ev) => {
      _socket.close();
      opts.onClose?.(ev);
    };
    _socket.onerror = (ev) => {
      opts.onError?.(ev);
      rej(ev);
      _socket.close();
    };
    _socket.onmessage = (event) => {
      let eventData: Message<ClientHandlers>;
      try {
        eventData = JSON.parse(event.data);
      } catch (e) {
        console.error(
          `Could not parse event data: ${event.data}. data sent in message MUST be JSON serializable`,
          e,
        );
        return;
      }
      if (!eventData) return;

      const { key, data } = eventData;
      const handler = _handlers[key];
      if (!handler) return;

      handler(data, clientSocket);
    };
  });
}
