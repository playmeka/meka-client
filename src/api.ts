import { EventEmitter } from "events";
import fetch from "isomorphic-fetch";
import some from "lodash/some";
import { GameGenerateProps } from "@meka-js/core";

export type User = {
  id: number;
  githubId: string;
  uid: string;
  createdAt: Date;
  updatedAt: Date;
  username: string;
  avatarUrl: string;
  email: string;
  apiKey: string;
  apiSecret: string;
  winCount: number;
  lossCount: number;
  drawCount: number;
  elo: number;
};

const handleJson = (response: any) => {
  try {
    return response.json();
  } catch (e) {
    if (response.status > 399)
      throw new Error("Fetch error: " + response.statusText);
    throw new Error("Error when converting response to JSON");
  }
};

class GraphQLError extends Error {
  errors: { message: string }[];

  constructor(errors: { message: string }[]) {
    super("GraphQL Error: " + errors.map(e => e.message).join(", "));
    this.errors = errors;
  }
}

export default class API extends EventEmitter {
  apiUrl: string;

  constructor(apiUrl?: string, private jwt?: string) {
    super();
    this.apiUrl = apiUrl || "";
  }

  async getGraphQL<T = any>(
    query: string,
    variables?: { [key: string]: any },
    apiUrl?: string,
    jwt?: string
  ): Promise<T> {
    if (!apiUrl) apiUrl = this.apiUrl;

    const options: any = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {})
      },
      body: JSON.stringify({ query, variables })
    };

    const result = await fetch(`${apiUrl}/graphql`, options).then(handleJson);
    if (result.errors) {
      if (some(result.errors, err => err.message.match("jwt expired"))) {
        this.emit("jwtExpired");
      }
      throw new GraphQLError(result.errors);
    }
    return result.data;
  }

  private graphqlFetch<T>(
    query: string,
    variables: { [key: string]: any } = {},
    apiUrl?: string
  ) {
    const jwt = this.jwt;
    return this.getGraphQL<T>(query, variables, apiUrl, jwt);
  }

  async authenticateWithApiKey(apiKey: string, apiSecret: string) {
    const query = `
      mutation AuthenticateWithAPIKey($apiKey: String!, $apiSecret: String!) {
        authenticateWithApiKey(apiKey: $apiKey, apiSecret: $apiSecret) {
          token
        }
      }
    `;
    const { authenticateWithApiKey } = await this.graphqlFetch<{
      authenticateWithApiKey: {
        token: string;
      };
    }>(query, { apiKey, apiSecret });
    return authenticateWithApiKey.token;
  }

  async authenticateWithGithubToken(username: string, accessToken: string) {
    const query = `
      mutation AuthenticateWithGithubToken($username: String!, $accessToken: String!) {
        authenticateWithGithubToken(username: $username, accessToken: $accessToken) {
          token
        }
      }
    `;

    const { authenticateWithGithubToken: token } = await this.graphqlFetch<{
      authenticateWithGithubToken: {
        token: string;
      };
    }>(query, {
      accessToken,
      username
    });

    return token.token;
  }

  async me() {
    const { me } = await this.graphqlFetch<{
      me: User | null;
    }>(`
    query Me {
      me {
        username
        avatarUrl
        apiKey
        email
        apiSecret
        uid
      }
    }
    `);

    return me;
  }

  async createGame(gameProps: GameGenerateProps) {
    const { game } = await fetch(`${process.env.API_URL}/games`, {
      method: "post",
      body: JSON.stringify({ gameProps }),
      headers: {
        "Content-Type": "application/json",
        ...(this.jwt ? { Authorization: `Bearer ${this.jwt}` } : {})
      }
    }).then(handleJson);
    return game;
  }
}
