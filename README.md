<img src="https://playmeka.com/meka-logo-black.svg" width="30%" />

# meka-client

WebSocket-based client library for interacting with MEKA games.

## Getting started
Install `meka-client` via Yarn:
```
yarn add @meka-js/client
```
Import classes from the library using es6:
```
import { MekaClient, GameClient } from "@meka-js/client";
```
If you'd like to see example code that uses `meka-client`, check out [meka-boilerplate](https://github.com/playmeka/meka-boilerplate). 

## Examples
### Connect to a game
```
import { MekaClient } from "@meka-js/client";
const meka = new MekaClient({
  gameId: "<Game ID>",
  apiUrl: "<MEKA API URL>",
  webSocketUrl: "<MEKA WebSocket URL>",
  apiKey: "<Your MEKA API Key>",
  apiSecret: "<Your MEKA API Secret>"
});
meka.connect().then(() => console.log("Connected!"))
```
The `connect` function will wait until the `MekaClient` instance has authenticated with the API and downloaded the current version of the game.

### Retrieve your user info
```
import { MekaClient } from "@meka-js/client";
const meka = new MekaClient({...});
await meka.connect(); // Done outside async function for demo purposes
const me = await meka.api.me();
```
### Respond to events
```
import { MekaClient } from "@meka-js/client";
const meka = new MekaClient({...});
await meka.connect();
meka.on("start", () => console.log("Game started!"))
```
MekaClient is an event emitter, so you can react to a number of events. Here's the list:
* `tick`: emitted every tick (500ms) with a list of executed actions and command responses.
* `download`: when the game server sends the client a full download of the game. 
* `connected`: when the client has authenticated with the game server and downloaded its first version of the game.
* `addclient`: when a new client connects to the game server.
* `closeclient`: when a client disconnects fromthe game server.
* `joinuser`: when a user joins the game, which is distinct from when a new client joins. The game can have an arbitrary number of clients, each affiliated with a user. But the game can only have two users (i.e. home and away).
* `readyuser`: when a user marks themselves as ready to start the game.
* `ready`: when all users have marked themselves as ready and the game will start in 5 seconds.
* `unready`: when the game goes from a ready state to a not ready state. This usually happens when a user marks themselves as not ready or disconnects after being marked as ready.
* `start`: when the game starts.
* `pause`: when the game pauses, which usually happens when a game is in-progress and one of the users disconnects. If a user who disconnected reconnects within 30 seconds, the game resumes. 
* `unpause`: when the game resumes from being paused.
* `forfeit`: when a user forfeits the game, usually due to a disconnection. Games are automatically forfeited if a user disconnects for 30 seconds. 
* `end`: when the game ends.

### MekaClient status
The game server can be in one of five states:
* `open`: the game is waiting for users to join.
* `ready`: the game has users, they've all marked themselves as ready, and the game will be starting in 5 seconds.
* `inprogress`: the game is underway and can receive actions.
* `paused`: the game is paused.
* `ended`: the game has ended.

### Sending commands
When you want to send a command on behalf of one of your users, here is an example to follow:
```
import { MekaClient } from "@meka-js/client";
import { Citizen, Position, MoveCommand } from "@meka-js/core";
const meka = new MekaClient({...});
await meka.connect();
const citizen = new Citizen(meka.game, {...});
const newPosition = new Position(10, 10);
const command = new MoveCommand({ unit: citizen, args: {position: newPosition} });
meka.sendCommand(command);
```
