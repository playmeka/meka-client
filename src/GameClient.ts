import { EventEmitter } from "events";
import {
  Game,
  GameJSON,
  Action,
  ActionJSON,
  CommandResponse,
  CommandResponseJSON,
  CommandChildClass,
  GameGenerateProps
} from "@meka-js/core";
import WebSocket from "isomorphic-ws";
import { User as UserModel } from "./API";

export type ClientJSON = { id: string; user: UserModel };
type GameServerStatus = "open" | "ready" | "inprogress" | "paused" | "ended";
type UserWrapper = { user: UserModel; isReady: boolean };
type ClockJSON = { tickTime: number; tickCount: number };
type GameServerJSON = {
  id: string;
  status: GameServerStatus;
  game: GameJSON;
  gameProps: GameGenerateProps;
  users: UserWrapper[];
  clients: ClientJSON[];
  clock: ClockJSON;
  startAtTick?: number;
  forfeitAtTick?: number;
  winnerId?: string | null;
};

class Clock extends EventEmitter {
  timeout: NodeJS.Timeout;
  tickTime: number;
  tickCount: number;

  constructor(
    props: {
      tickTime?: number;
      tickCount?: number;
      autoStart?: boolean;
    } = {}
  ) {
    super();
    this.tickTime = props.tickTime || 250;
    this.tickCount = props.tickCount || 0;
    if (props.autoStart) this.tick(0);
  }

  tick(count?: number) {
    this.tickCount = count || this.tickCount + 1;
    this.emit("tick", this.tickCount);
    this.timeout = setTimeout(() => this.tick(), this.tickTime);
  }

  stop() {
    clearInterval(this.timeout);
  }

  syncWith(json: ClockJSON) {
    this.stop();
    this.tickTime = json.tickTime;
    this.tick(json.tickCount);
  }
}

export default class GameClient extends EventEmitter {
  gameId: string;
  ws: WebSocket;
  gameProps: GameGenerateProps;
  clock: Clock;
  clientMap: { [clientId: string]: ClientJSON };
  userMap: { [id: string]: UserWrapper };
  status: GameServerStatus;
  startAtTick?: number;
  forfeitAtTick?: number;
  winnerId?: string | null;
  game?: Game;

  constructor(gameId: string) {
    super();
    this.gameId = gameId;
    this.clientMap = {};
    this.userMap = {};
    this.clock = new Clock();
  }

  get clientList() {
    return Object.values(this.clientMap);
  }

  get userToClientMap() {
    const clientMap: { [userId: string]: ClientJSON[] } = {};
    this.clientList.forEach(client => {
      clientMap[client.user.uid] = [
        ...(clientMap[client.user.uid] || []),
        client
      ];
    });
    return clientMap;
  }

  get userList() {
    return Object.values(this.userMap);
  }

  get readyUserList() {
    return this.userList.filter(userWrapper => userWrapper.isReady);
  }

  clientsForUser(userId: string) {
    return this.userToClientMap[userId] || [];
  }

  createWebSocket(webSocketUrl: string, webSocketToken: string) {
    return new Promise((resolve, reject) => {
      const wsUrl = `${webSocketUrl}/game/${this.gameId}?token=${webSocketToken}`;
      try {
        this.ws = new WebSocket(wsUrl);
        this.ws.onmessage = this.handleMessage.bind(this);
        this.ws.onopen = resolve.bind(this);
        this.ws.onerror = (error: WebSocket.ErrorEvent) => {
          reject(error);
        };
      } catch (e) {
        reject(e);
      }
    });
  }

  disconnect() {
    this.ws.close(1000);
  }

  requestDownload() {
    const message = { eventType: "download" };
    this.ws.send(JSON.stringify(message));
  }

  sendJoin() {
    const message = { eventType: "join" };
    this.ws.send(JSON.stringify(message));
  }

  sendReady() {
    const message = { eventType: "ready" };
    this.ws.send(JSON.stringify(message));
  }

  sendUnready() {
    const message = { eventType: "unready" };
    this.ws.send(JSON.stringify(message));
  }

  sendCommands(commands: CommandChildClass[]) {
    const message = {
      eventType: "commands",
      data: { commands: commands.map(command => command.toJSON()) }
    };
    this.ws.send(JSON.stringify(message));
  }

  sendCommand(command: CommandChildClass) {
    return this.sendCommands([command]);
  }

  handleMessage(message: { data: string }) {
    const json = JSON.parse(message.data);
    const typeToFunctionMap: { [key: string]: Function } = {
      download: this.handleDownload.bind(this),
      addclient: this.handleAddClient.bind(this),
      closeclient: this.handleCloseClient.bind(this),
      joinuser: this.handleJoinUser.bind(this),
      readyuser: this.handleReadyUser.bind(this),
      tick: this.handleTick.bind(this),
      ready: this.handleReady.bind(this),
      unready: this.handleUnready.bind(this),
      start: this.handleStart.bind(this),
      pause: this.handlePause.bind(this),
      unpause: this.handleUnpause.bind(this),
      end: this.handleEnd.bind(this),
      forfeit: this.handleForfeit.bind(this)
    };
    const typeFunction = typeToFunctionMap[json.eventType];
    if (typeFunction) typeFunction(json.state, json.data);
  }

  importState(state: GameServerJSON) {
    this.game = state.game ? Game.fromJSON(state.game) : undefined;
    this.clock.syncWith(state.clock);
    this.status = state.status;
    this.gameProps = state.gameProps;
    this.clientMap = {};
    state.clients.forEach(clientJson => {
      this.clientMap[clientJson.id] = clientJson;
    });
    this.userMap = {};
    state.users.forEach(userWrapper => {
      this.userMap[userWrapper.user.uid] = userWrapper;
    });
    this.startAtTick = state.startAtTick;
    this.forfeitAtTick = state.forfeitAtTick;
    this.winnerId = state.winnerId;
  }

  handleDownload(state: GameServerJSON) {
    this.importState(state);
    this.emit("download");
  }

  handleAddClient(state: GameServerJSON, data: ClientJSON) {
    this.importState(state);
    this.emit("addclient", data);
  }

  handleCloseClient(state: GameServerJSON, data: ClientJSON) {
    this.importState(state);
    this.emit("closeclient", data);
  }

  handleJoinUser(state: GameServerJSON, data: UserModel) {
    this.importState(state);
    this.emit("joinuser", data);
  }

  handleReadyUser(state: GameServerJSON, data: UserModel) {
    this.importState(state);
    this.emit("readyuser", data);
  }

  async handleTick(
    _: GameServerJSON,
    data: {
      turn: number;
      commandResponses: CommandResponseJSON[];
      actions: ActionJSON[];
    }
  ) {
    if (!this.game) return;
    if (data.turn != this.game.turn + 1) {
      console.log("Out of sync!");
      this.requestDownload();
      return;
    }
    const actions = data.actions.map(actionJson =>
      Action.fromJSON(this.game, actionJson)
    );
    await this.game.importTurn(data.turn, actions);
    const commandResponses = data.commandResponses.map(responseJson =>
      CommandResponse.fromJSON(this.game, responseJson)
    );
    this.emit("tick", commandResponses);
  }

  handleReady(state: GameServerJSON) {
    this.importState(state);
    this.emit("ready");
  }

  handleUnready(state: GameServerJSON) {
    this.importState(state);
    this.emit("unready");
  }

  handleStart(state: GameServerJSON) {
    this.importState(state);
    this.emit("start");
  }

  handlePause(state: GameServerJSON) {
    this.importState(state);
    this.emit("pause");
  }

  handleUnpause(state: GameServerJSON) {
    this.importState(state);
    this.emit("unpause");
  }

  handleForfeit(state: GameServerJSON, data: UserModel) {
    this.importState(state);
    this.emit("forfeit", data);
  }

  handleEnd(state: GameServerJSON) {
    this.importState(state);
    this.emit("end");
    this.ws.close(1000, "Game ended");
  }
}
