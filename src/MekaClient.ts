import GameClient from "./GameClient";
import API from "./API";

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

  async connect(webSocketUrl: string = this.webSocketUrl) {
    return new Promise(async (resolve, reject) => {
      try {
        await this.requireAuth();
        const webSocketToken = await this.api.createWebSocketHandshakeToken();
        await this.createWebSocket(webSocketUrl, webSocketToken);
        // TODO: does process.on work in browser?
        process.on("exit", () => this.disconnect());
        const timeout = setTimeout(() => {
          throw new Error("Connection timed out");
        }, 1000 * 10); // 10 seconds
        this.on("connected", () => {
          clearTimeout(timeout);
          resolve(this);
        });
      } catch (err) {
        reject(err);
      }
    });
  }
}
