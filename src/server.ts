import type {
  ClientHandler,
  Message,
  ServerHandler,
  SocketGroup,
  SocketGroupKey,
} from "./types.ts";

/**
 * Event handlers that are called when the state of a socket in
 * the group changes
 */
export type CreateSocketOpts = {
  onOpen?: (k: SocketGroupKey) => void;
  onClose?: (k: SocketGroupKey) => void;
  onError?: (k: SocketGroupKey) => void;
};

/**
 * Creates a socket group, which holds a group of websockets that
 * will have the passed handlers bound to them, meaning any socket added
 * will receive any events that occur
 */
export function createSocketGroup<
  ServerHandlers extends Record<string, ServerHandler<ClientHandlers>>,
  ClientHandlers extends Record<string, ClientHandler<ServerHandlers>>,
>(
  /** Various event handlers that will be called when the state of any of the sockets */
  opts: CreateSocketOpts = {},
): SocketGroup<ServerHandlers, ClientHandlers> {
  const _sockets: SocketGroup<ServerHandlers, ClientHandlers>["_sockets"] = {};

  const group: SocketGroup<ServerHandlers, ClientHandlers> = {
    _sockets,
    addSocket: (
      key: SocketGroupKey,
      req: Request,
      denoOpts?: Deno.UpgradeWebSocketOptions,
    ): Response => {
      const { socket, response } = Deno.upgradeWebSocket(req, denoOpts);
      if (opts.onOpen) {
        socket.onopen = () => opts?.onOpen?.(key);
      }
      if (opts.onClose) {
        socket.onclose = () => {
          group.removeSocket(key);
          opts?.onClose?.(key);
        };
      }
      if (opts.onError) {
        group.removeSocket(key);
        socket.onerror = () => opts?.onError?.(key);
      }

      _sockets[key] = socket;

      return response;
    },
    getSocket: (k: SocketGroupKey) => {
      const socket = _sockets[k];
      if (!socket) return null;

      return socket;
    },
    removeSocket: (k: SocketGroupKey) => {
      const socket = _sockets[k];
      if (socket) {
        socket.close();
        delete _sockets[k];
      }
    },
    setHandlersForSocket: (key, handlers) => {
      const socket = _sockets[key];
      if (!socket) {
        return;
      }

      socket.onmessage = (event) => {
        let eventData: Message<ServerHandlers>;
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

        const handler = handlers[eventData.key];
        if (!handler) return;

        handler(eventData.data, key, group);
      };
    },
    send: (key, message) => {
      const socket = _sockets[key];
      if (!socket) {
        return;
      }

      socket.send(JSON.stringify(message));
    },
    broadcast: (message) => {
      for (const socket of Object.values(_sockets)) {
        socket.send(JSON.stringify(message));
      }
    },
  };

  return group;
}
