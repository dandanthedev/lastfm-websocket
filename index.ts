import type { ServerWebSocket } from "bun";
import { EventEmitter } from "events";
import { createId } from "@paralleldrive/cuid2";
const websocketPingInterval = 1000 * 30;
const socketPinged: Set<string> = new Set();
const activeSockets: Set<string> = new Set();
const shouldFetch: {
  id: string;
  subscriptions: string[];
}[] = [];
const currentValue = new Map();
const ee = new EventEmitter();

function transformSocketDataTS(data: unknown) {
  return data as any;
}

function attemptParse(data: unknown) {
  try {
    return JSON.parse(data as string);
  } catch (e) {
    return undefined;
  }
}

function close(ws: ServerWebSocket<unknown>, reason: string) {
  ws.send(
    JSON.stringify({
      op: -1,
      d: {
        reason,
      },
    })
  );
  ws.close(1011, reason);
}

Bun.serve({
  fetch(req, server) {
    server.upgrade(req, {
      data: {
        id: createId(),
        subscriptions: [],
      },
    });
    return undefined;
  },
  websocket: {
    open(ws) {
      ws.send(
        JSON.stringify({
          op: 0,
          d: {
            pingInterval: websocketPingInterval,
          },
        })
      );

      const socketData = transformSocketDataTS(ws.data);
      console.log("message from", socketData.id);

      const interval = setInterval(() => {
        if (!socketPinged.has(socketData.id)) {
          close(ws, "No ping received in time");
          clearInterval(interval);
        } else {
          socketPinged.delete(socketData.id);
        }
        if (socketData.subscriptions.length === 0) {
          close(
            ws,
            `Cleanup because of inactivity. Please subscribe to a channel immediately after connecting.`
          );
          clearInterval(interval);
        }
      }, websocketPingInterval + 5000);

      activeSockets.add(socketData.id);
    },
    message(ws, message) {
      if (!ws) return;
      const socketData = transformSocketDataTS(ws.data);

      if (!activeSockets.has(socketData.id))
        return close(ws, "Please wait for opcode 0 before sending events");

      if (typeof message !== "string")
        return close(ws, "Message must be a string");
      const json = attemptParse(message);
      if (typeof json !== "object")
        return close(ws, "Message must be a JSON object");

      if (!json.op) return close(ws, "Message must have an op property");

      //heartbeat
      if (json.op === 1) {
        if (!socketPinged.has(socketData.id)) {
          console.log("ping from", socketData.id);
          socketPinged.add(socketData.id);
        }
      }

      //subscribe
      if (json.op === 2) {
        if (!json.d.user)
          return close(ws, "Please provide a user when subscribing");
        if (socketData.subscriptions.includes(json.d.user)) return;
        socketData.subscriptions.push(json.d.user);
        const existing = shouldFetch.find((s) => s.id === json.d.user);
        if (existing) existing.subscriptions.push(socketData.id);
        else
          shouldFetch.push({
            id: json.d.user,
            subscriptions: [socketData.id],
          });
        ws.send(
          JSON.stringify({
            op: 2,
            d: {
              subscriptions: socketData.subscriptions,
            },
          })
        );

        function sendInfo(track: any) {
          if (track.error) {
            ws.send(
              JSON.stringify({
                op: 3,
                d: {
                  user: json.d.user,
                  error: track.error,
                },
              })
            );
            socketData.subscriptions.splice(
              socketData.subscriptions.indexOf(json.d.user),
              1
            );
            ws.send(
              JSON.stringify({
                op: 2,
                d: {
                  subscriptions: socketData.subscriptions,
                },
              })
            );
            ee.off(json.d.user, sendInfo);
          } else if (track.closed) {
            ee.off(json.d.user, sendInfo);
          } else {
            ws.send(
              JSON.stringify({
                op: 3,
                d: {
                  user: json.d.user,
                  track,
                },
              })
            );
          }
        }
        //todo: better unsubscribe
        ee.on(json.d.user, sendInfo);
      }

      //unsubscribe
      if (json.op === 3) {
        if (!json.d.user)
          return close(ws, "Please provide a user when unsubscribing");
        if (!socketData.subscriptions.includes(json.d.user))
          return close(ws, "User is not subscribed");
        socketData.subscriptions.splice(
          socketData.subscriptions.indexOf(json.d.user),
          1
        );
        const existing = shouldFetch.find((s) => s.id === json.d.user);
        if (existing)
          existing.subscriptions.splice(
            existing.subscriptions.indexOf(socketData.id),
            1
          );
        ws.send(
          JSON.stringify({
            op: 3,
            d: {
              subscriptions: socketData.subscriptions,
            },
          })
        );
      }
    },
    close(ws) {
      const socketData = transformSocketDataTS(ws.data);
      console.log("close", socketData.id);
      activeSockets.delete(socketData.id);
    },
  },
});

setInterval(() => {
  console.log(shouldFetch);
  shouldFetch.forEach((s) => {
    s.subscriptions.forEach((id) => {
      if (!activeSockets.has(id))
        s.subscriptions.splice(s.subscriptions.indexOf(id), 1);
    });
    if (s.subscriptions.length === 0) {
      ee.emit(s.id, {
        closed: true,
      });
      shouldFetch.splice(shouldFetch.indexOf(s), 1);
    }
  });

  shouldFetch.forEach((s) => {
    const searchParams = new URLSearchParams();
    searchParams.set("method", "user.getrecenttracks");
    searchParams.set("user", s.id);
    searchParams.set("api_key", "c1797de6bf0b7e401b623118120cd9e1");
    searchParams.set("limit", "1");
    searchParams.set("format", "json");
    fetch(`https://ws.audioscrobbler.com/2.0/?${searchParams.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        console.log(data.recenttracks.track[0]);
        if (data.error) {
          shouldFetch.splice(shouldFetch.indexOf(s), 1); //todo: is this a good idea?
          return ee.emit(s.id, {
            error: data.message,
          });
        }
        const track = data.recenttracks.track[0];
        if (!track)
          return ee.emit(s.id, { error: "User has no recent tracks" });
        const formattedTrack = {
          album: {
            mbid: track.album.mbid,
            name: track.album["#text"],
          },
          artist: {
            mbid: track.artist.mbid,
            name: track.artist["#text"],
          },
          images: track.image.map((i: any) => {
            return {
              size: i.size,
              url: i["#text"],
            };
          }),
          name: track.name,
          mbid: track.mbid,
          url: track.url,
          nowplaying: track["@attr"].nowplaying,
        };
        if (
          JSON.stringify(formattedTrack) ===
          JSON.stringify(currentValue.get(s.id))
        )
          return;
        currentValue.set(s.id, formattedTrack);
        ee.emit(s.id, formattedTrack);
      });
  });
}, 15000);

console.log("up!");
