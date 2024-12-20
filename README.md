# Last.FM Now Playing WebSocket

## ?

This is a websocket server for [Last.FM](https://www.last.fm/) that allows you to recieve information about the user's now playing track and get live updates when they start playing a track.

## Usage

Here's an example of the usage of the socket using JavaScript:

```js
const socket = new WebSocket("wss://lastfm.dandandev.xyz");

socket.onopen = () => {
  console.log("Connected");
};

socket.onmessage = (event) => {
  const parsed = JSON.parse(event.data); //This is the actual data. Read "Recieving data" for more info.
  const opcode = parsed.op; //See "Opcodes" for more info.
  const data = parsed.d;

  //Init
  if (opcode === 0) {
    setInterval(() => {
      socket.send(JSON.stringify({ op: 1 })); //send a ping every "pingInterval" ms
    }, data.pingInterval);

    //Subscribe to a user
    socket.send(JSON.stringify({ op: 2, d: { user: "sampleuser" } }));
    //Subscribe to another user
    socket.send(JSON.stringify({ op: 2, d: { user: "anotheruser" } }));
  }

  //On data
  if (opcode === 2) {
    //Handle errors
    if (data.error) return console.error(data.error);

    //Use the data 🎉
    console.log(
      `${data.user} is now playing ${data.track.name} by ${data.track.artist.name}`
    );
  }
};
```

## Opcodes

- -1 - Error
- 0 - Init data
- 1 - Ping
- 2 - Subscribe / Data
- 3 - Unsubscribe / Subscriptions

## Sending data

### Sending a ping

```json
{ "op": 1 }
```

### Subscribing to a user

```json
{ "op": 2, "d": { "user": "sampleuser" } }
```

### Unsubscribing from a user

```json
{ "op": 3, "d": { "user": "sampleuser" } }
```

## Recieving data

You will recieve a message like this when opening the websocket:

```json
{ "op": 0, "d": { "pingInterval": 30000 } }
```

You'll need to send a [ping message](#sending-a-ping) every `pingInterval` seconds to keep the connection alive.

### Now playing

The socket will send a message like this when a user starts playing a track:

```json
{
  "op": 2,
  "d": {
    "user": "sampleuser",
    "track": {
      "album": {
        "mbid": "7a1e6504-8398-4533-9adf-2a58217d80ab",
        "name": "Jungle"
      },
      "artist": { "mbid": "", "name": "Alok, The Chainsmokers & Mae Stephens" },
      "images": [
        {
          "size": "small",
          "url": "https://lastfm.freetls.fastly.net/i/u/34s/3ac5697b9089eeb4f107ded75797c13e.jpg"
        },
        {
          "size": "medium",
          "url": "https://lastfm.freetls.fastly.net/i/u/64s/3ac5697b9089eeb4f107ded75797c13e.jpg"
        },
        {
          "size": "large",
          "url": "https://lastfm.freetls.fastly.net/i/u/174s/3ac5697b9089eeb4f107ded75797c13e.jpg"
        },
        {
          "size": "extralarge",
          "url": "https://lastfm.freetls.fastly.net/i/u/300x300/3ac5697b9089eeb4f107ded75797c13e.jpg"
        }
      ],
      "name": "Jungle",
      "mbid": "e1804a86-7653-4603-ad0d-c70d49c99358",
      "url": "https://www.last.fm/music/Alok,+The+Chainsmokers+&+Mae+Stephens/_/Jungle",
      "nowplaying": "true"
    }
  }
}
```

### Errors

Fatal errors (that close the websocket) will be sent like this:

```json
{
  "op": -1,
  "d": {
    "error": "Something really bad happened"
  }
}
```

Issues relating to retrieval of data (like a user not having any recent tracks) will be sent like this:

```json
{
  "op": 2,
  "d": {
    "user": "sampleuser",
    "error": "User has no recent tracks"
  }
}
```

These messages will not close the websocket.

## REST

We also offer a REST API for users wanting to prefetch data on the server.

### Fetching data

To fetch data, you can use the following endpoint:

`https://lastfm.dandandev.xyz/:user`

Where `:user` is the username of the user you want to fetch data for.
This will return the same data as the websocket.
