import SimplePeer, { SignalData } from "simple-peer";

export interface MediaSocket {
  id?: string;
  on(event: string, listener: (payload: SignalPayload) => void): unknown;
  off(event: string, listener: (payload: SignalPayload) => void): unknown;
  emit(event: string, payload: unknown): unknown;
}
interface MediaMessage {
  protocol: "guess-media-v1";
  roomName: string;
  type: "request" | "signal" | "stop" | "unavailable" | "status";
  sessionId?: string;
  publisherId?: string;
  data?: SignalData;
  video?: boolean;
  audio?: boolean;
  videoPaused?: boolean;
  audioPaused?: boolean;
}
interface SignalPayload {
  callerId: string;
  signal: MediaMessage;
}
export interface RemoteMedia {
  playerId: string;
  stream: MediaStream | null;
  video: boolean;
  audio: boolean;
  videoPaused?: boolean;
  audioPaused?: boolean;
  status: "connecting" | "connected" | "failed";
}
interface Connection {
  peer: SimplePeer.Instance;
  sessionId: string;
  timer?: ReturnType<typeof setTimeout>;
  media: RemoteMedia;
}

// Each publisher initiates a separate outgoing stream. A viewer never needs a
// camera, microphone, or a matching startup time to answer an incoming offer.
export class RoomMedia {
  private players = new Set<string>();
  private outgoing = new Map<string, Connection>();
  private incoming = new Map<string, Connection>();
  private stream: MediaStream | null = null;
  private disposed = false;
  private unwatchStream = () => undefined as void;

  constructor(
    private socket: MediaSocket,
    private roomName: string,
    private publish: (media: RemoteMedia[]) => void,
    private onError: (message: string) => void
  ) {
    socket.on("webrtc-signal", this.receive);
  }

  private send(
    playerId: string,
    message: Omit<MediaMessage, "protocol" | "roomName">
  ) {
    if (!this.disposed)
      this.socket.emit("webrtc-signal", {
        target: playerId,
        signal: {
          protocol: "guess-media-v1",
          roomName: this.roomName,
          ...message,
        },
      });
  }

  private changed() {
    if (!this.disposed)
      this.publish(
        Array.from(this.incoming.values(), (value) => ({ ...value.media }))
      );
  }

  private remove(map: Map<string, Connection>, id: string, notify = false) {
    const connection = map.get(id);
    if (!connection) return;
    map.delete(id); // Detach before destroy emits close/error.
    clearTimeout(connection.timer);
    if (notify)
      this.send(id, {
        type: "stop",
        sessionId: connection.sessionId,
        publisherId: this.socket.id,
      });
    connection.peer.destroy();
  }

  setPlayers(players: string[]) {
    const next = new Set(players.filter((id) => id !== this.socket.id));
    this.players.forEach((id) => {
      if (!next.has(id)) {
        this.remove(this.outgoing, id);
        this.remove(this.incoming, id);
      }
    });
    const added = Array.from(next).filter((id) => !this.players.has(id));
    this.players = next;
    for (const id of added) {
      this.send(id, { type: "request" }); // Recovers offers sent before this component mounted.
      if (this.stream) this.startSending(id);
    }
    this.changed();
  }

  setStream(stream: MediaStream | null) {
    this.unwatchStream();
    this.stream = stream;
    const tracks = stream?.getTracks() || [];
    const changed = () =>
      this.outgoing.forEach((connection, id) =>
        this.send(id, {
          type: "status",
          sessionId: connection.sessionId,
          publisherId: this.socket.id,
          ...this.availability(),
        })
      );
    tracks.forEach((track) => {
      track.addEventListener("mute", changed);
      track.addEventListener("unmute", changed);
    });
    this.unwatchStream = () =>
      tracks.forEach((track) => {
        track.removeEventListener("mute", changed);
        track.removeEventListener("unmute", changed);
      });
    this.outgoing.forEach((_value, id) => this.remove(this.outgoing, id, true));
    if (stream) this.players.forEach((id) => this.startSending(id));
  }

  private availability() {
    return {
      videoPaused:
        this.stream?.getVideoTracks().some((track) => track.muted) || false,
      audioPaused:
        this.stream?.getAudioTracks().some((track) => track.muted) || false,
    };
  }

  reconnect() {
    this.players.forEach((id) => {
      this.remove(this.incoming, id);
      this.send(id, { type: "request" });
      if (this.stream) this.startSending(id);
    });
    this.changed();
  }

  private create(
    id: string,
    sessionId: string,
    sending: boolean,
    video: boolean,
    audio: boolean
  ): Connection | undefined {
    const map = sending ? this.outgoing : this.incoming;
    this.remove(map, id, sending);
    let peer: SimplePeer.Instance;
    try {
      const iceServers = process.env.REACT_APP_ICE_SERVERS;
      peer = new SimplePeer({
        initiator: sending,
        trickle: true,
        stream: sending ? this.stream || undefined : undefined,
        ...(iceServers
          ? { config: { iceServers: JSON.parse(iceServers) } }
          : {}),
      });
    } catch {
      this.onError(
        "Video connections could not start. Try an up-to-date browser or check the site's video configuration."
      );
      return;
    }
    const connection: Connection = {
      peer,
      sessionId,
      media: { playerId: id, stream: null, video, audio, status: "connecting" },
    };
    map.set(id, connection);
    const current = () => !this.disposed && map.get(id) === connection;
    const failed = () => {
      if (!current()) return;
      clearTimeout(connection.timer);
      if (sending) {
        this.onError(
          "A player could not connect to your camera or mic. Try Reconnect video."
        );
      } else {
        connection.media.status = "failed";
        connection.media.stream = null;
        this.changed();
      }
    };
    connection.timer = setTimeout(() => {
      failed();
      peer.destroy();
    }, 15000);
    peer.on("signal", (data: SignalData) => {
      if (current())
        this.send(id, {
          type: "signal",
          sessionId,
          publisherId: sending ? this.socket.id : id,
          data,
          video,
          audio,
          ...(sending ? this.availability() : {}),
        });
    });
    peer.on("stream", (stream: MediaStream) => {
      if (!current() || sending) return;
      connection.media.stream = stream;
      connection.media.status = "connected";
      clearTimeout(connection.timer);
      this.changed();
    });
    peer.on("connect", () => {
      if (current()) clearTimeout(connection.timer);
    });
    peer.on("error", failed);
    peer.on("close", failed);
    this.changed();
    return connection;
  }

  private startSending(id: string) {
    if (!this.stream || this.disposed) return;
    this.create(
      id,
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      true,
      this.stream.getVideoTracks().length > 0,
      this.stream.getAudioTracks().length > 0
    );
  }

  private receive = (payload: SignalPayload) => {
    if (this.disposed || !payload || !this.players.has(payload.callerId))
      return;
    const { callerId: id, signal: message } = payload;
    if (
      !message ||
      message.protocol !== "guess-media-v1" ||
      message.roomName !== this.roomName
    )
      return;
    if (message.type === "request") {
      if (this.stream) this.startSending(id);
      else this.send(id, { type: "unavailable" });
      return;
    }
    if (message.type === "unavailable") {
      this.remove(this.incoming, id);
      this.changed();
      return;
    }
    if (typeof message.sessionId !== "string") return;
    if (message.type === "status") {
      const connection = this.incoming.get(id);
      if (
        message.publisherId === id &&
        connection?.sessionId === message.sessionId
      ) {
        connection.media.videoPaused = message.videoPaused === true;
        connection.media.audioPaused = message.audioPaused === true;
        this.changed();
      }
      return;
    }
    if (message.type === "stop") {
      if (this.incoming.get(id)?.sessionId === message.sessionId) {
        this.remove(this.incoming, id);
        this.changed();
      }
      return;
    }
    if (
      message.type !== "signal" ||
      !message.data ||
      typeof message.data !== "object"
    )
      return;
    let connection: Connection | undefined;
    if (message.publisherId === this.socket.id) {
      connection = this.outgoing.get(id);
    } else if (message.publisherId === id) {
      connection = this.incoming.get(id);
      if (
        "type" in message.data &&
        message.data.type === "offer" &&
        connection?.sessionId !== message.sessionId
      ) {
        connection = this.create(
          id,
          message.sessionId,
          false,
          message.video === true,
          message.audio === true
        );
      }
    }
    if (
      connection &&
      message.publisherId === id &&
      connection.sessionId === message.sessionId
    ) {
      connection.media.videoPaused = message.videoPaused === true;
      connection.media.audioPaused = message.audioPaused === true;
      this.changed();
    }
    if (
      !connection ||
      connection.sessionId !== message.sessionId ||
      connection.peer.destroyed
    )
      return;
    try {
      connection.peer.signal(message.data);
    } catch {
      connection.peer.destroy();
    }
  };

  dispose() {
    this.unwatchStream();
    this.socket.off("webrtc-signal", this.receive);
    this.outgoing.forEach((_value, id) => this.remove(this.outgoing, id, true));
    this.disposed = true;
    this.incoming.forEach((_value, id) => this.remove(this.incoming, id));
    this.players.clear();
  }
}
