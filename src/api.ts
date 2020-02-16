import { EventEmitter } from "events";
import fetch from "isomorphic-fetch";
import some from "lodash/some";

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

  get authenticated() {
    return !!this.jwt;
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
    return this.getGraphQL<T>(query, variables, apiUrl, this.jwt);
  }

  async authenticateWithApiKey(apiKey: string, apiSecret: string) {
    const query = `
      mutation AuthenticateWithAPIKey($apiKey: String!, $apiSecret: String!) {
        authenticateWithApiKey(apiKey: $apiKey, apiSecret: $apiSecret) {
          token
        }
      }
    `;
    const { authenticateWithApiKey: response } = await this.graphqlFetch<{
      authenticateWithApiKey: {
        token: string;
      };
    }>(query, { apiKey, apiSecret });
    this.jwt = response.token;
  }

  async authenticateWithGithubToken(username: string, accessToken: string) {
    const query = `
      mutation AuthenticateWithGithubToken($username: String!, $accessToken: String!) {
        authenticateWithGithubToken(username: $username, accessToken: $accessToken) {
          token
        }
      }
    `;
    const { authenticateWithGithubToken: response } = await this.graphqlFetch<{
      authenticateWithGithubToken: {
        token: string;
      };
    }>(query, { accessToken, username });
    this.jwt = response.token;
  }

  async createWebSocketHandshakeToken() {
    const query = `
      mutation CreateWebSocketHandshakeToken {
        createWebSocketHandshakeToken
      }
    `;
    const { createWebSocketHandshakeToken: token } = await this.graphqlFetch<{
      createWebSocketHandshakeToken: string;
    }>(query);
    return token;
  }

  async me() {
    const query = `
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
    `;
    const { me } = await this.graphqlFetch<{
      me: User | null;
    }>(query);
    return me;
  }
}
