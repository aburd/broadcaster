[![JSR](https://jsr.io/badges/@aburd/broadcaster)](https://jsr.io/@aburd/broadcaster)
[![JSR Score](https://jsr.io/badges/@aburd/broadcaster/score)](https://jsr.io/@aburd/broadcaster)

# Broadcaster

An opinionated deno websockets library to help you manage websocket connections so you can start sending structured messages!

## Summary

Writing WebSocket code with Deno is easy, but writing `myWebsocket.send(arbitraryJsonString)` is anything but simple. In addition, managing websocket connections by yourself is no fun. 

Broadcaster gives you the ability to define a few interfaces which tell you how your client/server will communicate over the websocket and then pass in the implementations to a "connect" function. From there, your connections will have "send" function which ensures the messages you're sending over the socket are typed and handled by the other side of the socket.

## Example

`my-socket-interface.ts`

Here we define the interface of how clients and server will communicate.

- The client can __handle__ a message of:
  - `"foo_changed"`
  - `"foo_event"`
- The client can __send__ a message of:
  - `"update_foo"`
  - `"bar_event"`

Meanwhile:

- The server can __handle__ a message of:
  - `"update_foo"`
  - `"bar_event"`
- The server can __send__ a message of:
  - `"foo_changed"`
  - `"foo_event"`

```ts
import { ClientHandler, ServerHandler } from "@aburd/broadcaster";
import { Foo } from "./types";

// We define the kind of messages that the client can handle
export type ClientHandlers = {
  "foo_changed": ClientHandler<
    ServerHandlers,
    { error: string; foo: null } | { foo: Foo; error: null }
  >;
  "foo_event": ClientHandler<ServerHandlers, void>;
};

// We define the kind of messages that the server can handle
export type ServerHandlers = {
  "update_foo": ClientHandler<ServerHandlers, { foo: Foo }>;
  "bar_event": ClientHandler<ServerHandlers, { baz: string }>;
};
```

`my-client.ts`

Here we connect to the WebSocket server from a browser and implement the handlers we defined in our ClientHandlers interface.

```ts
import { connect } from "@aburd/broadcaster";
import { ClientHandlers, ServerHandlers } from "./my-socket-interface.ts";

const socket = await connect<ClientHandlers, ServerHandlers>(`${location.origin}/ws`);
socket.setHandlersForSocket({
  "foo_changed": (data, socket) => {
    // do something with updated data.foo or data.error
    //
    socket.send({ key: "bar_event", data: { baz: 1 } }); // TypeError - baz needs to be a string
    socket.send({ key: "bar", data: { baz: "yay" } }); // OK!
  },
  "foo_event": (data, socket) => {
    // data is null
  },
});
```

`my-server.ts`

Here we setup a basic WebSocket server and implement the handlers we defined in our ServerHandlers interface.

```ts
import { createSocketGroup } from "@aburd/broadcaster";
import { ClientHandlers, ServerHandlers } from "./my-socket-interface.ts";
import { Foo } from "./types";

let myFoo: Foo = { name: "my_foo" }

const socketGroup = createSocketGroup<ServerHandlers, ClientHandlers>()

Deno.serve(async (_req) => {
  const url = new URL(req.url);

  if (url.pathname === "/ws") {
    // somehow identify this socket
    const id = getId(req);

    // will return Response to upgrade the WebSocket
    const response = socketGroup.addSocket(id, req);
    socketGroup.setHandlersForSocket(
      id,
      {
        "update_foo": (data, key, socketGroup) => {
          my_foo = data.foo;
          // send foo_event to the client who updated foo
          socketGroup.send("foo_event", { key, data: null })

          // send foo_changed to all sockets in the group
          socketGroup.broadcast({ key: "foo_changed", data: { foo: myFoo } }); // TypeError - baz needs to be a string
        },
        "bar_event": (data, key, socketGroup) => {
          // do something with data.baz
          if (data.baz === "bad word") {
              socketGroup.removeSocket(key);
          }
        },
      }
    );

    return response;
  }

  return new Response("Default response");
});
```
