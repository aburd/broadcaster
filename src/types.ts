/**
 * The main interfaces for the websocket code.
 *
 * These define how the user will define the messages the they will send and receive over the ClientSocket / SocketGroup.
 *
 * You can also see here that the "server" will maintain connections to a group of sockets, whereas the "client" is only responsible for sending/receiving messages over a single socket. The server could, in theory, offer multiple interfaces over multiple websocket endpoints, and a client could, in theory, maintain multiple websocket connections, each with it's own interface.
 *
 * @module
 */

/**
 * A message sent/received over the WebSocket.
 * Under the hood, `data` is parsed as JSON and sent as a string with WebSocket.send.
 * Therefore, `data` _MUST_ be JSON serializable.
 */
export type Message<Handlers extends Record<string, any>> = {
  /**
   * The key of message tells the consumer what kind of
   * message this is
   */
  key: keyof Handlers;
  /**
   * Arbitrary data to be sent with the Message. _MUST_ be JSON serializable!
   */
  data: Parameters<Handlers[keyof Handlers]>[0];
};

/**
 * A handler function to handle a Message.
 *
 * The `socket` is provided to send a Message in response.
 */
export type ClientHandler<
  ServerHandlers extends Record<string, ServerHandler<any, any>>,
  T = any,
> = (
  data: T,
  socket: ClientSocket<any, ServerHandlers>,
) => void;

/**
 * A handler function to handle a Message.
 *
 * `group` is provider in order to broadcast messages to the SocketGroup
 */
export type ServerHandler<
  ClientHandlers extends Record<string, ClientHandler<any, any>>,
  T = any,
> = (
  data: T,
  key: SocketGroupKey,
  group: SocketGroup<any, ClientHandlers>,
) => void;

/**
 * A key used to look up a particular WebSocket in a SocketGroup
 */
export type SocketGroupKey = string | number | symbol;

/**
 * A collection of ClientSockets which, over a defined interface, will receive Messages from said sockets and send messages en-masse to said sockets in the SocketGroup. As ClientSockets are added to the group, any calls to `.broadcast` will broadcast that message to all the ClientSockets in the group.
 */
export type SocketGroup<
  ServerHandlers extends Record<string, ServerHandler<any>>,
  ClientHandlers extends Record<string, ClientHandler<any>>,
> = {
  _sockets: Record<SocketGroupKey, WebSocket>;
  /**
   * add a socket to the group, takes in an Request and returns a Response
   * Under the hood, we use Deno.upgradeWebSocket
   */
  addSocket: (
    /** the key associated with the WebSocket */
    key: SocketGroupKey,
    /** the Request we will upgrade to a WebSocket */
    req: Request,
  ) => Response;
  /**
   * get a socket from the group
   */
  getSocket: (
    /** the key associated with the websocket */
    key: SocketGroupKey,
  ) => WebSocket | null;
  /**
   * remove a socket from the group
   */
  removeSocket: (
    /** the key associated with the websocket */
    key: SocketGroupKey,
  ) => void;
  /**
   * Send a Message to a socket
   */
  send: (key: SocketGroupKey, message: Message<ClientHandlers>) => void;
  /**
   * Broadcast a Message to all sockets in the group
   */
  broadcast: (message: Message<ClientHandlers>) => void;
  /**
   * set Message handlers for a particular socket in the group
   */
  setHandlersForSocket: (
    /** the key associated with the websocket */
    key: SocketGroupKey,
    handlers: ServerHandlers,
  ) => void;
};

/**
 * The ClientSocket is part of a SocketGroup. The ClientSocket sends and receives messages to/from said SocketGroup with a defined interface.
 */
export type ClientSocket<
  ClientHandlers extends Record<string, ClientHandler<any>>,
  ServerHandlers extends Record<string, ServerHandler<any>>,
> = {
  /**
   * send an Message through the socket
   */
  send: (message: Message<ServerHandlers>) => void;
  /**
   * close the socket
   */
  close: () => void;
  /**
   * set handlers for the client socket
   */
  setHandlersForSocket: (handlers: ClientHandlers) => void;
};
