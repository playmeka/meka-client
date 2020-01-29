import { Game, GameJSON, Action, ActionJSON } from "@meka-js/core";
import WebSocket from "ws";

type MessageJSON = { eventType: string; data?: any };

class GameClient {
  ws: WebSocket;
  game: Game;
  gameUid: string;

  constructor(gameUid: string) {
    this.gameUid = gameUid;
    this.ws = new WebSocket(this.websocketUrl);
    this.ws.on("open", this.open.bind(this));
    this.ws.on("message", this.handleMessage.bind(this));
    this.ws.on("tick", this.tick.bind(this));
    this.ws.on("start", this.start.bind(this));
    this.ws.on("end", this.end.bind(this));
    // TODO: add other event types
  }

  get websocketUrl() {
    return `ws://localhost:8000/${this.gameUid}`;
  }

  open() {
    console.log("Opened connection to: ", this.websocketUrl);
  }

  handleMessage(message: string) {
    const json: MessageJSON = JSON.parse(message);
    this.ws.emit(json.eventType, json.data);
  }

  start(data: { game: GameJSON }) {
    this.game = Game.fromJSON(data.game);
    console.log("Started game: ", this.game);
  }

  end(data: { game: GameJSON }) {
    console.log("Ended game: ", data);
    this.ws.close(1000, "Game ended");
  }

  async tick(data: { turn: number; actions: ActionJSON[] }) {
    if (data.turn != this.game.turn + 1) {
      console.log("Out of sync!");
      return;
    }
    const actions = data.actions.map(actionJSON =>
      Action.fromJSON(this.game, actionJSON)
    );
    this.game.turn += 1;
    await this.game.applyActions(actions);
    console.log("Did turn", this.game.turn, actions);
    // TODO: send actions in response
  }
}

const client = new GameClient("PFH-1");
console.log("Client", client);
