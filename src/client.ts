import { Game, GameJSON, Command, Action, ActionJSON } from "@meka-js/core";
import WebSocket from "ws";

type MessageJSON = { eventType: string; data?: any };

export default class GameClient {
  ws: WebSocket;
  game: Game;
  gameUid: string;
  websocketUrl: string;
  onTickCallback: Function;

  constructor(props: {
    gameUid: string;
    websocketUrl: string;
    onTick?: Function;
  }) {
    this.gameUid = props.gameUid;
    this.websocketUrl = props.websocketUrl || "ws://localhost:8000";
    this.onTickCallback = props.onTick;
    this.ws = new WebSocket(`${this.websocketUrl}/${this.gameUid}`);
    this.ws.on("open", this.open.bind(this));
    this.ws.on("message", this.handleMessage.bind(this));
    this.ws.on("tick", this.tick.bind(this));
    this.ws.on("download", this.download.bind(this));
    this.ws.on("start", this.start.bind(this));
    this.ws.on("end", this.end.bind(this));
    // TODO: add other event types
  }

  open() {
    console.log("Opened connection to: ", this.websocketUrl);
  }

  handleMessage(message: string) {
    const json: MessageJSON = JSON.parse(message);
    this.ws.emit(json.eventType, json.data);
  }

  download(data: { game: GameJSON }) {
    this.game = Game.fromJSON(data.game);
    console.log("Downloaded game: ", this.game);
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
      this.requestDownload();
      return;
    }
    console.log("Got JSON actions", data.actions);
    const actions = data.actions.map(actionJSON =>
      Action.fromJSON(this.game, actionJSON)
    );
    await this.game.importTurn(data.turn, actions);
    this.onTickCallback(this.game);
  }

  sendCommands(commands: Command[]) {
    const data = {
      eventType: "commands",
      data: { commands: commands.map(command => command.toJSON()) }
    };
    this.ws.send(JSON.stringify(data));
  }

  sendCommand(command: Command) {
    return this.sendCommands([command]);
  }

  requestDownload() {
    const message = { eventType: "download" };
    this.ws.send(JSON.stringify(message));
  }
}
