import { Game, GameJSON } from "@meka-js/core";
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
    console.log("Start", data);
    this.game = Game.fromJSON(data.game);
    console.log("Started game: ", this.game);
    // TODO
  }

  tick(json: any) {
    // TODO
    console.log("Tick", json);
  }
}

const client = new GameClient("12345");
