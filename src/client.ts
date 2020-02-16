import GameClient from "./GameClient";
import API from "./api";

type ClientProps = {
  gameId: string;
  webSocketUrl?: string;
  apiKey: string;
  apiSecret: string;
  apiUrl?: string;
  jwt?: string;
};

const API_URL = "http://localhost:3000";
const WEB_SOCKET_URL = "ws://localhost:3000";

export default class MekaClient extends GameClient {
  jwt?: string;
  api: API;
  webSocketUrl: string;
  apiKey: string;
  apiSecret: string;

  constructor(props: ClientProps) {
    super(props.gameId);
    this.api = new API(props.apiUrl || API_URL);
    this.webSocketUrl = props.webSocketUrl || WEB_SOCKET_URL;
    this.apiKey = props.apiKey;
    this.apiSecret = props.apiSecret;
    this.jwt = props.jwt;
  }

  async requireAuth() {
    if (this.api.authenticated) return;
    await this.api.authenticateWithApiKey(this.apiKey, this.apiSecret);
  }

  async me() {
    await this.requireAuth();
    return this.api.me();
  }

  async connect() {
    await this.requireAuth();
    const webSocketToken = await this.api.createWebSocketHandshakeToken();
    return this.createWebSocket(this.webSocketUrl, webSocketToken).then(() => {
      // TODO: does process.on work in browser?
      process.on("exit", () => this.disconnect());
    });
  }
}
